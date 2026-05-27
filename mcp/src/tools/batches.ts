/**
 * ParallelTaskBatch MCP Tools
 *
 * create_batch      — Create a batch of parallel tasks
 * get_batch         — Get batch details by ID
 * get_batch_status  — Get current batch status
 * aggregate_results — Finalize batch results
 * get_batch_counter — Get total number of batches
 */
import { z } from "zod";
import { parseEther, formatEther, type Address, isAddress } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult, formatError } from "../handlers/transactions.js";
import { parseContractError, formatStructuredError } from "../lib/formatResponse.js";
import { ethAddress, ethAmount, ipfsCid, unixDeadline } from "../lib/schemaHelpers.js";
import { stringToBytes32, stringsToBytes32 } from "../utils.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("ParallelTaskBatch");

// Batch status enum
const BATCH_STATUS: Record<number, string> = {
  0: "Pending",
  1: "InProgress",
  2: "Aggregated",
  3: "Completed",
  4: "Failed",
};

// Input validation schemas
const createBatchSchema = z.object({
  workers: z.array(z.string().refine(isAddress, { message: "Invalid address" })).min(1).max(50),
  payments: z.array(z.string()).min(1),
  deadlines: z.array(z.number().int().positive()).min(1),
  descriptionHashes: z.array(z.string().min(1)).min(1),
  aggregationSpec: z.string().min(1).max(100),
}).refine(data =>
  data.workers.length === data.payments.length &&
  data.workers.length === data.deadlines.length &&
  data.workers.length === data.descriptionHashes.length,
  { message: "All arrays must have the same length" }
);

export function registerBatchTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // create_batch
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_create_batch",
    {
      title: "Create Parallel Task Batch",
      description:
        "Create a batch of tasks for multiple workers to execute in parallel. All arrays must have the same length. Total ETH sent = sum of payments.\n" +
        "USE WHEN: You have a large task that can be split across multiple workers for parallel execution.\n" +
        "REQUIRES: All workers must be registered agents. Your wallet must have enough ETH for the sum of all payments plus gas.\n" +
        "RETURNS: Transaction hash. The batch ID and individual task IDs are emitted in the event logs.\n" +
        "COMES AFTER: corven_find_workers to identify available workers for the task.\n" +
        "COMES BEFORE: corven_check_batch_submitted (poll for completion), corven_aggregate_results (finalize when all done).\n" +
        "NOTE: All arrays (workers, payments, deadlines, descriptionHashes) must be the same length. Max 50 workers per batch.",
      inputSchema: {
        workers: z.array(ethAddress).describe("Array of worker addresses"),
        payments: z.array(ethAmount).describe("Array of payment amounts in ETH (one per worker)"),
        deadlines: z.array(unixDeadline).describe("Array of deadline timestamps (seconds)"),
        descriptionHashes: z.array(ipfsCid).describe("Array of IPFS CIDs for task descriptions"),
        aggregationSpec: ipfsCid.describe("IPFS CID for aggregation specification"),
      },
    },
    async ({ workers, payments, deadlines, descriptionHashes, aggregationSpec }) => {
      try {
        const validation = createBatchSchema.safeParse({ workers, payments, deadlines, descriptionHashes, aggregationSpec });
        if (!validation.success) {
          return formatError(new Error(`Invalid input: ${validation.error.issues.map(e => e.message).join(", ")}`));
        }

        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured"));
        }

        // Convert payments to wei and calculate total
        const paymentsWei = payments.map(p => parseEther(p));
        const totalPayment = paymentsWei.reduce((sum, p) => sum + p, BigInt(0));

        // Convert description hashes and aggregation spec to bytes32
        const descriptionHashesBytes32 = stringsToBytes32(descriptionHashes);
        const aggregationSpecBytes32 = stringToBytes32(aggregationSpec);

        const result = await executeOrPrepare(
          CONTRACTS.ParallelTaskBatch,
          ABI,
          "createBatch",
          [
            workers as Address[],
            paymentsWei,
            deadlines.map(BigInt),
            descriptionHashesBytes32,
            aggregationSpecBytes32,
          ],
          totalPayment
        );
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // get_batch
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_batch",
    {
      title: "Get Batch",
      description:
        "Get batch details by ID, or total batch count if no ID provided.\n" +
        "USE WHEN: You need to inspect a batch's tasks, budget, status, or aggregation spec.\n" +
        "REQUIRES: The batch must exist on-chain.\n" +
        "RETURNS: Batch details including client, total budget, task IDs, aggregation spec, status, and creation time. If no ID provided, returns total batch count.\n" +
        "COMES AFTER: corven_create_batch created the batch.\n" +
        "COMES BEFORE: corven_get_batch_status (check progress), corven_aggregate_results (finalize).\n" +
        "NOTE: Omit batchId to get the total number of batches.",
      inputSchema: {
        batchId: z.number().optional().describe("Batch ID. Omit to get total batch count."),
      },
    },
    async ({ batchId }) => {
      try {
        if (batchId === undefined) {
          const count = await readContract(CONTRACTS.ParallelTaskBatch, ABI, "batchCounter", []);
          return formatReadResult({ batchCount: Number(count) }, "Total Batches");
        }
        const data = await readContract(CONTRACTS.ParallelTaskBatch, ABI, "getBatchDetails", [BigInt(batchId)]);
        const enriched = {
          client: (data as any).client,
          totalBudgetEth: formatEther((data as any).totalBudget),
          taskIds: (data as any).taskIds.map((id: bigint) => Number(id)),
          aggregationSpec: (data as any).aggregationSpec,
          statusLabel: BATCH_STATUS[(data as any).status] ?? `Unknown(${(data as any).status})`,
          createdAt: (data as any).createdAt,
        };
        return formatReadResult(enriched, `Batch #${batchId}`);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // get_batch_status
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_batch_status",
    {
      title: "Get Batch Status",
      description:
        "Get the current status of a batch (Pending/InProgress/Aggregated/etc).\n" +
        "USE WHEN: You need to check whether a batch's tasks are all completed and ready for aggregation.\n" +
        "REQUIRES: The batch must exist on-chain.\n" +
        "RETURNS: Batch status as a numeric code and human-readable label (Pending, InProgress, Aggregated, Completed, Failed).\n" +
        "COMES AFTER: corven_create_batch created the batch.\n" +
        "COMES BEFORE: corven_aggregate_results (when status shows all tasks are done).\n" +
        "NOTE: Status 2 (Aggregated) means all tasks completed and results were finalized.",
      inputSchema: {
        batchId: z.number().describe("Numeric batch ID"),
      },
    },
    async ({ batchId }) => {
      try {
        const status = await readContract(
          CONTRACTS.ParallelTaskBatch,
          ABI,
          "getBatchStatus",
          [BigInt(batchId)]
        );

        const result = {
          batchId,
          status: Number(status),
          statusLabel: BATCH_STATUS[Number(status)] ?? `Unknown(${status})`,
        };
        return formatReadResult(result, `Batch #${batchId} Status`);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // aggregate_results
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_aggregate_results",
    {
      title: "Aggregate Batch Results",
      description:
        "Finalize a batch by aggregating all completed task results. Can only be called after all tasks in the batch are Submitted.\n" +
        "USE WHEN: All workers in the batch have submitted their deliverables and you want to finalize the batch.\n" +
        "REQUIRES: All tasks in the batch must be in Submitted status. You must be the batch creator.\n" +
        "RETURNS: Transaction hash. The aggregated result hash is stored on-chain.\n" +
        "COMES AFTER: corven_check_batch_submitted confirmed all tasks are done.\n" +
        "COMES BEFORE: corven_get_aggregated_result to retrieve the final combined result.\n" +
        "NOTE: This releases payments to all workers in the batch.",
      inputSchema: {
        batchId: z.number().describe("Numeric batch ID"),
      },
    },
    async ({ batchId }) => {
      try {
        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured"));
        }

        const result = await executeOrPrepare(
          CONTRACTS.ParallelTaskBatch,
          ABI,
          "aggregateResults",
          [BigInt(batchId)]
        );
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // get_batch_counter merged into get_batch (returns count when no batchId)

  // ──────────────────────────────────────────────────────────────
  // corven_check_batch_submitted
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_check_batch_submitted",
    {
      title: "Check Batch All Submitted",
      description:
        "Check if all subtasks in a batch have been submitted.\n" +
        "USE WHEN: You want to know whether a batch is ready for result aggregation.\n" +
        "REQUIRES: The batch must exist on-chain.\n" +
        "RETURNS: Boolean indicating whether all tasks in the batch have been submitted.\n" +
        "COMES AFTER: corven_create_batch created the batch and workers are executing tasks.\n" +
        "COMES BEFORE: corven_aggregate_results (call when allSubmitted is true).\n" +
        "NOTE: Poll this periodically or after workers report completion.",
      inputSchema: { batchId: z.number().describe("Batch ID") },
    },
    async ({ batchId }) => {
      try {
        const allSubmitted = await readContract(
          CONTRACTS.ParallelTaskBatch, ABI, "areAllSubtasksSubmitted", [BigInt(batchId)]
        );
        return formatReadResult(
          { batchId, allSubmitted },
          `Batch #${batchId} submission status`
        );
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_aggregated_result
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_aggregated_result",
    {
      title: "Get Aggregated Result",
      description:
        "Get the aggregated result hash after a batch is finalized.\n" +
        "USE WHEN: You need to retrieve the combined result of all tasks in a completed batch.\n" +
        "REQUIRES: The batch must have been finalized via corven_aggregate_results.\n" +
        "RETURNS: The aggregated result hash (bytes32) that represents the combined output of all batch tasks.\n" +
        "COMES AFTER: corven_aggregate_results finalized the batch.\n" +
        "COMES BEFORE: Use the result hash to verify or store the batch output.\n" +
        "NOTE: Returns empty/zero hash if the batch has not been aggregated yet.",
      inputSchema: { batchId: z.number().describe("Batch ID") },
    },
    async ({ batchId }) => {
      try {
        const result = await readContract(
          CONTRACTS.ParallelTaskBatch, ABI, "getAggregatedResult", [BigInt(batchId)]
        );
        return formatReadResult(
          { batchId, aggregatedResult: result },
          `Aggregated result for Batch #${batchId}`
        );
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
