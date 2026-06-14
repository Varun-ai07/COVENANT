/**
 * DisputeArbitration MCP Tools
 *
 * file_dispute    — File a dispute on a task
 * cast_vote       — Submit ruling on a dispute (arbiter)
 * get_dispute     — Get dispute details
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

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
function isDisputeDeployed(): boolean {
  return CONTRACTS.DisputeArbitration.toLowerCase() !== ZERO_ADDRESS;
}

const RULING_LABELS: Record<number, string> = {
  0: "None",
  1: "ClientWins",
  2: "WorkerWins",
  3: "Split",
};

const fileDisputeSchema = z.object({
  taskId: z.number().int().positive(),
  evidenceHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid bytes32 hex"),
});

const stakeForDisputeSchema = z.object({
  disputeId: z.number().int().positive(),
  amount: z.string().regex(/^\d+\.?\d*$/, "Invalid ETH amount")
    .refine(val => parseFloat(val) >= 0.001, { message: "Stake must be at least 0.001 ETH" }),
});

const castVoteSchema = z.object({
  disputeId: z.number().int().positive(),
  ruling: z.number().int().min(1).max(3).describe("Ruling: 1=ClientWins, 2=WorkerWins, 3=Split"),
  splitBps: z.number().int().min(0).max(10000).describe("Split basis points (0-10000, only for ruling=3)"),
  arbiterSignature: z.string().regex(/^0x[0-9a-fA-F]*$/, "Invalid signature hex"),
});

const settleDisputeSchema = z.object({
  disputeId: z.number().int().positive(),
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
        "File a formal dispute on a task. Requires an evidence hash.\n" +
        "USE WHEN: You disagree with a task outcome — either as client (work was substandard) or worker (verification was unfair).\n" +
        "REQUIRES: Task must be in Submitted or Completed status. DisputeArbitration contract must be deployed.\n" +
        "RETURNS: Transaction hash of the dispute filing. Task status transitions to Disputed and payment release is paused.\n" +
        "COMES AFTER: corven_verify_task (if disputing a verification) or corven_submit_work (if client disputes before verifying).\n" +
        "COMES BEFORE: corven_cast_vote (arbiter submits ruling on the dispute).\n" +
        "NOTE: Both disputant and worker must stake before ruling can be submitted.",
      inputSchema: {
        taskId: taskIdSchema,
        evidenceHash: z.string().describe("bytes32 hash of dispute evidence"),
      },
    },
    async ({ taskId, evidenceHash }) => {
      try {
        if (!isDisputeDeployed()) {
          return formatError(new Error("DisputeArbitration contract is not deployed on this network. Dispute functionality is unavailable."));
        }
        const validation = fileDisputeSchema.safeParse({ taskId, evidenceHash });
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
          "createDispute",
          [BigInt(taskId), evidenceHash as `0x${string}`]
        );
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // stake_for_dispute (internal helper, exposed as part of cast_vote flow)
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_stake_dispute",
    {
      title: "Stake for Dispute",
      description:
        "Stake ETH for a dispute. Both disputant and worker must stake before a ruling can be submitted.\n" +
        "USE WHEN: You are a party to a dispute and need to put up your stake.\n" +
        "REQUIRES: DisputeArbitration contract must be deployed. Stake must be at least 0.001 ETH.\n" +
        "RETURNS: Transaction hash of the stake. Staked ETH is returned based on ruling outcome.\n" +
        "COMES AFTER: corven_file_dispute created the dispute.\n" +
        "COMES BEFORE: corven_cast_vote (once both parties have staked).\n" +
        "NOTE: Minimum stake is 0.001 ETH.",
      inputSchema: {
        disputeId: z.number().describe("Dispute ID returned by corven_file_dispute"),
        amount: ethAmount,
      },
    },
    async ({ disputeId, amount }) => {
      try {
        if (!isDisputeDeployed()) {
          return formatError(new Error("DisputeArbitration contract is not deployed on this network."));
        }
        const validation = stakeForDisputeSchema.safeParse({ disputeId, amount });
        if (!validation.success) {
          return formatError(new Error(`Invalid input: ${validation.error.issues.map(e => e.message).join(", ")}`));
        }

        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured"));
        }

        const stakeWei = parseEther(amount);
        const result = await executeOrPrepare(
          CONTRACTS.DisputeArbitration,
          ABI,
          "stakeForDispute",
          [BigInt(disputeId)],
          stakeWei
        );
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // cast_vote (now submitRuling)
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_cast_vote",
    {
      title: "Submit Ruling",
      description:
        "Submit a ruling on a dispute as an authorized arbiter. Ruling: 1=ClientWins, 2=WorkerWins, 3=Split.\n" +
        "USE WHEN: You are the designated arbiter and both parties have staked. Submit your ruling with a signature.\n" +
        "REQUIRES: You must be the authorized arbiter. Both disputant and worker must have staked. Dispute must be in voting period.\n" +
        "RETURNS: Transaction hash of the ruling. Settlement happens automatically after ruling is submitted.\n" +
        "COMES AFTER: corven_file_dispute and both parties staked via corven_stake_dispute.\n" +
        "COMES BEFORE: corven_settle_dispute to finalize payout, or corven_get_dispute to check resolution.\n" +
        "NOTE: For ruling=3 (Split), specify splitBps (0-10000) to determine client/worker split ratio.",
      inputSchema: {
        disputeId: z.number().describe("Numeric dispute ID returned by corven_file_dispute"),
        ruling: z.number().describe("1=ClientWins, 2=WorkerWins, 3=Split"),
        splitBps: z.number().optional().describe("Split basis points (0-10000). Required when ruling=3."),
        arbiterSignature: z.string().describe("Arbiter's signature (bytes)"),
      },
    },
    async ({ disputeId, ruling, splitBps = 0, arbiterSignature }) => {
      try {
        if (!isDisputeDeployed()) {
          return formatError(new Error("DisputeArbitration contract is not deployed on this network. Dispute functionality is unavailable."));
        }
        if (ruling === 3 && (splitBps < 1 || splitBps > 9999)) {
          return formatError(new Error("splitBps must be between 1 and 9999 for Split ruling"));
        }
        const validation = castVoteSchema.safeParse({ disputeId, ruling, splitBps, arbiterSignature });
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
          "submitRuling",
          [BigInt(disputeId), ruling, splitBps, arbiterSignature as `0x${string}`],
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
  // settle_dispute
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_settle_dispute",
    {
      title: "Settle Dispute",
      description:
        "Settle a dispute after a ruling has been submitted. Finalizes payout to winner(s).\n" +
        "USE WHEN: A ruling has been submitted and you want to trigger the final settlement.\n" +
        "REQUIRES: Dispute must have a ruling submitted. Contract must be deployed.\n" +
        "RETURNS: Transaction hash of settlement. Funds are distributed according to the ruling.\n" +
        "COMES AFTER: corven_cast_vote submitted the ruling.\n" +
        "COMES BEFORE: corven_get_dispute to confirm final resolution.\n" +
        "NOTE: Settlement distributes stakes according to the ruling and splitBps.",
      inputSchema: {
        disputeId: z.number().describe("Dispute ID to settle"),
      },
    },
    async ({ disputeId }) => {
      try {
        if (!isDisputeDeployed()) {
          return formatError(new Error("DisputeArbitration contract is not deployed on this network."));
        }
        const validation = settleDisputeSchema.safeParse({ disputeId });
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
          "settleDispute",
          [BigInt(disputeId)],
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
        "USE WHEN: You need to check the status, stakes, ruling, or resolution of a dispute.\n" +
        "REQUIRES: DisputeArbitration contract must be deployed.\n" +
        "RETURNS: Dispute details including taskId, disputant, ruling, splitBps, stakes, evidenceHash, and settled status. If no ID provided, returns total dispute count.\n" +
        "COMES AFTER: corven_file_dispute created the dispute.\n" +
        "COMES BEFORE: corven_cast_vote (if ruling is pending) or corven_settle_dispute (if ruling is submitted).\n" +
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
          const count = await readContract(CONTRACTS.DisputeArbitration, ABI, "disputeCount", []);
          return formatReadResult({ disputeCount: Number(count) }, "Total Disputes");
        }
        const data = await readContract(CONTRACTS.DisputeArbitration, ABI, "getDispute", [BigInt(disputeId)]);
        const d = data as any;
        const enriched = {
          taskId: d.taskId,
          disputant: d.disputant,
          ruling: RULING_LABELS[d.ruling] ?? `Unknown(${d.ruling})`,
          splitBps: d.splitBps,
          createdAt: d.createdAt,
          evidenceHash: d.evidenceHash,
          clientStakeEth: formatEther(d.clientStake),
          workerStakeEth: formatEther(d.workerStake),
          settled: d.settled,
        };
        return formatReadResult(enriched, `Dispute #${disputeId}`);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
