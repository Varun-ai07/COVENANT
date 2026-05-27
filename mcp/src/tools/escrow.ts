/**
 * TaskEscrow MCP Tools
 *
 * create_task  — Create and fund a task (one-shot)
 * get_task     — Read task details by ID
 * submit_work  — Submit deliverable hash for a task
 * verify_task  — Mark a submitted task as verified / completed
 * dispute_task — Open a dispute on a task
 */
import { z } from "zod";
import { parseEther, formatEther, type Address, isAddress } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatSuccess, formatStructuredError, parseContractError, validateBalance } from "../lib/formatResponse.js";
import { ethAddress, ethAmount, ipfsCid, unixDeadline, taskId as taskIdSchema, priority as prioritySchema } from "../lib/schemaHelpers.js";
import { TASK_STATUS } from "../types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("TaskEscrow");

// Input validation schemas
const createTaskSchema = z.object({
  worker: z.string().refine(isAddress, { message: "Invalid worker Ethereum address" }),
  payment: z.string().regex(/^\d+\.\d{1,18}$/, "Invalid ETH amount format")
    .refine(val => {
      const paymentAmount = parseFloat(val);
      return paymentAmount >= 0.001 && paymentAmount <= 1000; // Allow up to 1000 ETH for tasks
    }, { message: "Payment must be between 0.001 and 1000 ETH" }),
  deadline: z.number().int().positive()
    .refine(val => {
      const deadlineTimestamp = val * 1000; // Convert to milliseconds
      const now = Date.now();
      const oneYearFromNow = now + (365 * 24 * 60 * 60 * 1000); // 1 year max
      return deadlineTimestamp > now && deadlineTimestamp < oneYearFromNow;
    }, { message: "Deadline must be a future timestamp within 1 year" }),
  descriptionHash: z.string().min(1).max(100), // Basic IPFS CID validation
  priority: z.number().int().min(0).max(3).optional().default(1) // 0-3 for priority levels
});

const getTaskSchema = z.object({
  taskId: z.number().int().positive()
});

const submitWorkSchema = z.object({
  taskId: z.number().int().positive(),
  deliverableHash: z.string().min(1).max(100) // Basic IPFS CID validation
});

const verifyTaskSchema = z.object({
  taskId: z.number().int().positive(),
  success: z.boolean() // Whether task passed verification
});

const disputeTaskSchema = z.object({
  taskId: z.number().int().positive(),
  reason: z.string().max(500).optional() // Limit reason length
});

export function registerEscrowTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // create_task
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_create_task",
    {
      title: "Create & Fund Task",
      description:
        "Creates a direct-hire task and locks payment in escrow in a single transaction.\n" +
        "USE WHEN: You have a specific worker address and want to hire them directly. Use corven_post_open_task if you want competitive bidding instead.\n" +
        "REQUIRES: Both client AND worker must be registered with corven_register_agent. Client wallet needs payment amount plus ~0.0003 ETH gas.\n" +
        "RETURNS: taskId (save this for all subsequent calls), escrow status, deadline, worker address, Basescan link.\n" +
        "COMES AFTER: corven_find_workers to get the worker address.\n" +
        "COMES BEFORE: Worker calls corven_submit_work. Client calls corven_verify_task.\n" +
        "NOTE: Payment is locked — neither party can access it until verification completes.",
      inputSchema: {
        worker: ethAddress,
        payment: ethAmount,
        deadline: unixDeadline,
        descriptionHash: ipfsCid,
        priority: prioritySchema,
      },
    },
    async ({ worker, payment, deadline, descriptionHash, priority }) => {
      try {
        const validationResult = createTaskSchema.safeParse({ worker, payment, deadline, descriptionHash, priority });
        if (!validationResult.success) {
          return formatStructuredError(
            "Invalid task parameters.",
            validationResult.error.issues.map((e: any) => e.message).join(", "),
            "Check: worker must be full 42-char 0x address, payment decimal ETH string (0.001-1000), deadline future Unix timestamp, descriptionHash valid IPFS CID.",
            true
          );
        }

        const account = getAccount();
        if (!account) {
          return formatStructuredError(
            "No private key configured.",
            "PRIVATE_KEY environment variable is not set.",
            "Set PRIVATE_KEY in your .env file.",
            false
          );
        }

        const paymentWei = parseEther(payment);
        const priorityLevel = priority ?? 1;

        // Calculate total value: payment + protocol fee (1%) + priority fee
        const PROTOCOL_FEE_BPS = 100n; // 1%
        const PRIORITY_FEES = [50n, 100n, 200n, 500n]; // Low, Medium, High, Urgent
        const priorityFeeBps = PRIORITY_FEES[priorityLevel] ?? 100n;
        const totalFeeBps = PROTOCOL_FEE_BPS + priorityFeeBps;
        const feeAmount = paymentWei * totalFeeBps / 10000n;
        const totalValue = paymentWei + feeAmount;

        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow,
          ABI,
          "createAndFundTask",
          [
            worker as Address,
            paymentWei,
            BigInt(deadline),
            descriptionHash,
          ],
          totalValue
        );

        if (result.status === "success") {
          const deadlineDate = new Date(deadline * 1000).toUTCString();
          return formatSuccess(
            `Task created. ${payment} ETH locked in escrow for worker.`,
            {
              worker,
              client: account,
              payment: `${payment} ETH`,
              deadline: deadlineDate,
              specificationIpfs: descriptionHash,
              status: "Funded",
              priority: priorityLevel,
            },
            result.txHash,
            [
              "Wait for worker to call corven_submit_work with your taskId.",
              "Then call corven_verify_task to release payment after reviewing work.",
              "Check status anytime with corven_get_task.",
            ]
          );
        }

        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // get_task
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_task",
    {
      title: "Get Task Details",
      description:
        "Returns complete details for any task including current lifecycle status.\n" +
        "USE WHEN: Checking if a worker has submitted work. Confirming payment released. Getting deliverable IPFS hash. Checking deadline.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Status, client/worker addresses, payment, deadline, specification hash, deliverable hash.\n" +
        "STATUS MEANINGS: Funded=worker can begin. InProgress=worker acknowledged. Submitted=work ready for review. Completed=paid. Failed=rejected or expired.",
      inputSchema: {
        taskId: taskIdSchema,
      },
    },
    async ({ taskId }) => {
      try {
        const validationResult = getTaskSchema.safeParse({ taskId });
        if (!validationResult.success) {
          return formatStructuredError(
            "Invalid task ID.",
            `Received '${taskId}' — must be a positive integer.`,
            "Pass the numeric taskId returned by corven_create_task. Find your task IDs with corven_get_client_tasks or corven_get_worker_tasks.",
            false
          );
        }

        const validatedTaskId = validationResult.data.taskId;
        const data = await readContract(
          CONTRACTS.TaskEscrow,
          ABI,
          "getTask",
          [BigInt(validatedTaskId)]
        );

        const enriched = {
          ...(data as any),
          statusLabel: TASK_STATUS[(data as any).status as keyof typeof TASK_STATUS] ?? `Unknown(${(data as any).status})`,
          paymentEth: formatEther((data as any).payment),
        };

        return formatReadResult(enriched, `Task #${taskId}`);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // submit_work
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_submit_work",
    {
      title: "Submit Work Deliverable",
      description:
        "Worker submits completed deliverable IPFS hash on-chain. Commits work permanently and notifies the client.\n" +
        "USE WHEN: You are the worker and have finished executing the task. Upload deliverable to IPFS first. Then call this with the CID.\n" +
        "REQUIRES: You must be the assigned worker. Task status must be Funded or InProgress. Deadline must not have passed.\n" +
        "RETURNS: Submission confirmation, IPFS hash recorded on-chain, next action for the client.\n" +
        "COMES AFTER: Worker executes task off-chain and uploads deliverable to IPFS.\n" +
        "COMES BEFORE: Client calls corven_verify_task.",
      inputSchema: {
        taskId: taskIdSchema,
        deliverableHash: ipfsCid,
      },
    },
    async ({ taskId, deliverableHash }) => {
      try {
        const validationResult = submitWorkSchema.safeParse({ taskId, deliverableHash });
        if (!validationResult.success) {
          return formatStructuredError(
            "Invalid parameters.",
            validationResult.error.issues.map((e: any) => e.message).join(", "),
            "taskId must be a positive integer. deliverableHash must be a valid IPFS CID (Qm... or bafy...).",
            true
          );
        }

        const account = getAccount();
        if (!account) {
          return formatStructuredError("No private key configured.", "PRIVATE_KEY not set.", "Set PRIVATE_KEY in .env.", false);
        }

        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow,
          ABI,
          "submitWork",
          [BigInt(taskId), deliverableHash]
        );

        if (result.status === "success") {
          return formatSuccess(
            `Work submitted for Task #${taskId}. Client will be notified.`,
            { taskId, deliverableHash, status: "Submitted" },
            result.txHash,
            ["Wait for client to review and call corven_verify_task.", "Payment releases automatically on approval."]
          );
        }
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // verify_task
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_verify_task",
    {
      title: "Verify & Approve Task",
      description:
        "Client approves submitted work. Triggers automatic payment release. Worker receives ETH. Reputation updates. ERC-8004 receipt created.\n" +
        "USE WHEN: You are the client. Worker has submitted work (corven_get_task shows status Submitted). You have reviewed and approve.\n" +
        "REQUIRES: You must be the client. Task status must be Submitted. Call corven_dispute_task instead to reject.\n" +
        "RETURNS: Payment release confirmation, new reputation scores for both agents, receipt ID, Basescan link.\n" +
        "COMES AFTER: corven_submit_work by the worker.\n" +
        "NOTE: This is the final step. Payment releases automatically — no manual transfer needed.",
      inputSchema: {
        taskId: taskIdSchema,
        success: z.boolean().describe("true = approve work and release payment, false = reject work and refund client"),
      },
    },
    async ({ taskId, success }) => {
      try {
        const validationResult = verifyTaskSchema.safeParse({ taskId, success });
        if (!validationResult.success) {
          return formatStructuredError(
            "Invalid parameters.",
            validationResult.error.issues.map((e: any) => e.message).join(", "),
            "taskId must be positive integer. success must be boolean.",
            true
          );
        }

        const account = getAccount();
        if (!account) {
          return formatStructuredError("No private key configured.", "PRIVATE_KEY not set.", "Set PRIVATE_KEY in .env.", false);
        }

        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow,
          ABI,
          "verifyTask",
          [BigInt(taskId), success],
          undefined,
          "TaskEscrow"
        );

        if (result.status === "success") {
          return formatSuccess(
            success
              ? `Task #${taskId} approved. Payment released to worker automatically.`
              : `Task #${taskId} rejected. Payment refunded to client.`,
            { taskId, verdict: success ? "APPROVED" : "REJECTED" },
            result.txHash,
            success
              ? ["Payment has been transferred to the worker's wallet.", "Both agents' reputation scores have been updated.", "An ERC-8004 receipt has been created as permanent proof."]
              : ["Payment has been refunded to your wallet.", "Worker's reputation has been penalized."]
          );
        }
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // dispute_task
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_dispute_task",
    {
      title: "Dispute a Task",
      description:
        "Freezes a task and initiates jury-based dispute resolution. Three randomly-selected agents vote. Majority decides.\n" +
        "USE WHEN: You are the client and submitted work clearly fails the specification. Or you are the worker and were unfairly rejected.\n" +
        "REQUIRES: Task status must be Submitted. Either client or worker can call.\n" +
        "RETURNS: Dispute ID, jury selection confirmation, voting deadline.\n" +
        "NOTE: Call corven_get_task first to confirm the task is in Submitted status.",
      inputSchema: {
        taskId: taskIdSchema,
        reason: z.string().max(500).optional().describe("Optional reason for the dispute"),
      },
    },
    async ({ taskId, reason }) => {
      try {
        const account = getAccount();
        if (!account) {
          return formatStructuredError("No private key configured.", "PRIVATE_KEY not set.", "Set PRIVATE_KEY in .env.", false);
        }

        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow,
          ABI,
          "disputeTask",
          [BigInt(taskId)],
          undefined,
          "TaskEscrow"
        );

        if (result.status === "success") {
          return formatSuccess(
            `Task #${taskId} disputed. Payment frozen pending jury resolution.`,
            { taskId, reason: reason || "No reason provided", status: "Disputed" },
            result.txHash,
            ["Three jurors will be randomly selected to vote.", "Resolution typically takes 24-48 hours."]
          );
        }
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_create_task_with_priority
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_create_task_with_priority",
    {
      title: "Create Task with Priority",
      description:
        "Creates a direct-hire task with a specific priority level and locks payment in escrow.\n" +
        "USE WHEN: You have a specific worker and need urgent or high-priority execution with guaranteed faster attention.\n" +
        "REQUIRES: Both client AND worker registered. Client wallet needs payment + priority fee + ~0.0003 ETH gas.\n" +
        "RETURNS: taskId, escrow status, priority level, total cost breakdown, Basescan link.\n" +
        "COMES AFTER: corven_find_workers to get the worker address.\n" +
        "COMES BEFORE: Worker calls corven_submit_work. Client calls corven_verify_task.\n" +
        "NOTE: Priority fees — Low: 0.5%, Medium: 1%, High: 2%, Urgent: 5%. Use corven_create_task for default Medium priority.",
      inputSchema: {
        worker: ethAddress,
        payment: ethAmount,
        deadline: unixDeadline,
        descriptionHash: ipfsCid,
        priority: prioritySchema,
      },
    },
    async ({ worker, payment, deadline, descriptionHash, priority }) => {
      try {
        const account = getAccount();
        if (!account) return formatStructuredError("No private key configured.", "PRIVATE_KEY not set.", "Set PRIVATE_KEY in .env.", false);
        const paymentWei = parseEther(payment);

        // Calculate total value: payment + protocol fee (1%) + priority fee
        const PROTOCOL_FEE_BPS = 100n;
        const PRIORITY_FEES = [50n, 100n, 200n, 500n];
        const priorityFeeBps = PRIORITY_FEES[priority] ?? 100n;
        const totalFeeBps = PROTOCOL_FEE_BPS + priorityFeeBps;
        const feeAmount = paymentWei * totalFeeBps / 10000n;
        const totalValue = paymentWei + feeAmount;

        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow, ABI, "createAndFundTaskWithPriority",
          [worker as Address, paymentWei, BigInt(deadline), descriptionHash, priority], totalValue
        );
        return formatTxResult(result);
      } catch (e) { const p = parseContractError(e); return formatStructuredError(p.error, p.cause, p.fix, p.retryable); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_create_milestone_task
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_create_milestone_task",
    {
      title: "Create Milestone Task",
      description:
        "Creates a task with incremental milestone-based payments. Each milestone is verified and paid independently.\n" +
        "USE WHEN: Task has distinct phases (e.g., research, draft, final). You want partial payment tied to checkpoints.\n" +
        "REQUIRES: Both client AND worker registered. Client wallet needs totalPayment + ~2% fees + ~0.0003 ETH gas.\n" +
        "RETURNS: taskId, milestone count, individual milestone amounts, total escrowed, Basescan link.\n" +
        "COMES AFTER: corven_find_workers to get the worker address.\n" +
        "COMES BEFORE: Worker calls corven_submit_milestone per milestone. Client calls corven_verify_milestone to release each payment.\n" +
        "NOTE: totalPayment must equal the sum of milestonePayments. Milestones are verified in order (0, 1, 2, ...).",
      inputSchema: {
        worker: ethAddress,
        totalPayment: ethAmount,
        deadline: unixDeadline,
        descriptionHash: ipfsCid,
        milestoneDescriptions: z.array(z.string()).describe("Array of milestone descriptions"),
        milestonePayments: z.array(z.string()).describe("Array of milestone payments in ETH"),
      },
    },
    async ({ worker, totalPayment, deadline, descriptionHash, milestoneDescriptions, milestonePayments }) => {
      try {
        const account = getAccount();
        if (!account) return formatStructuredError("No private key configured.", "PRIVATE_KEY not set.", "Set PRIVATE_KEY in .env.", false);
        const paymentWei = parseEther(totalPayment);
        const payments = milestonePayments.map(p => parseEther(p));

        // Calculate total value: payment + protocol fee (1%) + priority fee (default Medium=1%)
        const PROTOCOL_FEE_BPS = 100n;
        const PRIORITY_FEE_BPS = 100n; // Default Medium priority
        const totalFeeBps = PROTOCOL_FEE_BPS + PRIORITY_FEE_BPS;
        const feeAmount = paymentWei * totalFeeBps / 10000n;
        const totalValue = paymentWei + feeAmount;

        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow, ABI, "createTaskWithMilestones",
          [worker as Address, paymentWei, BigInt(deadline), descriptionHash, milestoneDescriptions, payments], totalValue
        );
        return formatTxResult(result);
      } catch (e) { const p = parseContractError(e); return formatStructuredError(p.error, p.cause, p.fix, p.retryable); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_submit_milestone
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_submit_milestone",
    {
      title: "Submit Milestone",
      description:
        "Worker submits a deliverable for a specific milestone in a milestone-based task.\n" +
        "USE WHEN: You are the worker and have completed one milestone phase. Upload deliverable to IPFS first.\n" +
        "REQUIRES: You must be the assigned worker. Milestone must not already be submitted. Task status must be Funded or InProgress.\n" +
        "RETURNS: Submission confirmation, milestone index, IPFS hash recorded on-chain.\n" +
        "COMES AFTER: corven_create_milestone_task created the task with milestones.\n" +
        "COMES BEFORE: Client calls corven_verify_milestone to approve and release payment for this milestone.\n" +
        "NOTE: Milestones must be submitted in order. You cannot skip ahead.",
      inputSchema: {
        taskId: taskIdSchema,
        milestoneIndex: z.number().describe("Milestone index (0-based)"),
        deliverableHash: ipfsCid,
      },
    },
    async ({ taskId, milestoneIndex, deliverableHash }) => {
      try {
        const account = getAccount();
        if (!account) return formatStructuredError("No private key configured.", "PRIVATE_KEY not set.", "Set PRIVATE_KEY in .env.", false);
        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow, ABI, "submitMilestone",
          [BigInt(taskId), BigInt(milestoneIndex), deliverableHash]
        );
        return formatTxResult(result);
      } catch (e) { const p = parseContractError(e); return formatStructuredError(p.error, p.cause, p.fix, p.retryable); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_verify_milestone
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_verify_milestone",
    {
      title: "Verify Milestone",
      description:
        "Client verifies a submitted milestone and releases its payment to the worker.\n" +
        "USE WHEN: You are the client. Worker has submitted a milestone (corven_get_milestone shows submitted). You have reviewed and approve.\n" +
        "REQUIRES: You must be the client. Milestone must have been submitted by the worker.\n" +
        "RETURNS: Verification result, payment released amount, milestone status update.\n" +
        "COMES AFTER: corven_submit_milestone by the worker.\n" +
        "COMES BEFORE: Next milestone submission, or task completion if this was the final milestone.\n" +
        "NOTE: Rejecting a milestone does not refund the entire task — only that milestone's payment is withheld.",
      inputSchema: {
        taskId: taskIdSchema,
        milestoneIndex: z.number().describe("Milestone index (0-based)"),
        success: z.boolean().describe("Whether the milestone passes verification"),
      },
    },
    async ({ taskId, milestoneIndex, success }) => {
      try {
        const account = getAccount();
        if (!account) return formatStructuredError("No private key configured.", "PRIVATE_KEY not set.", "Set PRIVATE_KEY in .env.", false);
        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow, ABI, "verifyMilestone",
          [BigInt(taskId), BigInt(milestoneIndex), success], undefined, "TaskEscrow"
        );
        return formatTxResult(result);
      } catch (e) { const p = parseContractError(e); return formatStructuredError(p.error, p.cause, p.fix, p.retryable); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_milestone (includes count when no index provided)
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_milestone",
    {
      title: "Get Milestone",
      description:
        "Reads milestone details by index, or returns the total milestone count if no index is provided.\n" +
        "USE WHEN: Checking which milestones have been submitted or verified. Counting milestones before submission.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Milestone description, payment amount, submission hash, verification status — or milestone count if index omitted.\n" +
        "COMES AFTER: corven_create_milestone_task created the task.\n" +
        "COMES BEFORE: corven_submit_milestone or corven_verify_milestone.",
      inputSchema: {
        taskId: taskIdSchema,
        milestoneIndex: z.number().optional().describe("Milestone index (0-based). Omit to get count."),
      },
    },
    async ({ taskId, milestoneIndex }) => {
      try {
        if (milestoneIndex === undefined) {
          const count = await readContract(CONTRACTS.TaskEscrow, ABI, "getMilestoneCount", [BigInt(taskId)]);
          return formatReadResult({ taskId, milestoneCount: Number(count) }, `Milestone count for Task #${taskId}`);
        }
        const data = await readContract(CONTRACTS.TaskEscrow, ABI, "getMilestone", [BigInt(taskId), BigInt(milestoneIndex)]);
        return formatReadResult(data, `Milestone ${milestoneIndex} of Task #${taskId}`);
      } catch (e) { const p = parseContractError(e); return formatStructuredError(p.error, p.cause, p.fix, p.retryable); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_create_subtask
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_create_subtask",
    {
      title: "Create Subtask",
      description:
        "Creates a child task under a parent task with its own worker, payment, and deadline.\n" +
        "USE WHEN: Decomposing a large task into parallel subtasks for different specialists.\n" +
        "REQUIRES: Parent task must exist. Both client and subtask worker must be registered. Client wallet needs payment + ~2% fees.\n" +
        "RETURNS: Subtask taskId, parent reference, worker, payment, deadline.\n" +
        "COMES AFTER: corven_create_task created the parent task.\n" +
        "COMES BEFORE: Subtask worker calls corven_submit_work. Client calls corven_verify_task on the subtask.\n" +
        "NOTE: Subtask payment is funded independently from the parent. Use corven_get_child_tasks to list all subtasks.",
      inputSchema: {
        parentTaskId: taskIdSchema,
        worker: ethAddress,
        payment: ethAmount,
        deadline: unixDeadline,
        descriptionHash: ipfsCid,
      },
    },
    async ({ parentTaskId, worker, payment, deadline, descriptionHash }) => {
      try {
        const account = getAccount();
        if (!account) return formatStructuredError("No private key configured.", "PRIVATE_KEY not set.", "Set PRIVATE_KEY in .env.", false);
        const paymentWei = parseEther(payment);

        // Calculate total value: payment + protocol fee (1%) + priority fee (default Medium=1%)
        const PROTOCOL_FEE_BPS = 100n;
        const PRIORITY_FEE_BPS = 100n;
        const totalFeeBps = PROTOCOL_FEE_BPS + PRIORITY_FEE_BPS;
        const feeAmount = paymentWei * totalFeeBps / 10000n;
        const totalValue = paymentWei + feeAmount;

        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow, ABI, "createSubtask",
          [BigInt(parentTaskId), worker as Address, paymentWei, BigInt(deadline), descriptionHash], totalValue
        );
        return formatTxResult(result);
      } catch (e) { const p = parseContractError(e); return formatStructuredError(p.error, p.cause, p.fix, p.retryable); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_child_tasks
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_child_tasks",
    {
      title: "Get Child Tasks",
      description:
        "Returns the IDs of all child tasks (subtasks) under a parent task.\n" +
        "USE WHEN: Tracking progress of decomposed tasks. Checking if all subtasks are complete before parent verification.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Parent task ID, child count, array of child task IDs.\n" +
        "COMES AFTER: corven_create_subtask created child tasks.\n" +
        "COMES BEFORE: Use corven_get_task on each child ID to check individual status.",
      inputSchema: { parentTaskId: taskIdSchema },
    },
    async ({ parentTaskId }) => {
      try {
        const childIds = await readContract(
          CONTRACTS.TaskEscrow, ABI, "getChildTasks", [BigInt(parentTaskId)]
        );
        return formatReadResult(
          { parentTaskId, childCount: (childIds as any[]).length, childTaskIds: childIds },
          `Child tasks of Task #${parentTaskId}`
        );
      } catch (e) { const p = parseContractError(e); return formatStructuredError(p.error, p.cause, p.fix, p.retryable); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_submit_query
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_submit_query",
    {
      title: "Submit Task Query",
      description:
        "Worker submits a clarifying question about a task during execution. The query is recorded on-chain.\n" +
        "USE WHEN: Task specification is ambiguous. You need additional resources. You want to confirm feasibility before proceeding.\n" +
        "REQUIRES: You must be the assigned worker. Task must be in Funded or InProgress status.\n" +
        "RETURNS: Query ID, task ID, query type, submission confirmation.\n" +
        "COMES AFTER: corven_create_task assigned you the task.\n" +
        "COMES BEFORE: Client calls corven_respond_to_query. Then you continue work.\n" +
        "NOTE: Query types: 0=Specification (unclear requirements), 1=Resource (need more time/data), 2=Feasibility (concern about viability).",
      inputSchema: {
        taskId: taskIdSchema,
        queryText: z.string().describe("The query text"),
        queryType: z.number().describe("Query type: 0=Specification, 1=Resource, 2=Feasibility"),
      },
    },
    async ({ taskId, queryText, queryType }) => {
      try {
        const account = getAccount();
        if (!account) return formatStructuredError("No private key configured.", "PRIVATE_KEY not set.", "Set PRIVATE_KEY in .env.", false);
        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow, ABI, "submitQuery",
          [BigInt(taskId), queryText, queryType]
        );
        return formatTxResult(result);
      } catch (e) { const p = parseContractError(e); return formatStructuredError(p.error, p.cause, p.fix, p.retryable); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_respond_to_query
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_respond_to_query",
    {
      title: "Respond to Query",
      description:
        "Client responds to a worker's clarifying query about a task. Response is recorded on-chain.\n" +
        "USE WHEN: A worker has submitted a query (corven_get_query shows pending queries). You want to provide clarification.\n" +
        "REQUIRES: You must be the task client. A query must exist on the task.\n" +
        "RETURNS: Response confirmation, task ID, response text recorded.\n" +
        "COMES AFTER: corven_submit_query by the worker.\n" +
        "COMES BEFORE: Worker continues task execution with your clarification.\n" +
        "NOTE: Check query details first with corven_get_query to understand what the worker is asking.",
      inputSchema: {
        taskId: taskIdSchema,
        responseText: z.string().describe("The response text"),
      },
    },
    async ({ taskId, responseText }) => {
      try {
        const account = getAccount();
        if (!account) return formatStructuredError("No private key configured.", "PRIVATE_KEY not set.", "Set PRIVATE_KEY in .env.", false);
        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow, ABI, "respondToQuery",
          [BigInt(taskId), responseText]
        );
        return formatTxResult(result);
      } catch (e) { const p = parseContractError(e); return formatStructuredError(p.error, p.cause, p.fix, p.retryable); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_query (includes count when no queryId provided)
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_query",
    {
      title: "Get Query",
      description:
        "Reads query details by index, or returns the total query count if no index is provided.\n" +
        "USE WHEN: Checking if a worker has submitted questions. Reading query text before responding. Counting outstanding queries.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Query text, type (Specification/Resource/Feasibility), response status — or query count if index omitted.\n" +
        "COMES AFTER: corven_submit_query created a query.\n" +
        "COMES BEFORE: corven_respond_to_query to provide an answer.",
      inputSchema: {
        taskId: taskIdSchema,
        queryId: z.number().optional().describe("Query index (0-based). Omit to get count."),
      },
    },
    async ({ taskId, queryId }) => {
      try {
        if (queryId === undefined) {
          const count = await readContract(CONTRACTS.TaskEscrow, ABI, "getQueryCount", [BigInt(taskId)]);
          return formatReadResult({ taskId, queryCount: Number(count) }, `Query count for Task #${taskId}`);
        }
        const data = await readContract(CONTRACTS.TaskEscrow, ABI, "getQuery", [BigInt(taskId), BigInt(queryId)]);
        return formatReadResult(data, `Query ${queryId} on Task #${taskId}`);
      } catch (e) { const p = parseContractError(e); return formatStructuredError(p.error, p.cause, p.fix, p.retryable); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_tasks (consolidated: client, worker, or child tasks)
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_tasks",
    {
      title: "Get Tasks",
      description:
        "Returns all task IDs where the given address is the client or the worker.\n" +
        "USE WHEN: Finding your active tasks. Checking which tasks you need to work on. Building a task dashboard.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Address, role, task count, array of task IDs.\n" +
        "COMES BEFORE: Use corven_get_task on each returned ID to get full details.\n" +
        "NOTE: Use role='worker' to find tasks assigned to you. Use role='client' to find tasks you posted.",
      inputSchema: {
        address: ethAddress,
        role: z.enum(["client", "worker"]).describe("Filter: 'client' or 'worker'"),
      },
    },
    async ({ address, role }) => {
      try {
        const fn = role === "client" ? "getClientTasks" : "getWorkerTasks";
        const taskIds = await readContract(CONTRACTS.TaskEscrow, ABI, fn, [address as Address]);
        return formatReadResult(
          { address, role, taskCount: (taskIds as unknown[]).length, taskIds },
          `Tasks where ${address} is ${role}`
        );
      } catch (e) { const p = parseContractError(e); return formatStructuredError(p.error, p.cause, p.fix, p.retryable); }
    }
  );
}
