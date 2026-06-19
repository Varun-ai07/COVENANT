/**
 * corven_task — Task lifecycle via CovenantSDK
 */
import { z } from "zod";
import { parseEther, formatEther, type Address } from "viem";
import { getSDK, getPublicClient } from "../config.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import type { TxResult } from "../types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

async function waitAndFormat(hash: `0x${string}`): Promise<TxResult> {
  const client = getPublicClient();
  const receipt = await client.waitForTransactionReceipt({ hash });
  return { status: "success", txHash: hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed };
}

const TASK_STATUS = ["None", "Created", "Funded", "Submitted", "Completed", "Failed", "Disputed", "Cancelled"];

const schema = z.object({
  action: z.enum(["create", "fund", "submit", "verify", "dispute", "get", "list", "submit_milestone", "verify_milestone"]),
  taskId: z.number().optional(),
  worker: z.string().optional(),
  payment: z.string().optional(),
  deadline: z.string().optional(),
  descriptionHash: z.string().optional(),
  deliverableHash: z.string().optional(),
  success: z.boolean().optional(),
  milestoneIndex: z.number().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
});

export function registerTaskTools(server: McpServer): void {
  server.registerTool(
    "corven_task",
    {
      title: "Task Manager",
      description:
        "Manage the full task lifecycle on COVENANT.\n\n" +
        "ACTIONS:\n" +
        "  create — Post a new task\n" +
        "  fund — Fund a created task with ETH\n" +
        "  submit — Worker submits deliverable IPFS CID\n" +
        "  verify — Client approves or rejects\n" +
        "  dispute — File a dispute\n" +
        "  get — Get task details by ID\n" +
        "  list — List tasks\n" +
        "  submit_milestone — Worker submits a milestone\n" +
        "  verify_milestone — Client approves/rejects a milestone\n\n" +
        "WORKFLOW: create → fund → submit → verify\n" +
        "FEE: 1% protocol fee + priority fee deducted from payment",
      inputSchema: schema.shape,
    },
    async (args) => {
      try {
        const sdk = getSDK();
        const { action } = args;

        if (action === "create") {
          const deadline = args.deadline
            ? BigInt(args.deadline)
            : BigInt(Math.floor(Date.now() / 1000) + 86400);
          const hash = await sdk.createTask(
            args.worker as Address,
            parseEther(args.payment || "0.01"),
            deadline,
            args.descriptionHash || "QmDefault"
          );
          return formatTxResult(await waitAndFormat(hash));
        }

        if (action === "submit") {
          const hash = await sdk.submitWork(
            BigInt(args.taskId || 0),
            args.deliverableHash || "QmDelivered"
          );
          return formatTxResult(await waitAndFormat(hash));
        }

        if (action === "verify") {
          const hash = await sdk.verifyTask(
            BigInt(args.taskId || 0),
            args.success !== false
          );
          return formatTxResult(await waitAndFormat(hash));
        }

        if (action === "dispute") {
          const hash = await sdk.disputeTask(
            BigInt(args.taskId || 0),
            parseEther("0.0002")
          );
          return formatTxResult(await waitAndFormat(hash));
        }

        if (action === "get") {
          const task = await sdk.getTask(BigInt(args.taskId || 0));
          return formatReadResult({
            taskId: Number(task.taskId || args.taskId),
            client: task.client,
            worker: task.worker,
            paymentEth: formatEther(task.payment),
            status: TASK_STATUS[Number(task.status)] || "Unknown",
          }, `Task #${args.taskId}`);
        }

        if (action === "list") {
          const count = await sdk.getTaskCount();
          return formatReadResult({ totalTasks: Number(count) }, "Task Count");
        }

        return formatReadResult({ error: "Unknown action" }, "Error");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
