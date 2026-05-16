/**
 * DisputeArbitration MCP Tools
 *
 * file_dispute    — File a dispute on a task
 * cast_vote       — Cast a vote on a dispute
 * get_dispute     — Get dispute details
 * get_dispute_counter — Get total disputes
 */
import { z } from "zod";
import { parseEther, formatEther, type Address, isAddress } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult, formatError } from "../handlers/transactions.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("DisputeArbitration");

// Check if DisputeArbitration is deployed (not zero address)
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
function isDisputeDeployed(): boolean {
  return CONTRACTS.DisputeArbitration.toLowerCase() !== ZERO_ADDRESS;
}

// Input validation schemas
const fileDisputeSchema = z.object({
  taskId: z.number().int().positive(),
  bond: z.string().regex(/^\d+\.?\d*$/, "Invalid ETH amount")
    .refine(val => parseFloat(val) >= 0.001, { message: "Bond must be at least 0.001 ETH" }),
});

const castVoteSchema = z.object({
  disputeId: z.number().int().positive(),
  inFavorOfWorker: z.boolean(),
});

export function registerDisputeTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // file_dispute
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_file_dispute",
    {
      title: "File Dispute",
      description:
        "File a formal dispute on a task. Requires a bond in ETH. " +
        "The dispute will be resolved by juror voting.",
      inputSchema: {
        taskId: z.number().describe("Task ID to dispute"),
        bond: z.string().describe("Dispute bond amount in ETH"),
      },
    },
    async ({ taskId, bond }) => {
      try {
        if (!isDisputeDeployed()) {
          return formatError(new Error("DisputeArbitration contract is not deployed on this network. Dispute functionality is unavailable."));
        }
        const validation = fileDisputeSchema.safeParse({ taskId, bond });
        if (!validation.success) {
          return formatError(new Error(`Invalid input: ${validation.error.issues.map(e => e.message).join(", ")}`));
        }

        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured"));
        }

        const bondWei = parseEther(bond);
        const result = await executeOrPrepare(
          CONTRACTS.DisputeArbitration,
          ABI,
          "disputeTask",
          [BigInt(taskId)],
          bondWei
        );
        return formatTxResult(result);
      } catch (e) {
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // cast_vote
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_cast_vote",
    {
      title: "Cast Vote",
      description:
        "Cast your vote on a dispute. True = favor worker, False = favor client. " +
        "Only selected jurors can vote.",
      inputSchema: {
        disputeId: z.number().describe("Dispute ID"),
        inFavorOfWorker: z.boolean().describe("True to vote for worker, false for client"),
      },
    },
    async ({ disputeId, inFavorOfWorker }) => {
      try {
        if (!isDisputeDeployed()) {
          return formatError(new Error("DisputeArbitration contract is not deployed on this network. Dispute functionality is unavailable."));
        }
        const validation = castVoteSchema.safeParse({ disputeId, inFavorOfWorker });
        if (!validation.success) {
          return formatError(new Error(`Invalid input: ${validation.error.issues.map(e => e.message).join(", ")}`));
        }

        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured"));
        }

        const result = await executeOrPrepare(
          CONTRACTS.DisputeArbitration,
          ABI,
          "castVote",
          [BigInt(disputeId), inFavorOfWorker],
          undefined,
          "DisputeArbitration"
        );
        return formatTxResult(result);
      } catch (e) {
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // get_dispute
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_dispute",
    {
      title: "Get Dispute Details",
      description: "Retrieve full details of a dispute including votes and resolution status.",
      inputSchema: {
        disputeId: z.number().describe("Dispute ID"),
      },
    },
    async ({ disputeId }) => {
      try {
        if (!isDisputeDeployed()) {
          return formatError(new Error("DisputeArbitration contract is not deployed on this network. Dispute functionality is unavailable."));
        }
        const data = await readContract(
          CONTRACTS.DisputeArbitration,
          ABI,
          "getDispute",
          [BigInt(disputeId)]
        );

        const enriched = {
          taskId: (data as any).taskId,
          client: (data as any).client,
          worker: (data as any).worker,
          disputeBondEth: formatEther((data as any).disputeBond),
          jurors: (data as any).jurors,
          resolved: (data as any).resolved,
          workerWins: (data as any).workerWins,
          createdAt: (data as any).createdAt,
          votingEndsAt: (data as any).votingEndsAt,
        };
        return formatReadResult(enriched, `Dispute #${disputeId}`);
      } catch (e) {
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // get_dispute_counter
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_dispute_counter",
    {
      title: "Get Dispute Counter",
      description: "Get the total number of disputes filed.",
      inputSchema: {},
    },
    async () => {
      try {
        if (!isDisputeDeployed()) {
          return formatError(new Error("DisputeArbitration contract is not deployed on this network. Dispute functionality is unavailable."));
        }
        const count = await readContract(
          CONTRACTS.DisputeArbitration,
          ABI,
          "disputeCounter",
          []
        );
        return formatReadResult({ count: Number(count) }, "Dispute Counter");
      } catch (e) {
        return formatError(e);
      }
    }
  );
}
