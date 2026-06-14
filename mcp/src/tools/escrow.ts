/**
 * TaskEscrow MCP Tools (V4)
 *
 * create_task   — Create a task on-chain (one-shot)
 * get_task      — Read task details by ID
 * submit_work   — Submit deliverable hash for a task
 * complete_task — Mark a submitted task as verified / completed
 * dispute_task  — Open a dispute on a task
 */
import { z } from "zod";
import { parseEther, formatEther, type Address, isAddress } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatSuccess, formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import { ethAddress, ethAmount, unixDeadline, taskId as taskIdSchema } from "../lib/schemaHelpers.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("TaskEscrow");

const V4_STATUS_LABELS: Record<number, string> = {
  0: "None",
  1: "Created",
  2: "Funded",
  3: "Submitted",
  4: "Disputed",
  5: "Completed",
  6: "Failed",
  7: "Cancelled",
};

const createTaskSchema = z.object({
  worker: z.string().refine(isAddress, { message: "Invalid worker Ethereum address" }),
  payment: z.string().regex(/^\d+\.\d{1,18}$/, "Invalid ETH amount format")
    .refine(val => {
      const paymentAmount = parseFloat(val);
      return paymentAmount >= 0.001 && paymentAmount <= 1000;
    }, { message: "Payment must be between 0.001 and 1000 ETH" }),
  deadline: z.number().int().positive()
    .refine(val => {
      const deadlineTimestamp = val * 1000;
      const now = Date.now();
      const oneYearFromNow = now + (365 * 24 * 60 * 60 * 1000);
      return deadlineTimestamp > now && deadlineTimestamp < oneYearFromNow;
    }, { message: "Deadline must be a future timestamp within 1 year" }),
  metaHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, { message: "metaHash must be a valid bytes32 hex string (0x + 64 hex chars)" }),
});

const getTaskSchema = z.object({
  taskId: z.number().int().positive(),
});

const submitWorkSchema = z.object({
  taskId: z.number().int().positive(),
  deliverableHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, { message: "deliverableHash must be a valid bytes32 hex string (0x + 64 hex chars)" }),
});

const completeTaskSchema = z.object({
  taskId: z.number().int().positive(),
  clientSignature: z.string().regex(/^0x[0-9a-fA-F]+$/, { message: "clientSignature must be a valid hex string" }),
});

const disputeTaskSchema = z.object({
  taskId: z.number().int().positive(),
});

export function registerEscrowTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // create_task  (V4: createTask + fundTask)
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_create_task",
    {
      title: "Create Task",
      description:
        "Creates a task and locks payment in escrow. Calls createTask then fundTask on the V4 CovenantEscrow contract.\n" +
        "REQUIRES: Worker must be a valid address. Client wallet needs payment amount plus ~0.001 ETH gas.\n" +
        "RETURNS: taskId (save for all subsequent calls), escrow status, deadline, worker address, Basescan link.\n" +
        "NOTE: Payment is locked — neither party can access it until verification completes.",
      inputSchema: {
        worker: ethAddress,
        payment: ethAmount,
        deadline: unixDeadline,
        metaHash: z.string().describe("bytes32 metadata hash (0x + 64 hex chars)"),
      },
    },
    async ({ worker, payment, deadline, metaHash }) => {
      try {
        const validationResult = createTaskSchema.safeParse({ worker, payment, deadline, metaHash });
        if (!validationResult.success) {
          return formatStructuredError(
            "Invalid task parameters.",
            validationResult.error.issues.map((e: any) => e.message).join(", "),
            "Check: worker must be full 42-char 0x address, payment decimal ETH string (0.001-1000), deadline future Unix timestamp, metaHash valid bytes32 hex.",
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
        const amount128 = BigInt(paymentWei);

        const result = await executeOrPrepare(
          CONTRACTS.TaskEscrow,
          ABI,
          "createTask",
          [
            worker as Address,
            amount128,
            BigInt(deadline),
            metaHash as `0x${string}`,
          ],
          paymentWei
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
              metaHash,
              status: "Created",
            },
            result.txHash,
            [
              "Worker can begin once you fund the task with corven_fund_task.",
              "Then worker calls corven_submit_work.",
              "Finally, client calls corven_complete_task to release payment.",
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
  // get_task  (V4: getTask)
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_task",
    {
      title: "Get Task Details",
      description:
        "Returns complete details for any task including current lifecycle status.\n" +
        "USE WHEN: Checking if a worker has submitted work. Confirming payment released. Checking deadline.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Status, client/worker addresses, amount (uint128), deadline, metaHash, disputeCount.\n" +
        "STATUS MEANINGS: Created=task exists. Funded=payment locked. Submitted=work ready for review. Disputed=jury resolution. Completed=paid. Failed=rejected. Cancelled=client cancelled.",
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
            "Pass the numeric taskId returned by corven_create_task.",
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

        const task = data as any;
        const enriched = {
          ...task,
          statusLabel: V4_STATUS_LABELS[task.status as number] ?? `Unknown(${task.status})`,
          paymentEth: formatEther(task.amount),
        };

        return formatReadResult(enriched, `Task #${taskId}`);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // submit_work  (V4: submitWork)
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_submit_work",
    {
      title: "Submit Work Deliverable",
      description:
        "Worker submits completed deliverable hash on-chain. Commits work permanently and notifies the client.\n" +
        "USE WHEN: You are the worker and have finished executing the task.\n" +
        "REQUIRES: You must be the assigned worker. Task status must be Funded. Deadline must not have passed.\n" +
        "RETURNS: Submission confirmation, deliverable hash recorded on-chain, next action for the client.\n" +
        "NOTE: deliverableHash must be bytes32 (0x + 64 hex chars).",
      inputSchema: {
        taskId: taskIdSchema,
        deliverableHash: z.string().describe("bytes32 deliverable hash (0x + 64 hex chars)"),
      },
    },
    async ({ taskId, deliverableHash }) => {
      try {
        const validationResult = submitWorkSchema.safeParse({ taskId, deliverableHash });
        if (!validationResult.success) {
          return formatStructuredError(
            "Invalid parameters.",
            validationResult.error.issues.map((e: any) => e.message).join(", "),
            "taskId must be a positive integer. deliverableHash must be bytes32 (0x + 64 hex chars).",
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
          [BigInt(taskId), deliverableHash as `0x${string}`]
        );

        if (result.status === "success") {
          return formatSuccess(
            `Work submitted for Task #${taskId}. Client will be notified.`,
            { taskId, deliverableHash, status: "Submitted" },
            result.txHash,
            ["Wait for client to review and call corven_complete_task.", "Payment releases automatically on approval."]
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
  // complete_task  (V4: completeTask)
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_verify_task",
    {
      title: "Complete & Approve Task",
      description:
        "Client approves submitted work by providing a signature. Triggers payment release to the worker.\n" +
        "USE WHEN: You are the client. Worker has submitted work (corven_get_task shows status Submitted). You have reviewed and approve.\n" +
        "REQUIRES: You must be the client. Task status must be Submitted. Call corven_dispute_task instead to reject.\n" +
        "RETURNS: Payment release confirmation, Basescan link.\n" +
        "NOTE: clientSignature is the signed message authorizing task completion (bytes, hex-encoded).",
      inputSchema: {
        taskId: taskIdSchema,
        clientSignature: z.string().describe("Client's signature authorizing completion (hex-encoded bytes)"),
      },
    },
    async ({ taskId, clientSignature }) => {
      try {
        const validationResult = completeTaskSchema.safeParse({ taskId, clientSignature });
        if (!validationResult.success) {
          return formatStructuredError(
            "Invalid parameters.",
            validationResult.error.issues.map((e: any) => e.message).join(", "),
            "taskId must be positive integer. clientSignature must be valid hex string (0x...).",
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
          "completeTask",
          [BigInt(taskId), clientSignature as `0x${string}`],
          undefined,
          "TaskEscrow"
        );

        if (result.status === "success") {
          return formatSuccess(
            `Task #${taskId} completed. Payment released to worker.`,
            { taskId, status: "Completed" },
            result.txHash,
            [
              "Payment has been transferred to the worker's wallet.",
              "Both agents' reputation scores have been updated.",
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
  // dispute_task  (V4: disputeTask)
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_dispute_task",
    {
      title: "Dispute a Task",
      description:
        "Freezes a task and initiates dispute resolution.\n" +
        "USE WHEN: You are the client and submitted work fails the specification. Or you are the worker and were unfairly rejected.\n" +
        "REQUIRES: Task status must be Submitted or Disputed. Either client or worker can call.\n" +
        "RETURNS: Dispute confirmation, disputeCount incremented.\n" +
        "NOTE: Call corven_get_task first to confirm the task status.",
      inputSchema: {
        taskId: taskIdSchema,
      },
    },
    async ({ taskId }) => {
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
            `Task #${taskId} disputed. Payment frozen pending resolution.`,
            { taskId, status: "Disputed" },
            result.txHash,
            ["Dispute resolution is now in progress.", "Check corven_get_task for updated status."]
          );
        }
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
