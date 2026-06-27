/**
 * corven_task — Task lifecycle via CovenantSDK
 */
import { z } from "zod";
import { parseEther, formatEther, isAddress, type Address, keccak256, toBytes } from "viem";
import { getSDK, getPublicClient, loadAbi, CONTRACTS } from "../config.js";
import { formatTxResult, formatReadResult, formatError } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import { notifyAgent } from "./corven-message.js";
import type { TxResult } from "../types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs",
  "https://ipfs.io/ipfs",
  "https://cloudflare-ipfs.com/ipfs",
];

function isCid(s: string): boolean {
  return /^Qm[1-9A-HJ-NP-Za-km-z]{44,}/.test(s) ||
    /^(bafy[a-zA-Z2-7]{52,})/.test(s) ||
    /^(b[ae][a-zA-Z2-7]{50,})/.test(s);
}

function isUrl(s: string): boolean {
  return /^https?:\/\//.test(s);
}

function extractCid(input: string): string | null {
  const httpMatch = input.match(/\/ipfs\/([a-zA-Z0-9]+)/);
  if (httpMatch) return httpMatch[1];
  if (isCid(input)) return input;
  return null;
}

async function fetchIpfsContent(input: string, timeoutMs = 10000): Promise<string | null> {
  try {
    let url: string;
    if (isUrl(input)) {
      url = input;
    } else {
      const cid = extractCid(input);
      if (!cid) return null;
      url = `${IPFS_GATEWAYS[0]}/${cid}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const contentType = resp.headers.get("content-type") || "";
    if (contentType.includes("json") || contentType.includes("text")) {
      return await resp.text();
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    return buf.toString("base64");
  } catch {
    return null;
  }
}

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
  offset: z.number().optional().default(0).describe("Offset for list pagination (default 0)"),
  limit: z.number().optional().default(10).describe("Max tasks to return for list (default 10)"),
  status: z.enum(["created", "funded", "submitted", "completed", "failed", "disputed", "cancelled"]).optional().describe("Filter tasks by status (for list action)"),
  confirm: z.boolean().optional().default(false).describe('NEVER set this yourself. ALWAYS ask the user first. Show the exact ETH cost and what will happen. Only set to true AFTER the user explicitly says yes.'),
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
        "  submit — Worker submits deliverable IPFS CID or GitHub URL\n" +
        "  verify — Client approves or rejects completed work\n" +
        "  dispute — File a dispute on a task\n" +
        "  get — Get task details by ID\n" +
        "  list — List all tasks\n" +
        "  submit_milestone — Worker submits a milestone\n" +
        "  verify_milestone — Client approves/rejects a milestone\n\n" +
        "WORKFLOW: create → fund → submit → verify\n" +
        "FEE: 1% protocol fee + priority fee deducted from payment\n\n" +
        "WORKER SUBMISSION WORKFLOW:\n" +
        "1. Create a GitHub repo for your deliverable\n" +
        "2. Commit your code with tests and documentation\n" +
        "3. Push to GitHub\n" +
        "4. Submit the GitHub URL: corven_task({ action: 'submit', taskId: N, deliverableHash: 'https://github.com/...' })\n" +
        "5. The auto-verifier clones the repo, runs static analysis, and scores it\n\n" +
        "WHEN TO USE: Any task that needs payment, delivery, and verification on-chain.\n\n" +
        "NEXT STEP: Wait for worker to submit, then call corven_task({ action: 'verify' })\n\n" +
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
        const sdk = getSDK();
        const { action } = args;

        if (action === "create") {
          if (args.worker && !isAddress(args.worker)) {
            return formatError(new Error("Invalid worker address: must be a valid Ethereum address"));
          }
          const paymentNum = Number(args.payment || "0.01");
          if (paymentNum <= 0 || paymentNum > 100) {
            return formatError(new Error("Invalid payment amount: must be > 0 and <= 100 ETH"));
          }
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
          const result = await waitAndFormat(hash);
          if (result.status === "success") {
            notifyAgent(args.worker!, "task_created", `New task assigned to you: ${formatEther(paymentWei)} ETH`, 0);
          }
          return formatTxResult(result);
        }

        if (action === "fund") {
          const paymentWei = parseEther(args.payment || "0.01");
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Fund task #" + args.taskId + " escrow",
              cost: formatEther(paymentWei) + " ETH",
              reason: "ETH added to task escrow for worker payment",
              toProceed: "Call corven_task again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const hash = await sdk.fundTask(BigInt(args.taskId || 0), paymentWei);
          return formatTxResult(await waitAndFormat(hash));
        }

        if (action === "submit") {
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Submit deliverable for task #" + args.taskId,
              cost: "0 ETH (gas only)",
              reason: "No direct cost, but commits your submission. Submission guide: The deliverableHash should be a GitHub HTTPS URL (https://github.com/user/repo) so the auto-verifier can clone, test, and score it. IPFS CIDs cannot be auto-verified.",
              toProceed: "Call corven_task again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const hash = await sdk.submitWork(
            BigInt(args.taskId || 0),
            keccak256(toBytes(args.deliverableHash || "QmDelivered"))
          );
          const result = await waitAndFormat(hash);
          if (result.status === "success") {
            const acct = (await import("../config.js")).getAccount();
            if (acct) notifyAgent(acct.address, "task_submitted", `Deliverable submitted for task #${args.taskId}`, Number(args.taskId));
          }
          return formatTxResult(result);
        }

        if (action === "verify") {
          if (!args.confirm) {
            const taskInfo = await sdk.getTask(BigInt(args.taskId || 0));
            return formatReadResult({
              confirmationRequired: true,
              action: "Approve and release payment for task #" + args.taskId,
              worker: taskInfo.worker,
              payment: formatEther(taskInfo.payment) + " ETH",
              reason: "Releases escrowed ETH to worker. A client signature is generated automatically.",
              toProceed: "Call corven_task again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }

          const walletClient = (await import("../config.js")).getWalletClient();
          const account = (await import("../config.js")).getAccount();
          if (!walletClient || !account) return formatError(new Error("Wallet required. Set PRIVATE_KEY in ~/.covenant/config.json"));

          const publicClient = getPublicClient();
          const chainId = Number(await publicClient.getChainId());
          const escrowAddr = CONTRACTS.TaskEscrow as Address;
          const taskIdBig = BigInt(args.taskId || 0);

          // Contract expects: keccak256(abi.encodePacked(taskId, chainid, address(this)))
          const taskData = await sdk.getTask(taskIdBig);
          if (taskData.client.toLowerCase() !== account.address.toLowerCase()) {
            return formatError(new Error(`Only the task client (${taskData.client}) can verify. You are ${account.address}.`));
          }

          const pad32 = (val: bigint | number | string) => {
            const hex = BigInt(val).toString(16).padStart(64, "0");
            return hex;
          };
          const rawMessage = `0x${pad32(taskIdBig)}${pad32(chainId)}${escrowAddr.toLowerCase().slice(2)}`;
          const messageHash = keccak256(rawMessage as `0x${string}`);
          const signature = await walletClient.signMessage({
            account: account.address as `0x${string}`,
            message: { raw: messageHash },
          });

          const hash = await walletClient.writeContract({
            address: escrowAddr,
            abi: loadAbi("TaskEscrow"),
            functionName: "completeTask",
            args: [taskIdBig, signature],
            chain: (await import("../config.js")).CHAIN,
            account,
          });
          const result = await waitAndFormat(hash);
          if (result.status === "success") {
            notifyAgent(taskData.worker, "task_completed", `Task #${args.taskId} verified and payment released`, Number(args.taskId));
          }
          return formatTxResult(result);
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

        if (action === "submit_milestone") {
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Submit milestone #" + args.milestoneIndex + " for task #" + args.taskId,
              cost: "0 ETH (gas only)",
              reason: "Commits your milestone deliverable on-chain",
              toProceed: "Call corven_task again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const publicClient = getPublicClient();
          const walletClient = (await import("../config.js")).getWalletClient();
          if (!walletClient) return formatError(new Error("Wallet required for submit_milestone"));
          const hash = await walletClient.writeContract({
            address: CONTRACTS.TaskEscrow,
            abi: loadAbi("TaskEscrow"),
            functionName: "submitMilestone",
            args: [BigInt(args.taskId || 0), BigInt(args.milestoneIndex || 0), args.deliverableHash || ""],
            chain: (await import("../config.js")).CHAIN,
            account: (await import("../config.js")).getAccount(),
          });
          return formatTxResult(await waitAndFormat(hash));
        }

        if (action === "verify_milestone") {
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Verify milestone #" + args.milestoneIndex + " for task #" + args.taskId,
              cost: "ETH released from escrow for this milestone",
              reason: "Approving releases milestone payment to worker",
              toProceed: "Call corven_task again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const walletClient = (await import("../config.js")).getWalletClient();
          if (!walletClient) return formatError(new Error("Wallet required for verify_milestone"));
          const hash = await walletClient.writeContract({
            address: CONTRACTS.TaskEscrow,
            abi: loadAbi("TaskEscrow"),
            functionName: "verifyMilestone",
            args: [BigInt(args.taskId || 0), BigInt(args.milestoneIndex || 0), args.success !== false],
            chain: (await import("../config.js")).CHAIN,
            account: (await import("../config.js")).getAccount(),
          });
          return formatTxResult(await waitAndFormat(hash));
        }

        if (action === "get") {
          const task = await sdk.getTask(BigInt(args.taskId || 0));

          const result: Record<string, any> = {
            taskId: Number(task.taskId || args.taskId),
            client: task.client,
            worker: task.worker,
            paymentEth: formatEther(task.payment),
            status: TASK_STATUS[Number(task.status)] || "Unknown",
          };

          // Resolve descriptionHash from IPFS
          const descHash = (task as any).descriptionHash || "";
          if (descHash && (isCid(descHash) || isUrl(descHash))) {
            const resolved = await fetchIpfsContent(descHash);
            if (resolved) {
              result.descriptionHash = descHash;
              result.description = resolved;
            }
          }

          // Resolve deliverableHash from IPFS
          const delHash = (task as any).deliverableHash || "";
          if (delHash && (isCid(delHash) || isUrl(delHash))) {
            const resolved = await fetchIpfsContent(delHash);
            if (resolved) {
              result.deliverableHash = delHash;
              result.deliverable = resolved;
            }
          }

          return formatReadResult(result, `Task #${args.taskId}`);
        }

        if (action === "list") {
          const count = Number(await sdk.getTaskCount());
          if (count === 0) {
            return formatReadResult({ totalTasks: 0, tasks: [] }, "Task List");
          }
          const offset = args.offset || 0;
          const limit = Math.min(args.limit || 10, 50);
          const filterWorker = args.worker ? args.worker.toLowerCase() : null;
          const filterStatus = args.status ? args.status.toLowerCase() : null;
          const tasks: any[] = [];
          const start = Math.max(0, count - 1 - offset);
          const end = Math.max(0, start - limit - 200);
          for (let i = start; i >= end && tasks.length < limit; i--) {
            try {
              const task = await sdk.getTask(BigInt(i));
              const statusName = TASK_STATUS[Number(task.status)] || "Unknown";
              if (filterWorker && task.worker.toLowerCase() !== filterWorker) continue;
              if (filterStatus && statusName.toLowerCase() !== filterStatus) continue;
              tasks.push({
                taskId: i,
                client: task.client,
                worker: task.worker,
                paymentEth: formatEther(task.payment),
                status: statusName,
              });
            } catch { continue; }
          }
          return formatReadResult({
            totalTasks: count,
            filtered: filterWorker || filterStatus ? true : false,
            returned: tasks.length,
            tasks,
          }, "Task List");
        }

        return formatReadResult({ error: "Unknown action" }, "Error");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
