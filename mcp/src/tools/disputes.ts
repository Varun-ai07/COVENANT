/**
 * DisputeArbitration MCP Tools
 *
 * file_dispute    — File a dispute on a task
 * cast_vote       — Cast a vote on a dispute
 * get_dispute     — Get dispute details
 * claim_reward    — Claim juror reward (pull-payment)
 * get_dispute_counter — Get total disputes
 */
import { z } from "zod";
import { parseEther, formatEther } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult, formatError } from "../handlers/transactions.js";
import { parseContractError, formatStructuredError } from "../lib/formatResponse.js";
import { taskId as taskIdSchema, ethAmount } from "../lib/schemaHelpers.js";
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
        "File a formal dispute on a task. Requires a bond in ETH. The dispute will be resolved by juror voting.\n" +
        "USE WHEN: You disagree with a task outcome — either as client (work was substandard) or worker (verification was unfair).\n" +
        "REQUIRES: Task must be in Submitted or Completed status. DisputeArbitration contract must be deployed.\n" +
        "RETURNS: Transaction hash of the dispute filing. Task status transitions to Disputed and payment release is paused.\n" +
        "COMES AFTER: corven_verify_task (if disputing a verification) or corven_submit_work (if client disputes before verifying).\n" +
        "COMES BEFORE: corven_cast_vote (jurors vote on the dispute).\n" +
        "NOTE: Bond is refunded if you win the dispute. Minimum bond is 0.001 ETH.",
      inputSchema: {
        taskId: taskIdSchema,
        bond: ethAmount,
        confirm: z.boolean().optional().default(false).describe('Set to true to execute. Without this, shows what will happen.'),
      },
    },
    async ({ taskId, bond, confirm }) => {
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
        if (!confirm) {
          return formatReadResult({
            confirmationRequired: true,
            action: "File dispute for task #" + taskId,
            cost: formatEther(bondWei) + " ETH bond",
            reason: "Bond is locked during dispute. Refunded if you win.",
            toProceed: "Call corven_file_dispute again with confirm: true",
          }, "CONFIRMATION REQUIRED");
        }
        const result = await executeOrPrepare(
          CONTRACTS.DisputeArbitration,
          ABI,
          "disputeTask",
          [BigInt(taskId)],
          bondWei
        );
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
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
        "Cast your vote on a dispute. True = favor worker, False = favor client. Only selected jurors can vote.\n" +
        "USE WHEN: You are a selected juror and a dispute requires your vote to reach resolution.\n" +
        "REQUIRES: You must be selected as a juror for this dispute. The dispute must be in the voting period.\n" +
        "RETURNS: Transaction hash of your vote. Vote is recorded on-chain but not revealed until voting ends.\n" +
        "COMES AFTER: corven_file_dispute was called and jurors were assigned.\n" +
        "COMES BEFORE: corven_get_dispute to check resolution after voting period ends.\n" +
        "NOTE: Voting is commit-reveal — your vote choice is hidden until the voting period closes.",
      inputSchema: {
        disputeId: z.number().describe("Numeric dispute ID returned by corven_file_dispute"),
        inFavorOfWorker: z.boolean().describe("True to vote for worker, false for client"),
        confirm: z.boolean().optional().default(false).describe('Set to true to execute. Without this, shows what will happen.'),
      },
    },
    async ({ disputeId, inFavorOfWorker, confirm }) => {
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

        if (!confirm) {
          return formatReadResult({
            confirmationRequired: true,
            action: "Cast vote on dispute #" + disputeId,
            cost: "Gas only",
            reason: inFavorOfWorker ? "Voting in favor of worker" : "Voting in favor of client",
            toProceed: "Call corven_cast_vote again with confirm: true",
          }, "CONFIRMATION REQUIRED");
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
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // get_dispute
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_dispute",
    {
      title: "Get Dispute",
      description:
        "Get dispute details by ID, or total dispute count if no ID provided.\n" +
        "USE WHEN: You need to check the status, votes, or resolution of a dispute.\n" +
        "REQUIRES: DisputeArbitration contract must be deployed.\n" +
        "RETURNS: Dispute details including client, worker, jurors, bond, resolution status, and voting deadline. If no ID provided, returns total dispute count.\n" +
        "COMES AFTER: corven_file_dispute created the dispute.\n" +
        "COMES BEFORE: corven_cast_vote (if voting is still open) or corven_pay_claim (if dispute affects insurance).\n" +
        "NOTE: Omit disputeId to get the total number of disputes.",
      inputSchema: {
        disputeId: z.number().optional().describe("Dispute ID. Omit to get total dispute count."),
      },
    },
    async ({ disputeId }) => {
      try {
        if (!isDisputeDeployed()) {
          return formatError(new Error("DisputeArbitration contract is not deployed on this network."));
        }
        if (disputeId === undefined) {
          const count = await readContract(CONTRACTS.DisputeArbitration, ABI, "disputeCounter", []);
          return formatReadResult({ disputeCount: Number(count) }, "Total Disputes");
        }
        const data = await readContract(CONTRACTS.DisputeArbitration, ABI, "getDispute", [BigInt(disputeId)]);
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
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // claim_reward
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_claim_reward",
    {
      title: "Claim Juror Reward",
      description:
        "Claim your accumulated juror rewards from resolved disputes.\n" +
        "USE WHEN: You are a juror who voted on a dispute and want to collect your reward.\n" +
        "HOW IT WORKS: After a dispute is resolved, juror rewards are credited to your address. " +
        "Call this tool to withdraw them to your wallet.\n" +
        "REQUIRES: You must have unclaimed rewards from previous dispute resolutions.\n" +
        "RETURNS: Amount of ETH claimed.",
      inputSchema: {},
    },
    async () => {
      try {
        if (!isDisputeDeployed()) {
          return formatError(new Error("DisputeArbitration contract is not deployed on this network."));
        }
        const result = await executeOrPrepare(
          CONTRACTS.DisputeArbitration,
          ABI,
          "claimReward",
          [],
          0n
        );
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
