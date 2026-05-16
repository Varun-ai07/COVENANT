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
        "Create a batch of tasks for multiple workers to execute in parallel. " +
        "All arrays must have the same length. Total ETH sent = sum of payments.",
      inputSchema: {
        workers: z.array(z.string()).describe("Array of worker addresses"),
        payments: z.array(z.string()).describe("Array of payment amounts in ETH (one per worker)"),
        deadlines: z.array(z.number()).describe("Array of deadline timestamps (seconds)"),
        descriptionHashes: z.array(z.string()).describe("Array of IPFS CIDs for task descriptions"),
        aggregationSpec: z.string().describe("IPFS CID for aggregation specification"),
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
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // get_batch
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_batch",
    {
      title: "Get Batch Details",
      description: "Retrieve full details of a task batch including all task IDs.",
      inputSchema: {
        batchId: z.number().describe("Numeric batch ID"),
      },
    },
    async ({ batchId }) => {
      try {
        const data = await readContract(
          CONTRACTS.ParallelTaskBatch,
          ABI,
          "getBatchDetails",
          [BigInt(batchId)]
        );

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
        return formatError(e);
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
      description: "Get the current status of a batch (Pending/InProgress/Aggregated/etc).",
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
        return formatError(e);
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
        "Finalize a batch by aggregating all completed task results. " +
        "Can only be called after all tasks in the batch are Submitted.",
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
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // get_batch_counter
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_batch_counter",
    {
      title: "Get Batch Counter",
      description: "Get the total number of batches created on the protocol.",
      inputSchema: {},
    },
    async () => {
      try {
        const count = await readContract(
          CONTRACTS.ParallelTaskBatch,
          ABI,
          "batchCounter",
          []
        );
        return formatReadResult({ count: Number(count) }, "Batch Counter");
      } catch (e) {
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_check_batch_submitted
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_check_batch_submitted",
    {
      title: "Check Batch All Submitted",
      description: "Check if all subtasks in a batch have been submitted.",
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
      } catch (e) { return formatError(e); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_aggregated_result
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_aggregated_result",
    {
      title: "Get Aggregated Result",
      description: "Get the aggregated result hash after a batch is finalized.",
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
      } catch (e) { return formatError(e); }
    }
  );
}
