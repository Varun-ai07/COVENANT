/**
 * covenant batches — ParallelTaskBatch subcommands.
 *
 *   create    — create a batch of tasks for parallel execution
 *   get       — get batch details
 *   status    — check batch status
 *   aggregate — aggregate results after all tasks complete
 */
import { Command } from "commander";
import { parseEther, type Address, isAddress } from "viem";
import chalk from "chalk";
import { loadAbi, CONTRACTS } from "../config.js";
import {
  readContract,
  writeContract,
  preWriteGuard,
  printHeader,
  printField,
  printSuccess,
  printInfo,
  shortAddr,
  toEth,
  toDate,
  handleError,
} from "../utils.js";

const ABI = loadAbi("ParallelTaskBatch");

// ──────────────────────────────────────────────────────────────
// create
// ──────────────────────────────────────────────────────────────

async function create(
  workers: string,
  payments: string,
  deadlines: string,
  descriptionHashes: string,
  aggregationSpec: string
): Promise<void> {
  const workerList = workers.split(",").map((w) => w.trim());
  const paymentList = payments.split(",").map((p) => p.trim());
  const deadlineList = deadlines.split(",").map((d) => d.trim());
  const hashList = descriptionHashes.split(",").map((h) => h.trim());

  if (
    workerList.length !== paymentList.length ||
    workerList.length !== deadlineList.length ||
    workerList.length !== hashList.length
  ) {
    throw new Error(
      "Workers, payments, deadlines, and description hashes must have the same count"
    );
  }

  for (const w of workerList) {
    if (!isAddress(w)) throw new Error(`Invalid worker address: ${w}`);
  }

  const paymentWeiList = paymentList.map((p) => parseEther(p));
  const deadlineNumList = deadlineList.map((d) => {
    const n = parseInt(d, 10);
    if (isNaN(n) || n <= 0) throw new Error(`Invalid deadline: ${d}`);
    return BigInt(n);
  });
  const totalPayment = paymentWeiList.reduce((sum, p) => sum + p, 0n);
  const totalEth = (Number(totalPayment) / 1e18).toFixed(6);

  await preWriteGuard(
    `Create batch of ${workerList.length} tasks with total payment ${totalEth} ETH.`,
    totalEth
  );

  printHeader("Creating Batch");
  printField("Workers", String(workerList.length));
  printField("Total Payment", `${totalEth} ETH`);
  printField("Aggregation Spec", aggregationSpec);

  for (let i = 0; i < workerList.length; i++) {
    printInfo(
      `  Task ${i}: ${shortAddr(workerList[i])} — ${paymentList[i]} ETH`
    );
  }

  const result = await writeContract(
    CONTRACTS.ParallelTaskBatch,
    ABI,
    "createBatch",
    [
      workerList as Address[],
      paymentWeiList,
      deadlineNumList,
      hashList,
      aggregationSpec,
    ],
    totalPayment
  );

  printSuccess(`Batch created — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// get
// ──────────────────────────────────────────────────────────────

async function get(batchId: string): Promise<void> {
  const id = parseInt(batchId, 10);
  if (isNaN(id) || id < 0)
    throw new Error("Batch ID must be a non-negative integer");

  const data = (await readContract(
    CONTRACTS.ParallelTaskBatch,
    ABI,
    "getBatch",
    [BigInt(id)]
  )) as any;

  const isTuple = Array.isArray(data);
  const client = isTuple ? data[0] : data.client;
  const taskIds = isTuple ? data[1] : data.taskIds;
  const aggregationSpec = isTuple ? data[2] : data.aggregationSpec;
  const status = isTuple ? data[3] : data.status;
  const aggregatedResult = isTuple ? data[4] : data.aggregatedResult;

  printHeader(`Batch #${id}`);
  printField("Client", client ? shortAddr(client) : "—");
  printField("Task Count", Array.isArray(taskIds) ? String(taskIds.length) : "—");
  printField("Aggregation Spec", aggregationSpec ?? "—");
  printField("Status", String(status ?? "—"));

  if (Array.isArray(taskIds) && taskIds.length > 0) {
    console.log(chalk.gray("  Task IDs:"));
    for (const tid of taskIds) {
      console.log(chalk.gray(`    ${tid}`));
    }
  }

  if (aggregatedResult && aggregatedResult !== "0x") {
    printField("Aggregated Result", aggregatedResult);
  }
}

// ──────────────────────────────────────────────────────────────
// status
// ──────────────────────────────────────────────────────────────

async function status(batchId: string): Promise<void> {
  const id = parseInt(batchId, 10);
  if (isNaN(id) || id < 0)
    throw new Error("Batch ID must be a non-negative integer");

  const result = await readContract(
    CONTRACTS.ParallelTaskBatch,
    ABI,
    "getBatchStatus",
    [BigInt(id)]
  );

  printHeader(`Batch #${id} Status`);
  printField("Status", String(result));
}

// ──────────────────────────────────────────────────────────────
// aggregate
// ──────────────────────────────────────────────────────────────

async function aggregate(batchId: string): Promise<void> {
  const id = parseInt(batchId, 10);
  if (isNaN(id) || id < 0)
    throw new Error("Batch ID must be a non-negative integer");

  await preWriteGuard(
    `Aggregate results for batch #${id}.`,
    "0"
  );

  printHeader("Aggregating Batch Results");
  printField("Batch ID", String(id));

  const result = await writeContract(
    CONTRACTS.ParallelTaskBatch,
    ABI,
    "aggregateResults",
    [BigInt(id)]
  );

  printSuccess(`Results aggregated — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// Command registration
// ──────────────────────────────────────────────────────────────

export function registerBatchesCommand(parent: Command): void {
  const batches = parent
    .command("batches")
    .description("Parallel task batch operations");

  batches
    .command("create")
    .description("Create a batch of tasks for parallel execution")
    .requiredOption(
      "--workers <addrs>",
      "Comma-separated worker addresses"
    )
    .requiredOption(
      "--payments <eths>",
      "Comma-separated payment amounts in ETH"
    )
    .requiredOption(
      "--deadlines <ts>",
      "Comma-separated Unix timestamp deadlines"
    )
    .requiredOption(
      "--hashes <cids>",
      "Comma-separated IPFS CIDs for task descriptions"
    )
    .requiredOption(
      "--aggregation <spec>",
      "IPFS CID for aggregation specification"
    )
    .action(async (opts) => {
      try {
        await create(
          opts.workers,
          opts.payments,
          opts.deadlines,
          opts.hashes,
          opts.aggregation
        );
      } catch (e) {
        handleError(e);
      }
    });

  batches
    .command("get <batchId>")
    .description("Get batch details")
    .action(async (batchId) => {
      try {
        await get(batchId);
      } catch (e) {
        handleError(e);
      }
    });

  batches
    .command("status <batchId>")
    .description("Check batch status")
    .action(async (batchId) => {
      try {
        await status(batchId);
      } catch (e) {
        handleError(e);
      }
    });

  batches
    .command("aggregate <batchId>")
    .description("Aggregate results after all tasks complete")
    .action(async (batchId) => {
      try {
        await aggregate(batchId);
      } catch (e) {
        handleError(e);
      }
    });
}
