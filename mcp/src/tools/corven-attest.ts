/**
 * corven_attest — Receipts and attestations
 *
 * Consolidates: corven_create_receipt, corven_get_receipt,
 *               corven_get_receipts, corven_get_receipt_count
 */
import { z } from "zod";
import { type Address, type Hex } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import { stringToBytes32, isBytes32 } from "../utils.js";
import { RECEIPT_TYPE } from "../types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("ReceiptVerifier");

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
        "WORKFLOW: Complete interaction → create receipt → verify on-chain later",
      inputSchema: schema.shape,
    },
    async (args) => {
      try {
        const { action } = args;

        if (action === "create") {
          if (!args.issuer || !args.counterparty || args.interactionType === undefined || !args.dataHash) {
            return formatStructuredError("Missing required fields.", "create requires issuer, counterparty, interactionType, and dataHash.", "Provide all four parameters.", false);
          }
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Create attestation receipt",
              cost: "Gas only",
              reason: "Issues ERC-8004 attestation on-chain",
              toProceed: "Call corven_attest again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const dataHashBytes32 = stringToBytes32(args.dataHash);
          const result = await executeOrPrepare(
            CONTRACTS.ReceiptVerifier, ABI, "createReceipt",
            [args.issuer as Address, args.counterparty as Address, String(args.interactionType), dataHashBytes32],
            0n
          );
          return formatTxResult(result);
        }

        if (action === "verify") {
          if (!args.receiptId) {
            return formatStructuredError("Missing required field.", "verify requires receiptId.", "Provide a bytes32 receipt ID.", false);
          }
          let receiptIdBytes32: Hex;
          if (isBytes32(args.receiptId)) {
            receiptIdBytes32 = args.receiptId as Hex;
          } else {
            receiptIdBytes32 = stringToBytes32(args.receiptId);
          }
          const data = await readContract(CONTRACTS.ReceiptVerifier, ABI, "getReceipt", [receiptIdBytes32]);
          const enriched = {
            ...(data as any),
            typeLabel: RECEIPT_TYPE[(data as any).interactionType as keyof typeof RECEIPT_TYPE] ?? `Unknown(${(data as any).interactionType})`,
          };
          return formatReadResult(enriched, `Receipt Verified`);
        }

        if (action === "batch") {
          if (!args.address) {
            return formatStructuredError("Missing required field.", "batch requires address.", "Provide the address to look up receipts for.", false);
          }
          const data = await readContract(CONTRACTS.ReceiptVerifier, ABI, "getReceiptsByAgent", [args.address as Address]);
          return formatReadResult({ address: args.address, receipts: data, count: Array.isArray(data) ? data.length : 0 }, `Receipts for ${args.address}`);
        }

        if (action === "get") {
          const count = await readContract(CONTRACTS.ReceiptVerifier, ABI, "receiptCounter", []);
          return formatReadResult({ totalReceipts: Number(count) }, "Receipt Count");
        }

        return formatReadResult({ error: "Unknown action" }, "Error");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
