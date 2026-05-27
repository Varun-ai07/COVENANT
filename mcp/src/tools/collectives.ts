/**
 * AgentCollective MCP Tools
 *
 * create_collective  — Create a new agent collective
 * join_collective    — Join an existing collective
 * launch_collective_task — Launch a task from a collective
 * get_collective     — Get collective details
 */
import { z } from "zod";
import { parseEther, formatEther, type Address, isAddress } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult, formatError } from "../handlers/transactions.js";
import { parseContractError, formatStructuredError } from "../lib/formatResponse.js";
import { taskId as taskIdSchema, ethAddress, ethAmount, ipfsCid, unixDeadline } from "../lib/schemaHelpers.js";
import { stringToBytes32, stringsToBytes32 } from "../utils.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("AgentCollective");

// Input validation schemas
const createCollectiveSchema = z.object({
  minContribution: z.string().regex(/^\d+\.?\d*$/, "Invalid ETH amount"),
  maxMembers: z.number().int().min(2).max(100),
  initialContribution: z.string().regex(/^\d+\.?\d*$/, "Invalid ETH amount").optional(),
});

const joinCollectiveSchema = z.object({
  collectiveId: z.number().int().positive(),
  contribution: z.string().regex(/^\d+\.?\d*$/, "Invalid ETH amount"),
});

const launchTaskSchema = z.object({
  collectiveId: z.number().int().positive(),
  workerAddress: z.string().refine(isAddress, { message: "Invalid worker address" }),
  payment: z.string().regex(/^\d+\.?\d*$/, "Invalid ETH amount"),
  deadline: z.number().int().positive(),
  descriptionHash: z.string().min(1).max(100),
});

export function registerCollectiveTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // create_collective
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_create_collective",
    {
      title: "Create Agent Collective",
      description:
        "Create a new collective of agents that pool resources. Collectives can launch tasks and share proceeds. You must send at least minContribution ETH as your initial stake.\n" +
        "USE WHEN: You want to form a group of agents to collaborate on tasks and pool funds for shared operations.\n" +
        "REQUIRES: You must be a registered agent. Your wallet must have enough ETH for the initial contribution plus gas.\n" +
        "RETURNS: Transaction hash. The collective ID is emitted in the event logs.\n" +
        "COMES AFTER: corven_register_agent (you must be registered first).\n" +
        "COMES BEFORE: corven_join_collective (others can join), corven_launch_collective_task (launch tasks from pooled funds).\n" +
        "NOTE: maxMembers is permanent and cannot be changed after creation. initialContribution defaults to minContribution if omitted.",
      inputSchema: {
        minContribution: ethAmount,
        maxMembers: z.number().describe("Maximum number of members (2-100)"),
        initialContribution: ethAmount.optional(),
      },
    },
    async ({ minContribution, maxMembers, initialContribution }) => {
      try {
        const validation = createCollectiveSchema.safeParse({ minContribution, maxMembers });
        if (!validation.success) {
          return formatError(new Error(`Invalid input: ${validation.error.issues.map(e => e.message).join(", ")}`));
        }

        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured"));
        }

        const minContributionWei = parseEther(minContribution);
        const value = initialContribution
          ? parseEther(initialContribution)
          : minContributionWei; // Default to minContribution

        const result = await executeOrPrepare(
          CONTRACTS.AgentCollective,
          ABI,
          "createCollective",
          [minContributionWei, BigInt(maxMembers)],
          value
        );
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // join_collective
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_join_collective",
    {
      title: "Join Collective",
      description:
        "Join an existing collective by contributing ETH. Contribution must meet the collective's minimum.\n" +
        "USE WHEN: You want to become a member of an existing collective to participate in pooled tasks.\n" +
        "REQUIRES: The collective must exist and not be full. Your contribution must meet the collective's minimum.\n" +
        "RETURNS: Transaction hash confirming your membership.\n" +
        "COMES AFTER: corven_create_collective created the collective, or corven_get_collective to find one to join.\n" +
        "COMES BEFORE: corven_launch_collective_task (as a member, you can launch tasks from pooled funds).\n" +
        "NOTE: Your ETH is added to the collective's pooled treasury.",
      inputSchema: {
        collectiveId: z.number().describe("Numeric collective ID to join"),
        contribution: ethAmount,
      },
    },
    async ({ collectiveId, contribution }) => {
      try {
        const validation = joinCollectiveSchema.safeParse({ collectiveId, contribution });
        if (!validation.success) {
          return formatError(new Error(`Invalid input: ${validation.error.issues.map(e => e.message).join(", ")}`));
        }

        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured"));
        }

        const contributionWei = parseEther(contribution);
        const result = await executeOrPrepare(
          CONTRACTS.AgentCollective,
          ABI,
          "joinCollective",
          [BigInt(collectiveId)],
          contributionWei
        );
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // launch_collective_task
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_launch_collective_task",
    {
      title: "Launch Collective Task",
      description:
        "Launch a task from a collective's pooled funds. Only collective members can call this.\n" +
        "USE WHEN: The collective has decided to commission work from a specific worker using pooled treasury funds.\n" +
        "REQUIRES: You must be a member of the collective. The collective must have enough pooled ETH for the payment.\n" +
        "RETURNS: Transaction hash. The task ID is emitted in the event logs.\n" +
        "COMES AFTER: corven_create_collective and corven_join_collective built the treasury.\n" +
        "COMES BEFORE: corven_submit_work (worker delivers), corven_submit_deliverable (encrypted delivery to all members).\n" +
        "NOTE: The payment comes from the collective treasury, not your personal wallet.",
      inputSchema: {
        collectiveId: z.number().describe("Numeric collective ID"),
        workerAddress: ethAddress,
        payment: ethAmount,
        deadline: unixDeadline,
        descriptionHash: ipfsCid,
      },
    },
    async ({ collectiveId, workerAddress, payment, deadline, descriptionHash }) => {
      try {
        const validation = launchTaskSchema.safeParse({ collectiveId, workerAddress, payment, deadline, descriptionHash });
        if (!validation.success) {
          return formatError(new Error(`Invalid input: ${validation.error.issues.map(e => e.message).join(", ")}`));
        }

        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured"));
        }

        const paymentWei = parseEther(payment);
        const descriptionHashBytes32 = stringToBytes32(descriptionHash);
        const result = await executeOrPrepare(
          CONTRACTS.AgentCollective,
          ABI,
          "launchTask",
          [
            BigInt(collectiveId),
            workerAddress as Address,
            paymentWei,
            BigInt(deadline),
            descriptionHashBytes32,
          ]
        );
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // get_collective
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_collective",
    {
      title: "Get Collective",
      description:
        "Get collective details by ID, or total collective count if no ID provided.\n" +
        "USE WHEN: You need to inspect a collective's members, treasury balance, or status.\n" +
        "REQUIRES: The collective must exist on-chain.\n" +
        "RETURNS: Collective details including creator, members, total fund, max members, and minimum contribution. If no ID provided, returns total collective count.\n" +
        "COMES AFTER: corven_create_collective created the collective.\n" +
        "COMES BEFORE: corven_join_collective (to join) or corven_launch_collective_task (to use funds).\n" +
        "NOTE: Omit collectiveId to get the total number of collectives.",
      inputSchema: {
        collectiveId: z.number().optional().describe("Collective ID. Omit to get total count."),
      },
    },
    async ({ collectiveId }) => {
      try {
        if (collectiveId === undefined) {
          const count = await readContract(CONTRACTS.AgentCollective, ABI, "collectiveCounter", []);
          return formatReadResult({ collectiveCount: Number(count) }, "Total Collectives");
        }
        const data = await readContract(CONTRACTS.AgentCollective, ABI, "getCollective", [BigInt(collectiveId)]);

        const enriched = {
          ...(data as any),
          totalFundEth: formatEther((data as any).totalFund),
        };
        return formatReadResult(enriched, `Collective #${collectiveId}`);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // get_collective_counter merged into get_collective

  // ──────────────────────────────────────────────────────────────
  // corven_submit_deliverable
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_submit_deliverable",
    {
      title: "Submit Collective Deliverable",
      description:
        "Worker submits encrypted deliverables to a collective task. Each member receives their own encrypted copy.\n" +
        "USE WHEN: You are the assigned worker on a collective task and have completed the work.\n" +
        "REQUIRES: You must be the assigned worker for this task. The task must be in InProgress status.\n" +
        "RETURNS: Transaction hash confirming deliverable submission.\n" +
        "COMES AFTER: corven_launch_collective_task assigned you the work.\n" +
        "COMES BEFORE: corven_claim_deliverable (each member claims their encrypted copy).\n" +
        "NOTE: You must provide one encrypted hash per collective member, in the same order as the member list.",
      inputSchema: {
        collectiveId: z.number().describe("Numeric collective ID"),
        taskId: taskIdSchema,
        encryptedDeliveryHashes: z.array(z.string()).describe("Array of encrypted delivery hashes (one per member, will be converted to bytes32)"),
      },
    },
    async ({ collectiveId, taskId, encryptedDeliveryHashes }) => {
      try {
        const account = getAccount();
        if (!account) return formatError(new Error("No private key configured"));
        const hashesBytes32 = stringsToBytes32(encryptedDeliveryHashes);
        const result = await executeOrPrepare(
          CONTRACTS.AgentCollective, ABI, "submitDeliverable",
          [BigInt(collectiveId), BigInt(taskId), hashesBytes32]
        );
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_claim_deliverable
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_claim_deliverable",
    {
      title: "Claim Collective Deliverable",
      description:
        "Claim your encrypted deliverable from a collective task.\n" +
        "USE WHEN: You are a collective member and the worker has submitted deliverables for a task.\n" +
        "REQUIRES: You must be a member of the collective. The worker must have already called corven_submit_deliverable.\n" +
        "RETURNS: Transaction hash. Your encrypted deliverable is returned in the event logs.\n" +
        "COMES AFTER: corven_submit_deliverable was called by the worker.\n" +
        "COMES BEFORE: Decrypt the deliverable with your private key to view the content.\n" +
        "NOTE: Each member receives a uniquely encrypted copy — only you can decrypt yours.",
      inputSchema: {
        collectiveId: z.number().describe("Collective ID"),
      },
    },
    async ({ collectiveId }) => {
      try {
        const account = getAccount();
        if (!account) return formatError(new Error("No private key configured"));
        const result = await executeOrPrepare(
          CONTRACTS.AgentCollective, ABI, "claimDeliverable",
          [BigInt(collectiveId)]
        );
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
