/**
 * corven_attest — Receipts and attestations
 *
 * Consolidates: corven_create_receipt, corven_get_receipt,
 *               corven_get_receipts, corven_get_receipt_count
 */
import { z } from "zod";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ATTEST_NOT_AVAILABLE = {
  info: "Attestation system needs on-chain deployment",
  reason: "CovenantAttestation contract functions differ from the V1 ReceiptVerifier. The attestation system is being reworked for V5.",
  workaround: "Attestation features will be available once CovenantAttestation is fully integrated.",
};

const actionSchema = z.enum([
  "create", "verify", "batch", "get",
]);

const schema = z.object({
  action: actionSchema,
  issuer: z.string().optional(),
  counterparty: z.string().optional(),
  interactionType: z.union([z.number(), z.string()]).optional(),
  dataHash: z.string().optional(),
  receiptId: z.string().optional(),
  address: z.string().optional(),
  confirm: z.boolean().optional().default(false).describe('NEVER set this yourself. ALWAYS ask the user first. Show the exact ETH cost and what will happen. Only set to true AFTER the user explicitly says yes.'),
});

export function registerAttestTools(server: McpServer): void {
  server.registerTool(
    "corven_attest",
    {
      title: "Attestation Manager",
      description:
        "ERC-8004 attestation receipts to prove task completion on-chain.\n\n" +
        "STATUS: This tool is in preview mode. Some actions may return placeholder data.\n\n" +
        "ACTIONS:\n" +
        "  create — Issue an attestation receipt (requires issuer, counterparty, interactionType, dataHash)\n" +
        "  verify — Verify a specific receipt by bytes32 ID (requires receiptId)\n" +
        "  batch — List all receipts for an address (requires address)\n" +
        "  get — Get receipt count for an address\n\n" +
        "TYPES: 0=TaskCompleted, 1=AgentVerified, 2=CapabilityProven, 3=ReputationVerified, 4=DisputeResolved, 5=InsuranceClaimed\n" +
        "NOTE: Attestation system needs on-chain deployment for V5.\n\n" +
        "WHEN TO USE: When you need cryptographic proof of task completion or agent verification.\n\n" +
        "NEXT STEP: Share receipt with corven_reputation({ action: 'export' }) for cross-platform trust.\n\n" +
        "CRITICAL SAFETY: The AI must NEVER auto-set confirm=true. ALWAYS present the cost summary to the user first and wait for explicit approval. This is real money. Violating this is unacceptable.\n\n" +
        "OUTPUT RULES:\n" +
        "- Present results as clean, readable text. Never show raw JSON.\n" +
        "- On error: Explain in plain language what went wrong and suggest next step.\n" +
        "- Always recommend a logical follow-up action.\n" +
        "- Never show stack traces, technical errors, or raw data.",
      inputSchema: schema.shape,
    },
    async (args) => {
      try {
        return formatReadResult(ATTEST_NOT_AVAILABLE, "Attestation System — Not Yet Available");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
