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
import { formatTxResult, formatReadResult, formatError } from "../handlers/transactions.js";
import { TASK_STATUS, PRIORITY_LEVEL } from "../types.js";
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
  taskId: z.number().int().positive()
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
    "create_task",
    {
      title: "Create & Fund Task",
      description:
        "Create a new task on TaskEscrow, assign a worker, fund it with ETH, " +
        "and set a deadline. The payment value is sent as msg.value. " +
        "descriptionHash is typically an IPFS CID pointing to task details.",
      inputSchema: {
        worker: z.string().describe("Worker agent's Ethereum address"),
        payment: z.string().describe("Payment amount in ETH, e.g. '0.01'"),
        deadline: z
          .number()
          .describe("Unix timestamp deadline (seconds since epoch)"),
        descriptionHash: z
          .string()
          .describe("IPFS CID or on-chain hash for task description"),
        priority: z
          .number()
          .optional()
          .describe("Priority level 0-3 (Low/Medium/High/Urgent). Default 1 (Medium)"),
      },
    },
    async ({ worker, payment, deadline, descriptionHash, priority }) => {
      try {
        // Validate input
        const validationResult = createTaskSchema.safeParse({ worker, payment, deadline, descriptionHash, priority });
        if (!validationResult.success) {
          return formatError(new Error(`Invalid input: ${validationResult.error.issues.map((e: any) => e.message).join(", ")}`));
        }

        // Validation successful, use validated values
        const validatedWorker = worker;
        const validatedPayment = payment;
        const validatedDeadline = deadline;
        const validatedDescriptionHash = descriptionHash;
        const validatedPriority = priority;
        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured — cannot send transactions"));
        }

        const paymentWei = parseEther(payment);
        const priorityLevel = priority ?? 1;

        // Use createAndFundTask which is the combined function used by client.ts
        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow,
          ABI,
          "createAndFundTask",
          [
            validatedWorker as Address,
            paymentWei,
            BigInt(validatedDeadline),
            validatedDescriptionHash,
          ],
          paymentWei // send ETH as msg.value
        );
        return formatTxResult(result);
      } catch (e) {
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // get_task
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "get_task",
    {
      title: "Get Task Details",
      description:
        "Retrieve full on-chain details for a task by its numeric ID. " +
        "Returns client, worker, payment, deadline, status (human-readable), hashes, and timestamps.",
      inputSchema: {
        taskId: z.number().describe("Numeric task ID"),
      },
    },
    async ({ taskId }) => {
      try {
        // Validate input
        const taskIdParam = taskId;
        const validationResult = getTaskSchema.safeParse({ taskId: taskIdParam });
        if (!validationResult.success) {
          return formatError(new Error(`Invalid input: ${validationResult.error.issues.map((e: any) => e.message).join(", ")}`));
        }

        // Use validated taskId
        const validatedTaskId = validationResult.data.taskId;
        const data = await readContract(
          CONTRACTS.TaskEscrow,
          ABI,
          "getTask",
          [BigInt(validatedTaskId)]
        );

        // Enrich status and priority with human-readable labels
        const enriched = {
          ...(data as any),
          statusLabel: TASK_STATUS[(data as any).status] ?? `Unknown(${(data as any).status})`,
          paymentEth: formatEther((data as any).payment),
        };

        return formatReadResult(enriched, `Task #${taskId}`);
      } catch (e) {
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // submit_work
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "submit_work",
    {
      title: "Submit Work Deliverable",
      description:
        "Worker submits a deliverable hash (typically IPFS CID) for a task. " +
        "Only the assigned worker can call this. Transitions task status to Submitted.",
      inputSchema: {
        taskId: z.number().describe("Numeric task ID"),
        deliverableHash: z
          .string()
          .describe("IPFS CID or hash of the deliverable"),
      },
    },
    async ({ taskId, deliverableHash }) => {
      try {
        // Validate input
        const validationResult = submitWorkSchema.safeParse({ taskId, deliverableHash });
        if (!validationResult.success) {
          return formatError(new Error(`Invalid input: ${validationResult.error.issues.map((e: any) => e.message).join(", ")}`));
        }

        // Use validated values
        const validatedTaskId = validationResult.data.taskId;
        const validatedDeliverableHash = validationResult.data.deliverableHash;
        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured — cannot send transactions"));
        }

        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow,
          ABI,
          "submitWork",
          [BigInt(validatedTaskId), validatedDeliverableHash]
        );
        return formatTxResult(result);
      } catch (e) {
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // verify_task
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "verify_task",
    {
      title: "Verify & Approve Task",
      description:
        "Client verifies a submitted task and releases payment to the worker. " +
        "Only the task client can call this. Transitions status to Completed.",
      inputSchema: {
        taskId: z.number().describe("Numeric task ID"),
      },
    },
    async ({ taskId }) => {
      try {
        // Validate input
        const validationResult = verifyTaskSchema.safeParse({ taskId });
        if (!validationResult.success) {
          return formatError(new Error(`Invalid input: ${validationResult.error.issues.map((e: any) => e.message).join(", ")}`));
        }

        // Use validated taskId
        const validatedTaskId = validationResult.data.taskId;
        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured — cannot send transactions"));
        }

        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow,
          ABI,
          "verifyTask",
          [BigInt(validatedTaskId)],
          undefined,
          "TaskEscrow"
        );
        return formatTxResult(result);
      } catch (e) {
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // dispute_task
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "dispute_task",
    {
      title: "Dispute a Task",
      description:
        "Open a dispute on a task. Either the client or worker can dispute. " +
        "Transitions status to Disputed and pauses payment release.",
      inputSchema: {
        taskId: z.number().describe("Numeric task ID"),
        reason: z
          .string()
          .optional()
          .describe("Optional reason for the dispute (stored off-chain / emitted in event)"),
      },
    },
    async ({ taskId, reason }) => {
      try {
        // Validate input
        const validationResult = disputeTaskSchema.safeParse({ taskId, reason });
        if (!validationResult.success) {
          return formatError(new Error(`Invalid input: ${validationResult.error.issues.map((e: any) => e.message).join(", ")}`));
        }

        // Use validated values
        const validatedTaskId = validationResult.data.taskId;
        const validatedReason = validationResult.data.reason;
        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured — cannot send transactions"));
        }

        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow,
          ABI,
          "disputeTask",
          [BigInt(validatedTaskId)],
          undefined,
          "TaskEscrow"
        );
        return formatTxResult(result);
      } catch (e) {
        return formatError(e);
      }
    }
  );
}
