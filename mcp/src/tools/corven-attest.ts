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
  confirm: z.boolean().optional().default(false).describe('Set to true to execute. Without this, shows what will happen.'),
});

export function registerAttestTools(server: McpServer): void {
  server.registerTool(
    "corven_attest",
    {
      title: "Attestation Manager",
      description:
        "ERC-8004 attestation receipts to prove task completion on-chain.\n\n" +
        "ACTIONS:\n" +
        "  create — Issue an attestation receipt (requires issuer, counterparty, interactionType, dataHash)\n" +
        "  verify — Verify a specific receipt by bytes32 ID (requires receiptId)\n" +
        "  batch — List all receipts for an address (requires address)\n" +
        "  get — Get receipt count for an address\n\n" +
        "TYPES: 0=TaskCompleted, 1=AgentVerified, 2=CapabilityProven, 3=ReputationVerified, 4=DisputeResolved, 5=InsuranceClaimed\n" +
        "NOTE: Attestation system needs on-chain deployment for V5.",
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
