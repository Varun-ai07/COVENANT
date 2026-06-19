/**
 * corven_batch — Parallel task batches
 *
 * Consolidates: corven_create_batch, corven_aggregate_results,
 *               corven_get_batch, corven_get_batch_status,
 *               corven_check_batch_submitted, corven_get_aggregated_result
 */
import { z } from "zod";
import { parseEther, formatEther, type Address, isAddress } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import { stringToBytes32, stringsToBytes32 } from "../utils.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("ParallelTaskBatch");

const BATCH_STATUS: Record<number, string> = {
  0: "Pending",
  1: "InProgress",
  2: "Aggregated",
  3: "Completed",
  4: "Failed",
};

const actionSchema = z.enum([
  "create", "submit", "verify", "get", "check",
]);

const schema = z.object({
  action: actionSchema,
  batchId: z.number().optional(),
  workers: z.array(z.string()).optional(),
  payments: z.array(z.string()).optional(),
  deadlines: z.array(z.number()).optional(),
  descriptionHashes: z.array(z.string()).optional(),
  aggregationSpec: z.string().optional(),
});

export function registerBatchTools(server: McpServer): void {
  server.registerTool(
    "corven_batch",
    {
      title: "Batch Manager",
      description:
        "Run multiple tasks in parallel via COVENANT batches.\n\n" +
        "ACTIONS:\n" +
        "  create — Create a batch of parallel tasks (requires workers, payments, deadlines, descriptionHashes, aggregationSpec)\n" +
        "  submit — Worker submits deliverable for a batch subtask\n" +
        "  verify — Finalize batch by aggregating all results (requires batchId)\n" +
        "  get — Get batch details or total count (pass batchId for details, omit for count)\n" +
        "  check — Check if all subtasks are submitted (requires batchId)\n\n" +
        "WORKFLOW: create → workers execute → check (all submitted?) → verify (aggregate)\n" +
        "FEE: 1% protocol fee per subtask. Max 50 workers per batch.",
      inputSchema: schema.shape,
    },
    async (args) => {
      try {
        const { action } = args;

        if (action === "create") {
          if (!args.workers || !args.payments || !args.deadlines || !args.descriptionHashes || !args.aggregationSpec) {
            return formatStructuredError("Missing required fields.", "create requires workers, payments, deadlines, descriptionHashes, and aggregationSpec.", "Provide all five parameters as arrays of equal length.", false);
          }
          if (args.workers.length !== args.payments.length || args.workers.length !== args.deadlines.length || args.workers.length !== args.descriptionHashes.length) {
            return formatStructuredError("Array length mismatch.", "All arrays must have the same length.", "Ensure workers, payments, deadlines, and descriptionHashes arrays are all the same size.", false);
          }
          const paymentsWei = args.payments.map(p => parseEther(p));
          const totalPayment = paymentsWei.reduce((sum, p) => sum + p, 0n);
          const descBytes32 = stringsToBytes32(args.descriptionHashes);
          const aggBytes32 = stringToBytes32(args.aggregationSpec);

          const result = await executeOrPrepare(
            CONTRACTS.ParallelTaskBatch, ABI, "createBatch",
            [
              args.workers as Address[],
              paymentsWei,
              args.deadlines.map(BigInt),
              descBytes32,
              aggBytes32,
            ],
            totalPayment
          );
          return formatTxResult(result);
        }

        if (action === "submit") {
          if (args.batchId === undefined) {
            return formatStructuredError("Missing required field.", "submit requires batchId.", "Provide the batchId.", false);
          }
          const result = await executeOrPrepare(
            CONTRACTS.ParallelTaskBatch, ABI, "submitSubtask",
            [BigInt(args.batchId)],
            0n
          );
          return formatTxResult(result);
        }

        if (action === "verify") {
          if (args.batchId === undefined) {
            return formatStructuredError("Missing required field.", "verify requires batchId.", "Provide the batchId.", false);
          }
          const result = await executeOrPrepare(
            CONTRACTS.ParallelTaskBatch, ABI, "aggregateResults",
            [BigInt(args.batchId)],
            0n
          );
          return formatTxResult(result);
        }

        if (action === "get") {
          if (args.batchId === undefined) {
            const count = await readContract(CONTRACTS.ParallelTaskBatch, ABI, "batchCounter", []);
            return formatReadResult({ totalBatches: Number(count) }, "Batch Count");
          }
          const data = await readContract(CONTRACTS.ParallelTaskBatch, ABI, "getBatchDetails", [BigInt(args.batchId)]);
          const enriched = {
            client: (data as any).client,
            totalBudgetEth: formatEther((data as any).totalBudget),
            taskIds: (data as any).taskIds.map((id: bigint) => Number(id)),
            aggregationSpec: (data as any).aggregationSpec,
            statusLabel: BATCH_STATUS[(data as any).status] ?? "Unknown",
            createdAt: (data as any).createdAt,
          };
          return formatReadResult(enriched, `Batch #${args.batchId}`);
        }

        if (action === "check") {
          if (args.batchId === undefined) {
            return formatStructuredError("Missing required field.", "check requires batchId.", "Provide the batchId.", false);
          }
          const allSubmitted = await readContract(
            CONTRACTS.ParallelTaskBatch, ABI, "areAllSubtasksSubmitted", [BigInt(args.batchId)]
          );
          return formatReadResult({ batchId: args.batchId, allSubmitted }, `Batch #${args.batchId} Status`);
        }

        return formatReadResult({ error: "Unknown action" }, "Error");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
