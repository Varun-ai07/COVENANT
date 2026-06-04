/**
 * Attestation & ERC-8004 Verification MCP Tools
 *
 * Exposes on-chain ERC-8004 receipt verification and batch attestation tools.
 * ZK proof verification (Groth16) has been removed — capabilities are verified
 * via on-chain agent registry lookups and ERC-8004 attestations instead.
 */
import { z } from "zod";
import { isAddress, type Address } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult, formatError } from "../handlers/transactions.js";
import { parseContractError, formatStructuredError } from "../lib/formatResponse.js";
import { ethAddress } from "../lib/schemaHelpers.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const RECEIPT_ABI = loadAbi("ReceiptVerifier");

// ─── Input Schemas ─────────────────────────────────────────────────

const createAttestationSchema = z.object({
  counterparty: z.string().refine(isAddress, { message: "Invalid address" }).describe("Counterparty address"),
  interactionType: z.number().int().min(0).max(5).describe("Receipt type (0=TaskCompleted, 1=AgentVerified, 2=CapabilityProven, 3=ReputationVerified, 4=DisputeResolved, 5=InsuranceClaimed)"),
  dataHash: z.string().min(1).describe("Hash of the attestation data"),
});

const verifyReceiptSchema = z.object({
  receiptId: z.string().min(1).describe("Receipt ID (bytes32 hex)"),
});

const batchVerifySchema = z.object({
  receiptIds: z.array(z.string()).min(1).max(50).describe("Receipt IDs to verify"),
});

// ─── Tool Registration ─────────────────────────────────────────────

export function registerVerificationTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // corven_create_attestation
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_create_attestation",
    {
      title: "Create ERC-8004 Attestation",
      description:
        "Issue an ERC-8004 attestation receipt for a completed interaction. Anchors offchain verification results on-chain as portable credentials.\n" +
        "USE WHEN: You want to anchor an off-chain verification result (capability proof, reputation check, etc.) as a permanent on-chain attestation.\n" +
        "REQUIRES: You must have a wallet configured. The counterparty address must be valid.\n" +
        "RETURNS: Transaction hash. The attestation receipt ID is emitted in the event logs.\n" +
        "COMES AFTER: corven_verify_capability_proof or corven_verify_reputation_proof completed successfully.\n" +
        "COMES BEFORE: The receipt can be queried via ReceiptVerifier tools for portable verification.\n" +
        "NOTE: interactionType values: 0=TaskCompleted, 1=AgentVerified, 2=CapabilityProven, 3=ReputationVerified, 4=DisputeResolved, 5=InsuranceClaimed.",
      inputSchema: {
        counterparty: ethAddress,
        interactionType: z.number().describe("Receipt type (0=TaskCompleted, 1=AgentVerified, etc.)"),
        dataHash: z.string().describe("Hash of the attestation data"),
      },
    },
    async (params) => {
      try {
        const parsed = createAttestationSchema.safeParse(params);
        if (!parsed.success) return formatError(parsed.error);

        const { counterparty, interactionType, dataHash } = parsed.data;
        const account = getAccount();
        if (!account) return formatError(new Error("No wallet configured."));

        const result = await executeOrPrepare(
          CONTRACTS.ReceiptVerifier as Address,
          RECEIPT_ABI,
          "createReceipt",
          [account as Address, counterparty as Address, String(interactionType), dataHash as `0x${string}`]
        );

        return formatTxResult(result);
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_verify_attestation
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_verify_attestation",
    {
      title: "Verify Attestation",
      description:
        "Check if an ERC-8004 receipt is valid on-chain.\n" +
        "USE WHEN: You have a receipt ID and want to verify its on-chain validity and authenticity.\n" +
        "REQUIRES: The receipt ID must be a valid bytes32 hex string.\n" +
        "RETURNS: Boolean validity status with a human-readable note explaining the result.\n" +
        "COMES AFTER: corven_create_attestation or corven_create_receipt issued the receipt.\n" +
        "COMES BEFORE: Use the validity result to make trust decisions about an agent.\n" +
        "NOTE: Returns false for revoked receipts or receipts that never existed.",
      inputSchema: {
        receiptId: z.string().describe("Receipt ID (bytes32 hex)"),
      },
    },
    async (params) => {
      try {
        const parsed = verifyReceiptSchema.safeParse(params);
        if (!parsed.success) return formatError(parsed.error);

        const result = await readContract(
          CONTRACTS.ReceiptVerifier as Address,
          RECEIPT_ABI,
          "verifyReceipt",
          [parsed.data.receiptId as `0x${string}`]
        );

        return formatReadResult({
          receiptId: parsed.data.receiptId,
          isValid: result,
          note: result ? "Receipt is valid and verified on-chain." : "Receipt is invalid or has been revoked.",
        }, "Attestation Verification");
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_batch_verify_attestations
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_batch_verify_attestations",
    {
      title: "Batch Verify Attestations",
      description:
        "Verify multiple ERC-8004 receipts in a single call.\n" +
        "USE WHEN: You have multiple receipt IDs and want to check their validity efficiently in one transaction.\n" +
        "REQUIRES: All receipt IDs must be valid bytes32 hex strings. Max 50 receipts per call.\n" +
        "RETURNS: Summary with total, valid, and invalid counts, plus per-receipt validity status.\n" +
        "COMES AFTER: corven_get_receipts or corven_create_receipt provided the receipt IDs.\n" +
        "COMES BEFORE: Use the batch validity results for bulk credential auditing.\n" +
        "NOTE: More gas-efficient than calling corven_verify_attestation individually for each receipt.",
      inputSchema: {
        receiptIds: z.array(z.string()).describe("Receipt IDs to verify"),
      },
    },
    async (params) => {
      try {
        const parsed = batchVerifySchema.safeParse(params);
        if (!parsed.success) return formatError(parsed.error);

        const results = await readContract(
          CONTRACTS.ReceiptVerifier as Address,
          RECEIPT_ABI,
          "batchVerifyReceipts",
          [parsed.data.receiptIds as `0x${string}`[]]
        );

        const validity = results as boolean[];
        const summary = parsed.data.receiptIds.map((id, i) =>
          `${id.slice(0, 18)}...: ${validity[i] ? "VALID" : "INVALID"}`
        ).join("\n");

        return formatReadResult({
          total: parsed.data.receiptIds.length,
          valid: validity.filter(Boolean).length,
          invalid: validity.filter(v => !v).length,
          results: summary,
        }, "Batch Verification");
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
