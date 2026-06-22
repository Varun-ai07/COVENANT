/**
 * covenant disputes — DisputeArbitration subcommands (Legacy V1).
 *
 *   file  — file a dispute on a task
 *   vote  — cast a vote on a dispute
 *   get   — get dispute details
 */
import { Command } from "commander";
import { parseEther, type Address } from "viem";
import chalk from "chalk";
import { loadAbi, CONTRACTS } from "../config.js";
import {
  readContract,
  writeContract,
  preWriteGuard,
  printHeader,
  printField,
  printSuccess,
  shortAddr,
  toEth,
  toDate,
  handleError,
} from "../utils.js";

const ABI = loadAbi("DisputeArbitration");

// ──────────────────────────────────────────────────────────────
// file
// ──────────────────────────────────────────────────────────────

async function fileDispute(taskId: string, bond: string): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");

  const bondWei = parseEther(bond);

  await preWriteGuard(
    `File dispute on task #${id} with ${bond} ETH bond.`,
    bond
  );

  printHeader("Filing Dispute");
  printField("Task ID", String(id));
  printField("Bond", `${bond} ETH`);

  const result = await writeContract(
    CONTRACTS.DisputeArbitration,
    ABI,
    "fileDispute",
    [BigInt(id)],
    bondWei
  );

  printSuccess(`Dispute filed — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// vote
// ──────────────────────────────────────────────────────────────

async function vote(disputeId: string, forWorker: string): Promise<void> {
  const id = parseInt(disputeId, 10);
  if (isNaN(id) || id < 0) throw new Error("Dispute ID must be a non-negative integer");

  const inFavor = forWorker.toLowerCase() === "true" || forWorker === "1";

  await preWriteGuard(
    `Cast vote on dispute #${id} (${inFavor ? "for worker" : "for client"}).`,
    "0"
  );

  printHeader("Casting Vote");
  printField("Dispute ID", String(id));
  printField("In Favor of Worker", inFavor ? "Yes" : "No");

  const result = await writeContract(
    CONTRACTS.DisputeArbitration,
    ABI,
    "castVote",
    [BigInt(id), inFavor]
  );

  printSuccess(`Vote cast — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// get
// ──────────────────────────────────────────────────────────────

async function getDispute(disputeId: string): Promise<void> {
  const id = parseInt(disputeId, 10);
  if (isNaN(id) || id < 0) throw new Error("Dispute ID must be a non-negative integer");

  const data = (await readContract(
    CONTRACTS.DisputeArbitration,
    ABI,
    "getDispute",
    [BigInt(id)]
  )) as any;

  const isTuple = Array.isArray(data);
  const taskId = isTuple ? data[0] : data.taskId;
  const initiator = isTuple ? data[1] : data.initiator;
  const votesForWorker = isTuple ? data[2] : data.votesForWorker;
  const votesForClient = isTuple ? data[3] : data.votesForClient;
  const resolved = isTuple ? data[4] : data.resolved;
  const favorWorker = isTuple ? data[5] : data.favorWorker;

  printHeader(`Dispute #${id}`);
  printField("Task ID", String(taskId));
  printField("Initiator", initiator ? shortAddr(initiator) : "—");
  printField("Votes for Worker", String(votesForWorker ?? 0));
  printField("Votes for Client", String(votesForClient ?? 0));
  printField("Resolved", resolved ? "Yes" : "No");
  if (resolved) {
    printField("Favor Worker", favorWorker ? "Yes" : "No");
  }
}

// ──────────────────────────────────────────────────────────────
// Command registration
// ──────────────────────────────────────────────────────────────

export function registerDisputesCommand(parent: Command): void {
  const disputes = parent
    .command("disputes")
    .description("Dispute arbitration operations (DisputeArbitration — Legacy V1)");

  disputes
    .command("file <taskId>")
    .description("File a dispute on a task")
    .requiredOption("--bond <eth>", "Dispute bond amount in ETH")
    .action(async (taskId, opts) => {
      try {
        await fileDispute(taskId, opts.bond);
      } catch (e) {
        handleError(e);
      }
    });

  disputes
    .command("vote <disputeId>")
    .description("Cast a vote on a dispute")
    .requiredOption(
      "--for-worker <bool>",
      "true to favor worker, false to favor client"
    )
    .action(async (disputeId, opts) => {
      try {
        await vote(disputeId, opts.forWorker);
      } catch (e) {
        handleError(e);
      }
    });

  disputes
    .command("get <disputeId>")
    .description("Get dispute details")
    .action(async (disputeId) => {
      try {
        await getDispute(disputeId);
      } catch (e) {
        handleError(e);
      }
    });
}
