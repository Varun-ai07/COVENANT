/**
 * CovenantAttestation MCP Tools
 *
 * corven_create_attestation    — Issue an on-chain attestation
 * corven_verify_attestation    — Verify an attestation's validity
 * corven_batch_verify_attestations — Batch verify multiple attestations
 */
import { z } from "zod";
import { isAddress, type Address } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult, formatError } from "../handlers/transactions.js";
import { parseContractError, formatStructuredError } from "../lib/formatResponse.js";
import { ethAddress } from "../lib/schemaHelpers.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ATTESTATION_ABI = loadAbi("ReceiptVerifier");

const createAttestationSchema = z.object({
  subject: z.string().refine(isAddress, { message: "Invalid address" }).describe("Address of the attestation subject"),
  schemaHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid bytes32 hex").describe("Schema hash (bytes32)"),
  dataHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid bytes32 hex").describe("Hash of attestation data (bytes32)"),
  expiresAt: z.number().int().min(0).optional().describe("Expiry timestamp (uint32). 0 or omitted = no expiry."),
});

const verifyAttestationSchema = z.object({
  attestationId: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid bytes32 hex").describe("Attestation ID (bytes32)"),
});

const batchVerifySchema = z.object({
  attestationIds: z.array(z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid bytes32 hex")).min(1).max(50).describe("Attestation IDs to verify"),
});

export function registerVerificationTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // corven_create_attestation
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_create_attestation",
    {
      title: "Create Attestation",
      description:
        "Issue an on-chain attestation for a subject address. Anchors verification results as portable credentials.\n" +
        "USE WHEN: You want to attest to a capability, reputation, or verification result for an agent.\n" +
        "REQUIRES: You must have a wallet configured. Subject address must be valid. Schema must be registered.\n" +
        "RETURNS: Transaction hash. The attestation ID is emitted in the event logs.\n" +
        "COMES AFTER: Verification or reputation checks completed successfully.\n" +
        "COMES BEFORE: The attestation can be queried via corven_verify_attestation for portable verification.\n" +
        "NOTE: Register schemas first via registerSchema. expiresAt=0 means no expiry.",
      inputSchema: {
        subject: ethAddress,
        schemaHash: z.string().describe("Schema hash (bytes32 hex)"),
        dataHash: z.string().describe("Data hash (bytes32 hex)"),
        expiresAt: z.number().optional().describe("Expiry timestamp (uint32). 0 = no expiry."),
      },
    },
    async (params) => {
      try {
        const parsed = createAttestationSchema.safeParse(params);
        if (!parsed.success) return formatError(parsed.error);

        const { subject, schemaHash, dataHash, expiresAt } = parsed.data;
        const account = getAccount();
        if (!account) return formatError(new Error("No wallet configured."));

        const result = await executeOrPrepare(
          CONTRACTS.ReceiptVerifier as Address,
          ATTESTATION_ABI,
          "attest",
          [
            subject as Address,
            schemaHash as `0x${string}`,
            dataHash as `0x${string}`,
            expiresAt ?? 0,
          ]
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
        "Check if an attestation is valid on-chain.\n" +
        "USE WHEN: You have an attestation ID and want to verify its on-chain validity and authenticity.\n" +
        "REQUIRES: The attestation ID must be a valid bytes32 hex string.\n" +
        "RETURNS: Boolean validity status with full attestation details (subject, schemaHash, dataHash, expiresAt).\n" +
        "COMES AFTER: corven_create_attestation issued the attestation.\n" +
        "COMES BEFORE: Use the validity result to make trust decisions about an agent.\n" +
        "NOTE: Returns false for revoked attestations or attestations that never existed.",
      inputSchema: {
        attestationId: z.string().describe("Attestation ID (bytes32 hex)"),
      },
    },
    async (params) => {
      try {
        const parsed = verifyAttestationSchema.safeParse(params);
        if (!parsed.success) return formatError(parsed.error);

        const result = await readContract(
          CONTRACTS.ReceiptVerifier as Address,
          ATTESTATION_ABI,
          "verify",
          [parsed.data.attestationId as `0x${string}`]
        );

        const [valid, attestation] = result as [boolean, any];
        const enriched = valid ? {
          attestationId: parsed.data.attestationId,
          valid: true,
          subject: attestation.subject,
          schemaHash: attestation.schemaHash,
          dataHash: attestation.dataHash,
          expiresAt: attestation.expiresAt,
          note: "Attestation is valid and verified on-chain.",
        } : {
          attestationId: parsed.data.attestationId,
          valid: false,
          note: "Attestation is invalid, expired, or has been revoked.",
        };

        return formatReadResult(enriched, "Attestation Verification");
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
        "Verify multiple attestations in a single call.\n" +
        "USE WHEN: You have multiple attestation IDs and want to check their validity efficiently.\n" +
        "REQUIRES: All attestation IDs must be valid bytes32 hex strings. Max 50 per call.\n" +
        "RETURNS: Summary with total, valid, and invalid counts, plus per-attestation validity status.\n" +
        "COMES AFTER: corven_create_attestation or corven_get_agent_attestations provided the IDs.\n" +
        "COMES BEFORE: Use the batch validity results for bulk credential auditing.\n" +
        "NOTE: More gas-efficient than calling corven_verify_attestation individually for each attestation.",
      inputSchema: {
        attestationIds: z.array(z.string()).describe("Attestation IDs to verify (bytes32 hex)"),
      },
    },
    async (params) => {
      try {
        const parsed = batchVerifySchema.safeParse(params);
        if (!parsed.success) return formatError(parsed.error);

        const results = await readContract(
          CONTRACTS.ReceiptVerifier as Address,
          ATTESTATION_ABI,
          "verify",
          [parsed.data.attestationIds as `0x${string}`[]]
        );

        const validity = results as boolean[];
        const summary = parsed.data.attestationIds.map((id, i) =>
          `${id.slice(0, 18)}...: ${validity[i] ? "VALID" : "INVALID"}`
        ).join("\n");

        return formatReadResult({
          total: parsed.data.attestationIds.length,
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
