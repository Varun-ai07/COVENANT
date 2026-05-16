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
import { RECEIPT_TYPE } from "../types.js";
import { stringToBytes32, isBytes32 } from "../utils.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("ReceiptVerifier");

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
        "Fetch all ERC-8004 attestation receipts for an address. " +
        "Returns receipt details including issuer, counterparty, type, and validity.",
      inputSchema: {
        address: z.string().describe("Ethereum address to look up receipts for"),
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
          ABI,
          "getReceiptsByAgent",
          [validationResult.data.address as Address]
        );

        return formatReadResult(
          { address, receipts: data },
          `Receipts for ${address}`
        );
      } catch (e) {
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // get_receipt_count
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_receipt_count",
    {
      title: "Get Receipt Count for Address",
      description:
        "Get the total number of ERC-8004 receipts issued for an agent address. " +
        "Use this to check receipt volume before querying individual receipts.",
      inputSchema: {
        address: z.string().describe("Agent's Ethereum address"),
      },
    },
    async ({ address }) => {
      try {
        const validationResult = getAddressSchema.safeParse({ address });
        if (!validationResult.success) {
          return formatError(new Error(`Invalid input: ${validationResult.error.issues.map((e: any) => e.message).join(", ")}`));
        }

        const count = await readContract(
          CONTRACTS.ReceiptVerifier,
          ABI,
          "getAgentReceiptCount",
          [validationResult.data.address as Address]
        );
        return formatReadResult(
          { address, receiptCount: Number(count) },
          `Receipt count for ${address}`
        );
      } catch (e) {
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // get_receipt (was verify_receipt)
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_receipt",
    {
      title: "Get Receipt by ID",
      description:
        "Retrieve a specific ERC-8004 receipt by its bytes32 ID. " +
        "Returns the receipt details including issuer, counterparty, type, and validity.",
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
          ABI,
          "getReceipt",
          [receiptIdBytes32]
        );

        const enriched = {
          ...(data as any),
          typeLabel:
            RECEIPT_TYPE[(data as any).interactionType] ??
            `Unknown(${(data as any).interactionType})`,
        };

        return formatReadResult(enriched, `Receipt ${receiptId}`);
      } catch (e) {
        return formatError(e);
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
        "Issue an ERC-8004 attestation receipt for a completed interaction. " +
        "Only authorized issuers can create receipts.",
      inputSchema: {
        issuer: z.string().describe("Issuer's Ethereum address"),
        counterparty: z.string().describe("Counterparty's Ethereum address"),
        interactionType: z.number().describe("Receipt type (0=TaskCompleted, 1=AgentVerified, etc.)"),
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
          ABI,
          "createReceipt",
          [issuer as Address, counterparty as Address, String(interactionType), dataHashBytes32]
        );
        return formatTxResult(result);
      } catch (e) {
        return formatError(e);
      }
    }
  );
}
