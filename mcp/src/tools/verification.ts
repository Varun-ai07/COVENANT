/**
 * Capability & Reputation Verification MCP Tools
 *
 * Exposes the deployed ZK verifier contracts (CapabilityVerifier, ReputationVerifier)
 * and the ERC-8004 receipt system for on-chain attestation anchoring.
 */
import { z } from "zod";
import { isAddress, type Address, keccak256, toBytes } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult, formatError } from "../handlers/transactions.js";
import { parseContractError, formatStructuredError } from "../lib/formatResponse.js";
import { ethAddress } from "../lib/schemaHelpers.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const REGISTRY_ABI = loadAbi("AgentRegistry");
const CAPABILITY_VERIFIER_ABI = loadAbi("CapabilityVerifier");
const REPUTATION_VERIFIER_ABI = loadAbi("ReputationVerifier");
const RECEIPT_ABI = loadAbi("ReceiptVerifier");

// ─── Input Schemas ─────────────────────────────────────────────────

const verifyCapabilitySchema = z.object({
  agent: z.string().refine(isAddress, { message: "Invalid agent address" }).describe("Agent address to verify"),
  capability: z.string().min(1).max(50).describe("Capability to verify (e.g. 'python', 'security')"),
  proof: z.string().min(1).describe("ZK proof data (hex-encoded)"),
  publicSignals: z.array(z.string()).min(1).describe("Public signals for the proof"),
});

const verifyReputationSchema = z.object({
  agent: z.string().refine(isAddress, { message: "Invalid agent address" }).describe("Agent address"),
  threshold: z.number().int().min(0).max(1000).describe("Minimum reputation threshold to verify"),
  proof: z.string().min(1).describe("ZK proof data (hex-encoded)"),
  publicSignals: z.array(z.string()).min(1).describe("Public signals for the proof"),
});

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
  // corven_verify_capability_proof
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_verify_capability_proof",
    {
      title: "Verify Capability Proof",
      description:
        "Verify a ZK proof that an agent possesses a specific capability. Uses the deployed Groth16 verifier. On-chain verification with cryptographic guarantee.\n" +
        "USE WHEN: You need to cryptographically verify that an agent has a claimed capability without trusting their self-report.\n" +
        "REQUIRES: A valid ZK proof generated off-chain for the capability. The agent must be registered.\n" +
        "RETURNS: Transaction hash. The verification result is stored on-chain.\n" +
        "COMES AFTER: The agent generated a ZK proof off-chain using their capability credentials.\n" +
        "COMES BEFORE: Use the verification result in task assignment decisions or reputation checks.\n" +
        "NOTE: Uses Groth16 proof system. The proof is verified on-chain with zero knowledge — the capability details remain private.",
      inputSchema: {
        agent: ethAddress,
        capability: z.string().describe("Capability to verify (e.g. 'python', 'security')"),
        proof: z.string().describe("ZK proof data (hex-encoded)"),
        publicSignals: z.array(z.string()).describe("Public signals for the proof"),
      },
    },
    async (params) => {
      try {
        const parsed = verifyCapabilitySchema.safeParse(params);
        if (!parsed.success) return formatError(parsed.error);

        const { agent, capability, proof, publicSignals } = parsed.data;
        const account = getAccount();
        if (!account) return formatError(new Error("No wallet configured."));

        // Call the capability verifier contract
        const proofHash = keccak256(toBytes(proof));

        const result = await executeOrPrepare(
          CONTRACTS.AgentRegistry as Address,
          REGISTRY_ABI,
          "verifyCapabilityProof",
          [agent as Address, capability, proof, publicSignals]
        );

        return formatTxResult(result);
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_verify_reputation_proof
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_verify_reputation_proof",
    {
      title: "Verify Reputation Proof",
      description:
        "Verify a ZK proof that an agent's reputation meets a threshold without revealing the exact score. On-chain verification.\n" +
        "USE WHEN: You need to verify an agent meets a minimum reputation score for task eligibility without learning their exact score.\n" +
        "REQUIRES: A valid ZK proof generated off-chain. The agent must be registered with a reputation score.\n" +
        "RETURNS: Transaction hash. The verification result is stored on-chain.\n" +
        "COMES AFTER: The agent generated a ZK reputation proof off-chain.\n" +
        "COMES BEFORE: Task assignment based on verified reputation thresholds.\n" +
        "NOTE: Zero-knowledge — proves the score is above the threshold without revealing the exact value.",
      inputSchema: {
        agent: ethAddress,
        threshold: z.number().describe("Minimum reputation threshold (0-1000)"),
        proof: z.string().describe("ZK proof data (hex-encoded)"),
        publicSignals: z.array(z.string()).describe("Public signals for the proof"),
      },
    },
    async (params) => {
      try {
        const parsed = verifyReputationSchema.safeParse(params);
        if (!parsed.success) return formatError(parsed.error);

        const { agent, threshold, proof, publicSignals } = parsed.data;

        const result = await executeOrPrepare(
          CONTRACTS.ReputationVerifier as Address,
          REPUTATION_VERIFIER_ABI,
          "verifyReputation",
          [agent as Address, BigInt(threshold), proof, publicSignals]
        );

        return formatTxResult(result);
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

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
