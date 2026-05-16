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
    "corven_create_task",
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
    "corven_get_task",
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
    "corven_submit_work",
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
    "corven_verify_task",
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
    "corven_dispute_task",
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

  // ──────────────────────────────────────────────────────────────
  // corven_create_task_with_priority
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_create_task_with_priority",
    {
      title: "Create Task with Priority",
      description:
        "Create a task with a specific priority level (0=Low, 1=Medium, 2=High, 3=Urgent). " +
        "Higher priority incurs additional protocol fees.",
      inputSchema: {
        worker: z.string().describe("Worker agent's Ethereum address"),
        payment: z.string().describe("Payment amount in ETH"),
        deadline: z.number().describe("Unix timestamp deadline (seconds)"),
        descriptionHash: z.string().describe("IPFS CID for task description"),
        priority: z.number().describe("Priority level: 0=Low, 1=Medium, 2=High, 3=Urgent"),
      },
    },
    async ({ worker, payment, deadline, descriptionHash, priority }) => {
      try {
        const account = getAccount();
        if (!account) return formatError(new Error("No private key configured"));
        const paymentWei = parseEther(payment);
        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow, ABI, "createAndFundTaskWithPriority",
          [worker as Address, paymentWei, BigInt(deadline), descriptionHash, priority], paymentWei
        );
        return formatTxResult(result);
      } catch (e) { return formatError(e); }
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
        "Create a task with milestone-based payments. Each milestone has its own description and payment amount. " +
        "Total payment = sum of all milestone payments.",
      inputSchema: {
        worker: z.string().describe("Worker agent's Ethereum address"),
        totalPayment: z.string().describe("Total payment in ETH (sum of milestones)"),
        deadline: z.number().describe("Unix timestamp deadline"),
        descriptionHash: z.string().describe("IPFS CID for task description"),
        milestoneDescriptions: z.array(z.string()).describe("Array of milestone descriptions"),
        milestonePayments: z.array(z.string()).describe("Array of milestone payments in ETH"),
      },
    },
    async ({ worker, totalPayment, deadline, descriptionHash, milestoneDescriptions, milestonePayments }) => {
      try {
        const account = getAccount();
        if (!account) return formatError(new Error("No private key configured"));
        const paymentWei = parseEther(totalPayment);
        const payments = milestonePayments.map(p => parseEther(p));
        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow, ABI, "createTaskWithMilestones",
          [worker as Address, paymentWei, BigInt(deadline), descriptionHash, milestoneDescriptions, payments], paymentWei
        );
        return formatTxResult(result);
      } catch (e) { return formatError(e); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_submit_milestone
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_submit_milestone",
    {
      title: "Submit Milestone",
      description: "Submit a deliverable for a specific milestone in a milestone-based task.",
      inputSchema: {
        taskId: z.number().describe("Task ID"),
        milestoneIndex: z.number().describe("Milestone index (0-based)"),
        deliverableHash: z.string().describe("IPFS CID of milestone deliverable"),
      },
    },
    async ({ taskId, milestoneIndex, deliverableHash }) => {
      try {
        const account = getAccount();
        if (!account) return formatError(new Error("No private key configured"));
        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow, ABI, "submitMilestone",
          [BigInt(taskId), BigInt(milestoneIndex), deliverableHash]
        );
        return formatTxResult(result);
      } catch (e) { return formatError(e); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_verify_milestone
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_verify_milestone",
    {
      title: "Verify Milestone",
      description: "Verify a submitted milestone and release its payment to the worker.",
      inputSchema: {
        taskId: z.number().describe("Task ID"),
        milestoneIndex: z.number().describe("Milestone index (0-based)"),
        success: z.boolean().describe("Whether the milestone passes verification"),
      },
    },
    async ({ taskId, milestoneIndex, success }) => {
      try {
        const account = getAccount();
        if (!account) return formatError(new Error("No private key configured"));
        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow, ABI, "verifyMilestone",
          [BigInt(taskId), BigInt(milestoneIndex), success], undefined, "TaskEscrow"
        );
        return formatTxResult(result);
      } catch (e) { return formatError(e); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_milestone
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_milestone",
    {
      title: "Get Milestone Details",
      description: "Retrieve details of a specific milestone in a task.",
      inputSchema: {
        taskId: z.number().describe("Task ID"),
        milestoneIndex: z.number().describe("Milestone index (0-based)"),
      },
    },
    async ({ taskId, milestoneIndex }) => {
      try {
        const data = await readContract(
          CONTRACTS.TaskEscrow, ABI, "getMilestone", [BigInt(taskId), BigInt(milestoneIndex)]
        );
        return formatReadResult(data, `Milestone ${milestoneIndex} of Task #${taskId}`);
      } catch (e) { return formatError(e); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_milestone_count
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_milestone_count",
    {
      title: "Get Milestone Count",
      description: "Get the number of milestones in a task.",
      inputSchema: { taskId: z.number().describe("Task ID") },
    },
    async ({ taskId }) => {
      try {
        const count = await readContract(
          CONTRACTS.TaskEscrow, ABI, "getMilestoneCount", [BigInt(taskId)]
        );
        return formatReadResult({ taskId, milestoneCount: Number(count) }, `Milestones for Task #${taskId}`);
      } catch (e) { return formatError(e); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_create_subtask
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_create_subtask",
    {
      title: "Create Subtask",
      description: "Create a child task under a parent task. The subtask has its own worker and payment.",
      inputSchema: {
        parentTaskId: z.number().describe("Parent task ID"),
        worker: z.string().describe("Worker address for the subtask"),
        payment: z.string().describe("Payment in ETH"),
        deadline: z.number().describe("Unix timestamp deadline"),
        descriptionHash: z.string().describe("IPFS CID for subtask description"),
      },
    },
    async ({ parentTaskId, worker, payment, deadline, descriptionHash }) => {
      try {
        const account = getAccount();
        if (!account) return formatError(new Error("No private key configured"));
        const paymentWei = parseEther(payment);
        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow, ABI, "createSubtask",
          [BigInt(parentTaskId), worker as Address, paymentWei, BigInt(deadline), descriptionHash], paymentWei
        );
        return formatTxResult(result);
      } catch (e) { return formatError(e); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_child_tasks
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_child_tasks",
    {
      title: "Get Child Tasks",
      description: "Get the IDs of all child tasks under a parent task.",
      inputSchema: { parentTaskId: z.number().describe("Parent task ID") },
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
      } catch (e) { return formatError(e); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_submit_query
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_submit_query",
    {
      title: "Submit Task Query",
      description: "Submit a query about a task during execution. Allows workers to ask clarifying questions.",
      inputSchema: {
        taskId: z.number().describe("Task ID"),
        queryText: z.string().describe("The query text"),
        queryType: z.number().describe("Query type: 0=Specification, 1=Resource, 2=Feasibility"),
      },
    },
    async ({ taskId, queryText, queryType }) => {
      try {
        const account = getAccount();
        if (!account) return formatError(new Error("No private key configured"));
        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow, ABI, "submitQuery",
          [BigInt(taskId), queryText, queryType]
        );
        return formatTxResult(result);
      } catch (e) { return formatError(e); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_respond_to_query
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_respond_to_query",
    {
      title: "Respond to Query",
      description: "Respond to a worker's query about a task. Only the task client can respond.",
      inputSchema: {
        taskId: z.number().describe("Task ID"),
        responseText: z.string().describe("The response text"),
      },
    },
    async ({ taskId, responseText }) => {
      try {
        const account = getAccount();
        if (!account) return formatError(new Error("No private key configured"));
        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow, ABI, "respondToQuery",
          [BigInt(taskId), responseText]
        );
        return formatTxResult(result);
      } catch (e) { return formatError(e); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_query
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_query",
    {
      title: "Get Query Details",
      description: "Retrieve details of a specific query on a task.",
      inputSchema: {
        taskId: z.number().describe("Task ID"),
        queryId: z.number().describe("Query index (0-based)"),
      },
    },
    async ({ taskId, queryId }) => {
      try {
        const data = await readContract(
          CONTRACTS.TaskEscrow, ABI, "getQuery", [BigInt(taskId), BigInt(queryId)]
        );
        return formatReadResult(data, `Query ${queryId} on Task #${taskId}`);
      } catch (e) { return formatError(e); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_query_count
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_query_count",
    {
      title: "Get Query Count",
      description: "Get the number of queries submitted on a task.",
      inputSchema: { taskId: z.number().describe("Task ID") },
    },
    async ({ taskId }) => {
      try {
        const count = await readContract(
          CONTRACTS.TaskEscrow, ABI, "getQueryCount", [BigInt(taskId)]
        );
        return formatReadResult({ taskId, queryCount: Number(count) }, `Queries on Task #${taskId}`);
      } catch (e) { return formatError(e); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_client_tasks
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_client_tasks",
    {
      title: "Get Client Tasks",
      description: "Get all task IDs where the given address is the client.",
      inputSchema: { client: z.string().describe("Client's Ethereum address") },
    },
    async ({ client }) => {
      try {
        const taskIds = await readContract(
          CONTRACTS.TaskEscrow, ABI, "getClientTasks", [client as Address]
        );
        return formatReadResult(
          { client, taskCount: (taskIds as any[]).length, taskIds },
          `Tasks by client ${client}`
        );
      } catch (e) { return formatError(e); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_worker_tasks
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_worker_tasks",
    {
      title: "Get Worker Tasks",
      description: "Get all task IDs where the given address is the worker.",
      inputSchema: { worker: z.string().describe("Worker's Ethereum address") },
    },
    async ({ worker }) => {
      try {
        const taskIds = await readContract(
          CONTRACTS.TaskEscrow, ABI, "getWorkerTasks", [worker as Address]
        );
        return formatReadResult(
          { worker, taskCount: (taskIds as any[]).length, taskIds },
          `Tasks by worker ${worker}`
        );
      } catch (e) { return formatError(e); }
    }
  );
}
