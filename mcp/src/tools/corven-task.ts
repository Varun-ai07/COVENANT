/**
 * corven_task — Task lifecycle via CovenantSDK
 */
import { z } from "zod";
import { parseEther, formatEther, type Address, keccak256, toBytes } from "viem";
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
  confirm: z.boolean().optional().default(false).describe('Set to true to execute. Without this, shows what will happen.'),
});

export function registerTaskTools(server: McpServer): void {
  server.registerTool(
    "corven_task",
    {
      title: "Task Manager",
      description:
        "Manage the full task lifecycle on COVENANT — create, fund, submit, verify, and dispute tasks.\n\n" +
        "ACTIONS:\n" +
        "  create — Post a new task with worker, payment, and deadline\n" +
        "  fund — Fund a created task with ETH\n" +
        "  submit — Worker submits deliverable IPFS CID\n" +
        "  verify — Client approves or rejects completed work\n" +
        "  dispute — File a dispute on a task\n" +
        "  get — Get task details by ID\n" +
        "  list — List all tasks\n" +
        "  submit_milestone — Worker submits a milestone\n" +
        "  verify_milestone — Client approves/rejects a milestone\n\n" +
        "WORKFLOW: create → fund → submit → verify\n" +
        "FEE: 1% protocol fee + priority fee deducted from payment\n\n" +
        "WHEN TO USE: Any task that needs payment, delivery, and verification on-chain.\n\n" +
        "NEXT STEP: Wait for worker to submit, then call corven_task({ action: 'verify' })\n\n" +
        "OUTPUT RULES:\n" +
        "- Present results as clean, readable text. Never show raw JSON.\n" +
        "- On error: Explain in plain language what went wrong and suggest next step.\n" +
        "- Always recommend a logical follow-up action.\n" +
        "- Never show stack traces, technical errors, or raw data.",
      inputSchema: schema.shape,
    },
    async (args) => {
      try {
        const sdk = getSDK();
        const { action } = args;

        if (action === "create") {
          const deadline = args.deadline
            ? Number(args.deadline)
            : Math.floor(Date.now() / 1000) + 86400;
          const paymentWei = parseEther(args.payment || "0.01");
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Create task and fund escrow",
              cost: formatEther(paymentWei) + " ETH",
              reason: "Payment locked in TaskEscrow until worker completes",
              toProceed: "Call corven_task again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const hash = await sdk.createTask(
            args.worker as Address,
            paymentWei,
            deadline,
            keccak256(toBytes(args.descriptionHash || "QmDefault"))
          );
          return formatTxResult(await waitAndFormat(hash));
        }

        if (action === "submit") {
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Submit deliverable for task #" + args.taskId,
              cost: "0 ETH (gas only)",
              reason: "No direct cost, but commits your submission",
              toProceed: "Call corven_task again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const hash = await sdk.submitWork(
            BigInt(args.taskId || 0),
            keccak256(toBytes(args.deliverableHash || "QmDelivered"))
          );
          return formatTxResult(await waitAndFormat(hash));
        }

        if (action === "verify") {
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Approve and release payment for task #" + args.taskId,
              cost: "ETH released from escrow to worker",
              reason: "Approving releases escrowed funds to worker",
              toProceed: "Call corven_task again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const hash = await sdk.completeTask(
            BigInt(args.taskId || 0),
            "0x0000000000000000000000000000000000000000000000000000000000000000"
          );
          return formatTxResult(await waitAndFormat(hash));
        }

        if (action === "dispute") {
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "File dispute for task #" + args.taskId,
              cost: "Bond required (see corven_file_dispute)",
              reason: "Dispute requires a bond that may be forfeited",
              toProceed: "Call corven_task again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const hash = await sdk.disputeTask(
            BigInt(args.taskId || 0)
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
