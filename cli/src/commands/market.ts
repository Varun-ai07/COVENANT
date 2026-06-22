/**
 * covenant market — OpenTaskMarket subcommands.
 *
 *   post    — post an open task for competitive bidding
 *   bid     — submit a bid on an open task
 *   select  — select a winning bidder
 *   get     — view open task details
 *   cancel  — cancel an open task
 */
import { Command } from "commander";
import { parseEther, type Address, isAddress } from "viem";
import chalk from "chalk";
import * as readline from "node:readline";
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
  MARKET_STATUS,
  handleError,
} from "../utils.js";

const ABI = loadAbi("OpenTaskMarket");

function promptUser(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ──────────────────────────────────────────────────────────────
// post
// ──────────────────────────────────────────────────────────────

async function post(
  maxPayment: string,
  deadline: string,
  desc: string
): Promise<void> {
  if (!maxPayment) {
    maxPayment = await promptUser("  Enter max payment amount (ETH): ");
  }
  if (!deadline) {
    const input = await promptUser("  Enter deadline (YYYY-MM-DD or Unix timestamp): ");
    if (input.includes("-")) {
      const ts = Math.floor(new Date(input).getTime() / 1000);
      if (isNaN(ts) || ts <= 0) throw new Error(`Invalid date: ${input}`);
      deadline = String(ts);
    } else {
      deadline = input;
    }
  }
  if (!desc) {
    desc = await promptUser("  Enter IPFS CID for task description: ");
  }

  const paymentWei = parseEther(maxPayment);
  const deadlineNum = parseInt(deadline, 10);
  if (isNaN(deadlineNum) || deadlineNum <= 0) {
    throw new Error("Deadline must be a positive Unix timestamp");
  }

  await preWriteGuard(
    `Post an open task with max payment ${maxPayment} ETH.`,
    maxPayment
  );

  printHeader("Posting Open Task");
  printField("Max Payment", `${maxPayment} ETH`);
  printField("Deadline", toDate(deadlineNum));
  printField("Description CID", desc);

  const result = await writeContract(
    CONTRACTS.OpenTaskMarket,
    ABI,
    "postTask",
    [paymentWei, BigInt(deadlineNum), desc],
    paymentWei
  );

  printSuccess(`Open task posted — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// bid
// ──────────────────────────────────────────────────────────────

async function bid(
  taskId: string,
  price: string,
  timeEstimate: string,
  proposal: string
): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");

  const priceWei = parseEther(price);
  const time = parseInt(timeEstimate, 10);
  if (isNaN(time) || time <= 0) {
    throw new Error("Time estimate must be a positive integer (seconds)");
  }

  await preWriteGuard(
    `Submit bid on task #${id} for ${price} ETH.`,
    "0"
  );

  printHeader("Submitting Bid");
  printField("Task ID", String(id));
  printField("Price", `${price} ETH`);
  printField("Time Estimate", `${time} seconds`);
  printField("Proposal CID", proposal);

  const result = await writeContract(
    CONTRACTS.OpenTaskMarket,
    ABI,
    "submitBid",
    [BigInt(id), priceWei, BigInt(time), proposal]
  );

  printSuccess(`Bid submitted — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// select
// ──────────────────────────────────────────────────────────────

async function select(taskId: string, worker: string): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");
  if (!isAddress(worker)) throw new Error(`Invalid worker address: ${worker}`);

  await preWriteGuard(
    `Select worker ${shortAddr(worker)} for task #${id}.`,
    "0"
  );

  printHeader("Selecting Worker");
  printField("Task ID", String(id));
  printField("Worker", shortAddr(worker));

  const result = await writeContract(
    CONTRACTS.OpenTaskMarket,
    ABI,
    "selectWorker",
    [BigInt(id), worker as Address]
  );

  printSuccess(`Worker selected — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// get
// ──────────────────────────────────────────────────────────────

async function getOpenTask(taskId: string): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");

  const data = (await readContract(
    CONTRACTS.OpenTaskMarket,
    ABI,
    "getTask",
    [BigInt(id)]
  )) as any;

  const isTuple = Array.isArray(data);
  const client = isTuple ? data[0] : data.client;
  const maxPayment = isTuple ? data[1] : data.maxPayment;
  const deadline = isTuple ? data[2] : data.deadline;
  const descriptionHash = isTuple ? data[3] : data.descriptionHash;
  const status = isTuple ? data[4] : data.status;
  const selectedWorker = isTuple ? data[6] : data.selectedWorker;
  const selectedPrice = isTuple ? data[7] : data.selectedPrice;

  printHeader(`Open Task #${id}`);
  printField("Client", client ? shortAddr(client) : "—");
  printField("Max Payment", toEth(maxPayment));
  printField("Status", MARKET_STATUS[Number(status)] ?? `Unknown(${status})`);
  printField("Deadline", toDate(deadline));
  printField("Description", descriptionHash ?? "—");
  printField(
    "Selected Worker",
    selectedWorker && selectedWorker !== "0x0000000000000000000000000000000000000000"
      ? shortAddr(selectedWorker)
      : "None"
  );
  if (selectedPrice && selectedPrice !== 0n) {
    printField("Selected Price", toEth(selectedPrice));
  }
}

// ──────────────────────────────────────────────────────────────
// Command registration
// ──────────────────────────────────────────────────────────────

export function registerMarketCommand(parent: Command): void {
  const market = parent
    .command("market")
    .description("Open task marketplace operations");

  market
    .command("post")
    .description("Post an open task for competitive bidding")
    .option("--max-payment <eth>", "Maximum payment in ETH")
    .option("--deadline <ts>", "Unix timestamp deadline (seconds)")
    .option("--desc <cid>", "IPFS CID for task description")
    .action(async (opts) => {
      try {
        await post(opts.maxPayment || "", opts.deadline || "", opts.desc || "");
      } catch (e) {
        handleError(e);
      }
    });

  market
    .command("bid <id>")
    .description("Submit a bid on an open task")
    .requiredOption("--price <eth>", "Your bid price in ETH")
    .requiredOption("--time <seconds>", "Estimated completion time in seconds")
    .requiredOption("--proposal <cid>", "IPFS CID of your proposal")
    .action(async (id, opts) => {
      try {
        await bid(id, opts.price, opts.time, opts.proposal);
      } catch (e) {
        handleError(e);
      }
    });

  market
    .command("select <id>")
    .description("Select a winning bidder for your open task")
    .requiredOption("--worker <addr>", "Address of the selected worker/bidder")
    .action(async (id, opts) => {
      try {
        await select(id, opts.worker);
      } catch (e) {
        handleError(e);
      }
    });

  market
    .command("get <id>")
    .description("Get open task details")
    .action(async (id) => {
      try {
        await getOpenTask(id);
      } catch (e) {
        handleError(e);
      }
    });
}
