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
import { loadStore, saveStore } from "../lib/store.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface BatchTaskStatus {
  taskId: number;
  status: string;
  score: number;
}

interface BatchStatusRecord {
  tasks: BatchTaskStatus[];
  createdAt: number;
  completedAt: number | null;
  cancelled: boolean;
}

const ABI = loadAbi("ParallelTaskBatch");

const BATCH_STATUS: Record<number, string> = {
  0: "Pending",
  1: "InProgress",
  2: "Aggregated",
  3: "Completed",
  4: "Failed",
};

const actionSchema = z.enum([
  "create", "submit", "verify", "get", "check", "progress", "cancel",
]);

const schema = z.object({
  action: actionSchema,
  batchId: z.number().optional(),
  workers: z.array(z.string()).optional(),
  payments: z.array(z.string()).optional(),
  deadlines: z.array(z.number()).optional(),
  descriptionHashes: z.array(z.string()).optional(),
  aggregationSpec: z.string().optional(),
  confirm: z.boolean().optional().default(false).describe('NEVER set this yourself. ALWAYS ask the user first. Show the exact ETH cost and what will happen. Only set to true AFTER the user explicitly says yes.'),
});

export function registerBatchTools(server: McpServer): void {
  server.registerTool(
    "corven_batch",
    {
      title: "Batch Manager",
      description:
        "Run multiple tasks in parallel via COVENANT batches — create, submit, and aggregate results.\n\n" +
        "ACTIONS:\n" +
        "  create — Create a batch of parallel tasks (workers, payments, deadlines, descriptionHashes, aggregationSpec)\n" +
        "  submit — Worker submits deliverable for a batch subtask\n" +
        "  verify — Finalize batch by aggregating all results (requires batchId)\n" +
        "  get — Get batch details or total count (pass batchId for details, omit for count)\n" +
        "  check — Check if all subtasks are submitted (requires batchId)\n" +
        "  progress — Get real-time batch progress with per-task status (requires batchId)\n" +
        "  cancel — Mark a batch as cancelled (requires batchId)\n\n" +
        "WORKFLOW: create → workers execute → check (all submitted?) → verify (aggregate)\n" +
        "FEE: 1% protocol fee per subtask. Max 50 workers per batch.\n\n" +
        "WHEN TO USE: When you need to execute multiple related tasks in parallel and aggregate results.\n\n" +
        "NEXT STEP: After workers complete, verify the batch with corven_batch({ action: 'verify' })\n\n" +
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
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Create batch of " + args.workers.length + " parallel tasks",
              cost: formatEther(totalPayment) + " ETH total",
              reason: "Total payment locked in escrow for all workers",
              toProceed: "Call corven_batch again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
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
          const batchStatusStore = loadStore<Record<string, BatchStatusRecord>>("batch_status", {});
          const txResult = result as any;
          const newBatchId = txResult?.batchId ?? txResult?.receipt?.blockNumber?.toString() ?? String(Object.keys(batchStatusStore).length);
          batchStatusStore[newBatchId] = {
            tasks: args.workers.map((_: string, i: number) => ({
              taskId: i,
              status: "pending",
              score: 0,
            })),
            createdAt: Date.now(),
            completedAt: null,
            cancelled: false,
          };
          saveStore("batch_status", batchStatusStore);
          return formatTxResult(result);
        }

        if (action === "submit") {
          if (args.batchId === undefined) {
            return formatStructuredError("Missing required field.", "submit requires batchId.", "Provide the batchId.", false);
          }
          const batchStatusStore = loadStore<Record<string, BatchStatusRecord>>("batch_status", {});
          const rec = batchStatusStore[String(args.batchId)];
          if (rec && !rec.cancelled) {
            const pendingTask = rec.tasks.find(t => t.status === "pending");
            if (pendingTask) {
              pendingTask.status = "submitted";
            }
            saveStore("batch_status", batchStatusStore);
          }
          return formatReadResult({
            info: "Batch subtask submission is not available in V5 ParallelTaskBatch.",
            reason: "V5 batches use createBatch + aggregateResults. Individual subtask submission is handled differently.",
            batchId: args.batchId,
            trackedStatus: rec ? rec.tasks.map(t => ({ taskId: t.taskId, status: t.status })) : null,
          }, "Batch Submit — Not Available");
        }

        if (action === "verify") {
          if (args.batchId === undefined) {
            return formatStructuredError("Missing required field.", "verify requires batchId.", "Provide the batchId.", false);
          }
          const batchStatusStore = loadStore<Record<string, BatchStatusRecord>>("batch_status", {});
          const rec = batchStatusStore[String(args.batchId)];
          if (rec && !rec.cancelled) {
            rec.tasks.forEach(t => {
              t.status = "completed";
              t.score = 100;
            });
            rec.completedAt = Date.now();
            saveStore("batch_status", batchStatusStore);
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
          const data = await readContract(CONTRACTS.ParallelTaskBatch, ABI, "getBatch", [BigInt(args.batchId)]);
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
          const batch = await readContract(CONTRACTS.ParallelTaskBatch, ABI, "getBatch", [BigInt(args.batchId)]);
          const status = BATCH_STATUS[(batch as any).status] ?? "Unknown";
          return formatReadResult({ batchId: args.batchId, status, allSubmitted: status === "Completed" || status === "Aggregated" }, `Batch #${args.batchId} Status`);
        }

        if (action === "progress") {
          if (args.batchId === undefined) {
            return formatStructuredError("Missing required field.", "progress requires batchId.", "Provide the batchId.", false);
          }
          const batchStatusStore = loadStore<Record<string, BatchStatusRecord>>("batch_status", {});
          const rec = batchStatusStore[String(args.batchId)];
          if (!rec) {
            return formatStructuredError("Batch not found.", "No tracked status for batch " + args.batchId, "Ensure the batch was created via corven_batch create.", false);
          }
          const completed = rec.tasks.filter(t => t.status === "completed").length;
          const total = rec.tasks.length;
          return formatReadResult({
            batchId: args.batchId,
            cancelled: rec.cancelled,
            completed,
            total,
            percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
            createdAt: new Date(rec.createdAt).toISOString(),
            completedAt: rec.completedAt ? new Date(rec.completedAt).toISOString() : null,
            tasks: rec.tasks.map(t => ({ taskId: t.taskId, status: t.status, score: t.score })),
          }, `Batch #${args.batchId} Progress`);
        }

        if (action === "cancel") {
          if (args.batchId === undefined) {
            return formatStructuredError("Missing required field.", "cancel requires batchId.", "Provide the batchId.", false);
          }
          const batchStatusStore = loadStore<Record<string, BatchStatusRecord>>("batch_status", {});
          const rec = batchStatusStore[String(args.batchId)];
          if (!rec) {
            return formatStructuredError("Batch not found.", "No tracked status for batch " + args.batchId, "Ensure the batch was created via corven_batch create.", false);
          }
          if (rec.cancelled) {
            return formatReadResult({ batchId: args.batchId, alreadyCancelled: true }, `Batch #${args.batchId} Already Cancelled`);
          }
          rec.cancelled = true;
          rec.tasks.forEach(t => { t.status = "cancelled"; });
          saveStore("batch_status", batchStatusStore);
          return formatReadResult({
            batchId: args.batchId,
            cancelled: true,
            tasks: rec.tasks.map(t => ({ taskId: t.taskId, status: t.status })),
          }, `Batch #${args.batchId} Cancelled`);
        }

        return formatReadResult({ error: "Unknown action" }, "Error");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
