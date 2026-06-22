/**
 * covenant arbitration — CovenantArbitration subcommands.
 *
 *   create      — create a dispute on a task
 *   stake       — stake on a dispute
 *   rule        — submit an arbiter ruling
 *   settle      — settle a dispute
 *   get         — get dispute details
 *   count       — get dispute count
 */
import { Command } from "commander";
import { type Address, isAddress } from "viem";
import chalk from "chalk";
import { loadAbi, CONTRACTS } from "../config.js";
import {
  readContract,
  writeContract,
  printHeader,
  printField,
  printSuccess,
  shortAddr,
  toEth,
  toDate,
  DISPUTE_STATUS,
  handleError,
} from "../utils.js";

const ABI = loadAbi("CovenantArbitration");

// ──────────────────────────────────────────────────────────────
// create
// ──────────────────────────────────────────────────────────────

async function createDispute(taskId: string, evidenceHash: string): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");

  printHeader("Creating Dispute");
  printField("Task ID", String(id));
  printField("Evidence Hash", evidenceHash);

  const result = await writeContract(
    CONTRACTS.CovenantArbitration,
    ABI,
    "createDispute",
    [BigInt(id), evidenceHash as `0x${string}`]
  );

  printSuccess(`Dispute created — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// stake
// ──────────────────────────────────────────────────────────────

async function stakeDispute(disputeId: string): Promise<void> {
  const id = parseInt(disputeId, 10);
  if (isNaN(id) || id < 0) throw new Error("Dispute ID must be a non-negative integer");

  printHeader("Staking on Dispute");
  printField("Dispute ID", String(id));

  const result = await writeContract(
    CONTRACTS.CovenantArbitration,
    ABI,
    "stakeForDispute",
    [BigInt(id)]
  );

  printSuccess(`Staked on dispute — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// rule
// ──────────────────────────────────────────────────────────────

async function submitRuling(
  disputeId: string,
  ruling: string,
  splitBps: string,
  arbiterSig: string
): Promise<void> {
  const id = parseInt(disputeId, 10);
  if (isNaN(id) || id < 0) throw new Error("Dispute ID must be a non-negative integer");

  const rulingNum = parseInt(ruling, 10);
  if (isNaN(rulingNum) || rulingNum < 0 || rulingNum > 2) {
    throw new Error("Ruling must be 0 (reject), 1 (client), or 2 (worker)");
  }

  const split = parseInt(splitBps, 10);
  if (isNaN(split) || split < 0 || split > 10000) {
    throw new Error("Split must be 0-10000 basis points");
  }

  printHeader("Submitting Ruling");
  printField("Dispute ID", String(id));
  printField("Ruling", ["Reject", "Client", "Worker"][rulingNum] ?? String(rulingNum));
  printField("Split", `${split / 100}%`);

  const result = await writeContract(
    CONTRACTS.CovenantArbitration,
    ABI,
    "submitRuling",
    [BigInt(id), rulingNum, split, arbiterSig as `0x${string}`]
  );

  printSuccess(`Ruling submitted — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// settle
// ──────────────────────────────────────────────────────────────

async function settleDispute(disputeId: string): Promise<void> {
  const id = parseInt(disputeId, 10);
  if (isNaN(id) || id < 0) throw new Error("Dispute ID must be a non-negative integer");

  printHeader("Settling Dispute");
  printField("Dispute ID", String(id));

  const result = await writeContract(
    CONTRACTS.CovenantArbitration,
    ABI,
    "settleDispute",
    [BigInt(id)]
  );

  printSuccess(`Dispute settled — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// get
// ──────────────────────────────────────────────────────────────

async function getDispute(disputeId: string): Promise<void> {
  const id = parseInt(disputeId, 10);
  if (isNaN(id) || id < 0) throw new Error("Dispute ID must be a non-negative integer");

  const data = (await readContract(
    CONTRACTS.CovenantArbitration,
    ABI,
    "getDispute",
    [BigInt(id)]
  )) as any;

  const isTuple = Array.isArray(data);

  printHeader(`Dispute #${id}`);

  if (isTuple) {
    printField("Task ID", String(data[0]));
    printField("Initiator", data[1] ? shortAddr(data[1]) : "—");
    printField("Evidence Hash", data[2] ?? "—");
    printField("Staked", String(data[3] ?? 0));
    printField("Ruling", String(data[4] ?? "—"));
    printField("Settled", data[5] ? "Yes" : "No");
  } else {
    printField("Task ID", String(data.taskId));
    printField("Initiator", data.initiator ? shortAddr(data.initiator) : "—");
    printField("Evidence Hash", data.evidenceHash ?? "—");
    printField("Staked", String(data.staked ?? 0));
    printField("Ruling", String(data.ruling ?? "—"));
    printField("Settled", data.settled ? "Yes" : "No");
  }
}

// ──────────────────────────────────────────────────────────────
// count
// ──────────────────────────────────────────────────────────────

async function disputeCount(): Promise<void> {
  const count = (await readContract(
    CONTRACTS.CovenantArbitration,
    ABI,
    "disputeCount",
    []
  )) as bigint;

  printHeader("Dispute Count");
  printField("Total", String(count));
}

// ──────────────────────────────────────────────────────────────
// Command registration
// ──────────────────────────────────────────────────────────────

export function registerArbitrationCommand(parent: Command): void {
  const arb = parent
    .command("arbitration")
    .description("Dispute arbitration operations (CovenantArbitration)");

  arb
    .command("create <taskId>")
    .description("Create a dispute on a task")
    .requiredOption("--evidence <hash>", "Evidence hash (bytes32)")
    .action(async (taskId, opts) => {
      try {
        await createDispute(taskId, opts.evidence);
      } catch (e) {
        handleError(e);
      }
    });

  arb
    .command("stake <disputeId>")
    .description("Stake on a dispute")
    .action(async (disputeId) => {
      try {
        await stakeDispute(disputeId);
      } catch (e) {
        handleError(e);
      }
    });

  arb
    .command("rule <disputeId>")
    .description("Submit an arbiter ruling (arbiter only)")
    .requiredOption("--ruling <0|1|2>", "0=reject, 1=client wins, 2=worker wins")
    .requiredOption("--split <bps>", "Split in basis points (0-10000)")
    .requiredOption("--sig <hash>", "Arbiter signature (bytes)")
    .action(async (disputeId, opts) => {
      try {
        await submitRuling(disputeId, opts.ruling, opts.split, opts.sig);
      } catch (e) {
        handleError(e);
      }
    });

  arb
    .command("settle <disputeId>")
    .description("Settle a ruled dispute")
    .action(async (disputeId) => {
      try {
        await settleDispute(disputeId);
      } catch (e) {
        handleError(e);
      }
    });

  arb
    .command("get <disputeId>")
    .description("Get dispute details")
    .action(async (disputeId) => {
      try {
        await getDispute(disputeId);
      } catch (e) {
        handleError(e);
      }
    });

  arb
    .command("count")
    .description("Get total dispute count")
    .action(async () => {
      try {
        await disputeCount();
      } catch (e) {
        handleError(e);
      }
    });
}
