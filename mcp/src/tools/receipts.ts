/**
 * ReceiptVerifier MCP Tools
 *
 * get_receipt_count — Get receipt count for an address
 * get_receipt       — Verify a specific receipt on-chain by bytes32 ID
 * create_receipt    — Issue an ERC-8004 attestation receipt
 */
import { z } from "zod";
import { type Address, isAddress, type Hex } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult, formatError } from "../handlers/transactions.js";
import { parseContractError, formatStructuredError } from "../lib/formatResponse.js";
import { ethAddress } from "../lib/schemaHelpers.js";
import { RECEIPT_TYPE } from "../types.js";
import { stringToBytes32, isBytes32 } from "../utils.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// V2 ReceiptVerifier doesn't have getReceiptsByAgent - use V1 ABI for that function
const V1_ABI = loadAbi("ReceiptVerifier");
const V2_ABI = loadAbi("ReceiptVerifier");

// Input validation schemas
const getAddressSchema = z.object({
  address: z.string().refine(isAddress, { message: "Invalid Ethereum address" })
});

const getReceiptSchema = z.object({
  receiptId: z.string().describe("Receipt ID as bytes32 hex string (0x...)")
});

const createReceiptSchema = z.object({
  issuer: z.string().refine(isAddress, { message: "Invalid issuer Ethereum address" }),
  counterparty: z.string().refine(isAddress, { message: "Invalid counterparty Ethereum address" }),
  interactionType: z.union([z.number().int().min(0).max(10), z.string()]).describe("Receipt type (0=TaskCompleted, 1=AgentVerified, etc.)"),
  dataHash: z.string().describe("Hash of the receipt data (will be converted to bytes32)"),
});

export function registerReceiptTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // get_receipts (list all receipts for an address)
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_receipts",
    {
      title: "Get All Receipts for Address",
      description:
        "Fetch all ERC-8004 attestation receipts for an address. Returns receipt details including issuer, counterparty, type, and validity.\n" +
        "USE WHEN: You want to see all attestation receipts issued for a specific agent or address.\n" +
        "REQUIRES: The address must exist on-chain (may have zero receipts).\n" +
        "RETURNS: Array of receipt objects with issuer, counterparty, interaction type, data hash, and validity status.\n" +
        "COMES AFTER: corven_create_receipt issued receipts for this address.\n" +
        "COMES BEFORE: corven_get_receipt (inspect a specific receipt by ID).\n" +
        "NOTE: Returns all receipts where the address is either issuer or counterparty.",
      inputSchema: {
        address: ethAddress,
      },
    },
    async ({ address }) => {
      try {
        const validationResult = getAddressSchema.safeParse({ address });
        if (!validationResult.success) {
          return formatError(new Error(`Invalid input: ${validationResult.error.issues.map((e: any) => e.message).join(", ")}`));
        }

        const data = await readContract(
          CONTRACTS.ReceiptVerifier,
          V1_ABI,
          "getReceiptsByAgent",
          [validationResult.data.address as Address]
        );

        return formatReadResult(
          { address, receipts: data },
          `Receipts for ${address}`
        );
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // get_receipt_count is merged into get_receipts (returns count alongside receipts)

  // ──────────────────────────────────────────────────────────────
  // get_receipt (was verify_receipt)
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_receipt",
    {
      title: "Get Receipt by ID",
      description:
        "Retrieve a specific ERC-8004 receipt by its bytes32 ID. Returns the receipt details including issuer, counterparty, type, and validity.\n" +
        "USE WHEN: You know a receipt ID and want to inspect its full details and on-chain validity.\n" +
        "REQUIRES: The receipt ID must be a valid bytes32 hex string.\n" +
        "RETURNS: Receipt details including issuer, counterparty, interaction type, data hash, validity, and human-readable type label.\n" +
        "COMES AFTER: corven_create_receipt or corven_get_receipts provided the receipt ID.\n" +
        "COMES BEFORE: Use the receipt data to verify agent credentials or audit history.\n" +
        "NOTE: Accepts both raw bytes32 hex IDs and string-to-bytes32 converted IDs.",
      inputSchema: {
        receiptId: z.string().describe("Receipt ID as bytes32 hex string (0x...64 hex chars)"),
      },
    },
    async ({ receiptId }) => {
      try {
        // Validate receiptId format
        const validationResult = getReceiptSchema.safeParse({ receiptId });
        if (!validationResult.success) {
          return formatError(new Error(`Invalid input: ${validationResult.error.issues.map((e: any) => e.message).join(", ")}`));
        }

        // Ensure receiptId is valid bytes32
        let receiptIdBytes32: Hex;
        if (isBytes32(receiptId)) {
          receiptIdBytes32 = receiptId as Hex;
        } else {
          // Try to convert string to bytes32
          receiptIdBytes32 = stringToBytes32(receiptId);
        }

        const data = await readContract(
          CONTRACTS.ReceiptVerifier,
          V2_ABI,
          "getReceipt",
          [receiptIdBytes32]
        );

        const enriched = {
          ...(data as any),
          typeLabel:
            RECEIPT_TYPE[(data as any).interactionType as keyof typeof RECEIPT_TYPE] ??
            `Unknown(${(data as any).interactionType})`,
        };

        return formatReadResult(enriched, `Receipt ${receiptId}`);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_create_receipt
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_create_receipt",
    {
      title: "Create Receipt",
      description:
        "Issue an ERC-8004 attestation receipt for a completed interaction. Only authorized issuers can create receipts.\n" +
        "USE WHEN: You want to create a portable on-chain attestation that proves a specific interaction occurred.\n" +
        "REQUIRES: You must be an authorized issuer. Both issuer and counterparty addresses must be valid.\n" +
        "RETURNS: Transaction hash. The receipt ID (bytes32) is emitted in the event logs.\n" +
        "COMES AFTER: A verifiable interaction occurred (task completion, agent verification, capability proof, etc.).\n" +
        "COMES BEFORE: corven_get_receipt or corven_get_receipts to retrieve the receipt.\n" +
        "NOTE: interactionType values: 0=TaskCompleted, 1=AgentVerified, 2=CapabilityProven, 3=ReputationVerified, 4=DisputeResolved, 5=InsuranceClaimed.",
      inputSchema: {
        issuer: ethAddress,
        counterparty: ethAddress,
        interactionType: z.union([z.number(), z.string()]).describe("Receipt type (0=TaskCompleted, 1=AgentVerified, etc.)"),
        dataHash: z.string().describe("Hash of the receipt data (will be converted to bytes32)"),
      },
    },
    async ({ issuer, counterparty, interactionType, dataHash }) => {
      try {
        const validationResult = createReceiptSchema.safeParse({ issuer, counterparty, interactionType, dataHash });
        if (!validationResult.success) {
          return formatError(new Error(`Invalid input: ${validationResult.error.issues.map((e: any) => e.message).join(", ")}`));
        }

        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured — cannot send transactions"));
        }

        // Convert dataHash to bytes32
        const dataHashBytes32 = stringToBytes32(dataHash);

        const result = await executeOrPrepare(
          CONTRACTS.ReceiptVerifier,
          V2_ABI,
          "createReceipt",
          [issuer as Address, counterparty as Address, String(interactionType), dataHashBytes32]
        );
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
