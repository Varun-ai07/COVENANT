/**
 * covenant settlement — CovenantSettlement subcommands.
 *
 *   create   — create a payment stream
 *   withdraw — withdraw from a stream
 *   cancel   — cancel a stream
 *   get      — get stream details
 *   count    — get stream count
 */
import { Command } from "commander";
import { parseEther, formatEther, type Address, isAddress } from "viem";
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
  STREAM_STATUS,
  handleError,
} from "../utils.js";

const ABI = loadAbi("CovenantSettlement");

// ──────────────────────────────────────────────────────────────
// create
// ──────────────────────────────────────────────────────────────

async function createStream(
  payee: string,
  ratePerSecond: string,
  duration: string
): Promise<void> {
  if (!isAddress(payee)) throw new Error(`Invalid payee address: ${payee}`);

  const rateWei = parseEther(ratePerSecond);
  const durationNum = parseInt(duration, 10);
  if (isNaN(durationNum) || durationNum <= 0) {
    throw new Error("Duration must be a positive integer (seconds)");
  }

  // Calculate total cost: rate * duration
  const totalEth = formatEther(rateWei * BigInt(durationNum));

  await preWriteGuard(
    `Create payment stream to ${shortAddr(payee)}: ${ratePerSecond} ETH/sec for ${durationNum} seconds (≈${totalEth} ETH total).`,
    totalEth
  );

  printHeader("Creating Payment Stream");
  printField("Payee", shortAddr(payee));
  printField("Rate", `${ratePerSecond} ETH/sec`);
  printField("Duration", `${durationNum} seconds`);

  const result = await writeContract(
    CONTRACTS.CovenantSettlement,
    ABI,
    "createStream",
    [payee as Address, rateWei, BigInt(durationNum)]
  );

  printSuccess(`Stream created — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// withdraw
// ──────────────────────────────────────────────────────────────

async function withdrawStream(streamId: string): Promise<void> {
  const id = parseInt(streamId, 10);
  if (isNaN(id) || id < 0) throw new Error("Stream ID must be a non-negative integer");

  await preWriteGuard(
    `Withdraw from stream #${id}.`,
    "0"
  );

  printHeader("Withdrawing from Stream");
  printField("Stream ID", String(id));

  const result = await writeContract(
    CONTRACTS.CovenantSettlement,
    ABI,
    "withdrawStream",
    [BigInt(id)]
  );

  printSuccess(`Withdrawn from stream — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// cancel
// ──────────────────────────────────────────────────────────────

async function cancelStream(streamId: string): Promise<void> {
  const id = parseInt(streamId, 10);
  if (isNaN(id) || id < 0) throw new Error("Stream ID must be a non-negative integer");

  await preWriteGuard(
    `Cancel stream #${id}.`,
    "0"
  );

  printHeader("Cancelling Stream");
  printField("Stream ID", String(id));

  const result = await writeContract(
    CONTRACTS.CovenantSettlement,
    ABI,
    "cancelStream",
    [BigInt(id)]
  );

  printSuccess(`Stream cancelled — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// get
// ──────────────────────────────────────────────────────────────

async function getStream(streamId: string): Promise<void> {
  const id = parseInt(streamId, 10);
  if (isNaN(id) || id < 0) throw new Error("Stream ID must be a non-negative integer");

  const data = (await readContract(
    CONTRACTS.CovenantSettlement,
    ABI,
    "getStream",
    [BigInt(id)]
  )) as any;

  const isTuple = Array.isArray(data);

  printHeader(`Stream #${id}`);

  if (isTuple) {
    printField("Payer", data[0] ? shortAddr(data[0]) : "—");
    printField("Payee", data[1] ? shortAddr(data[1]) : "—");
    printField("Rate/sec", toEth(data[2]));
    printField("Start Time", toDate(data[3]));
    printField("Duration", `${Number(data[4])} seconds`);
    printField("Status", STREAM_STATUS[Number(data[5])] ?? `Unknown(${data[5]})`);
    printField("Total Withdrawn", toEth(data[6]));
  } else {
    printField("Payer", data.payer ? shortAddr(data.payer) : "—");
    printField("Payee", data.payee ? shortAddr(data.payee) : "—");
    printField("Rate/sec", toEth(data.ratePerSecond ?? data.rate));
    printField("Start Time", toDate(data.startTime));
    printField("Duration", `${Number(data.duration)} seconds`);
    printField("Status", STREAM_STATUS[Number(data.status)] ?? `Unknown(${data.status})`);
    printField("Total Withdrawn", toEth(data.totalWithdrawn));
  }
}

// ──────────────────────────────────────────────────────────────
// count
// ──────────────────────────────────────────────────────────────

async function streamCount(): Promise<void> {
  const count = (await readContract(
    CONTRACTS.CovenantSettlement,
    ABI,
    "streamCount",
    []
  )) as bigint;

  printHeader("Stream Count");
  printField("Total", String(count));
}

// ──────────────────────────────────────────────────────────────
// Command registration
// ──────────────────────────────────────────────────────────────

export function registerSettlementCommand(parent: Command): void {
  const settlement = parent
    .command("settlement")
    .description("Payment stream operations (CovenantSettlement)");

  settlement
    .command("create")
    .description("Create a payment stream")
    .requiredOption("--payee <addr>", "Payee Ethereum address")
    .requiredOption("--rate <eth>", "Payment rate in ETH per second")
    .requiredOption("--duration <seconds>", "Stream duration in seconds")
    .action(async (opts) => {
      try {
        await createStream(opts.payee, opts.rate, opts.duration);
      } catch (e) {
        handleError(e);
      }
    });

  settlement
    .command("withdraw <streamId>")
    .description("Withdraw available funds from a stream")
    .action(async (streamId) => {
      try {
        await withdrawStream(streamId);
      } catch (e) {
        handleError(e);
      }
    });

  settlement
    .command("cancel <streamId>")
    .description("Cancel a payment stream")
    .action(async (streamId) => {
      try {
        await cancelStream(streamId);
      } catch (e) {
        handleError(e);
      }
    });

  settlement
    .command("get <streamId>")
    .description("Get stream details")
    .action(async (streamId) => {
      try {
        await getStream(streamId);
      } catch (e) {
        handleError(e);
      }
    });

  settlement
    .command("count")
    .description("Get total stream count")
    .action(async () => {
      try {
        await streamCount();
      } catch (e) {
        handleError(e);
      }
    });
}
