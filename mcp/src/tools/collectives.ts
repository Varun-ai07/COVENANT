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
        "Create a new collective of agents that pool resources. " +
        "Collectives can launch tasks and share proceeds. " +
        "You must send at least minContribution ETH as your initial stake.",
      inputSchema: {
        minContribution: z.string().describe("Minimum contribution in ETH to join"),
        maxMembers: z.number().describe("Maximum number of members (2-100)"),
        initialContribution: z.string().optional().describe("Initial ETH contribution (defaults to minContribution)"),
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
        return formatError(e);
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
        "Join an existing collective by contributing ETH. " +
        "Contribution must meet the collective's minimum.",
      inputSchema: {
        collectiveId: z.number().describe("Collective ID to join"),
        contribution: z.string().describe("Contribution amount in ETH"),
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
        return formatError(e);
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
        "Launch a task from a collective's pooled funds. " +
        "Only collective members can call this.",
      inputSchema: {
        collectiveId: z.number().describe("Collective ID"),
        workerAddress: z.string().describe("Worker address to assign"),
        payment: z.string().describe("Payment amount in ETH"),
        deadline: z.number().describe("Deadline timestamp (seconds)"),
        descriptionHash: z.string().describe("IPFS CID for task description"),
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
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // get_collective
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_collective",
    {
      title: "Get Collective Details",
      description: "Retrieve details about a collective including members and treasury.",
      inputSchema: {
        collectiveId: z.number().describe("Collective ID"),
      },
    },
    async ({ collectiveId }) => {
      try {
        const data = await readContract(
          CONTRACTS.AgentCollective,
          ABI,
          "getCollective",
          [BigInt(collectiveId)]
        );

        const enriched = {
          ...(data as any),
          minContributionEth: formatEther((data as any).minContribution),
          treasuryEth: formatEther((data as any).treasury),
        };
        return formatReadResult(enriched, `Collective #${collectiveId}`);
      } catch (e) {
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // get_collective_counter
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_collective_counter",
    {
      title: "Get Collective Counter",
      description: "Get the total number of collectives created.",
      inputSchema: {},
    },
    async () => {
      try {
        const count = await readContract(
          CONTRACTS.AgentCollective,
          ABI,
          "collectiveCounter",
          []
        );
        return formatReadResult({ count: Number(count) }, "Collective Counter");
      } catch (e) {
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_submit_deliverable
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_submit_deliverable",
    {
      title: "Submit Collective Deliverable",
      description:
        "Worker submits encrypted deliverables to a collective task. " +
        "Each member receives their own encrypted copy.",
      inputSchema: {
        collectiveId: z.number().describe("Collective ID"),
        taskId: z.number().describe("Task ID"),
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
      } catch (e) { return formatError(e); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_claim_deliverable
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_claim_deliverable",
    {
      title: "Claim Collective Deliverable",
      description: "Claim your encrypted deliverable from a collective task.",
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
      } catch (e) { return formatError(e); }
    }
  );
}
