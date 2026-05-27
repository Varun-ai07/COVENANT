/**
 * covenant milestones — Milestone-based task subcommands.
 *
 *   create — create a milestone-based task
 *   submit — submit a milestone deliverable
 *   verify — verify a milestone and release payment
 */
import { Command } from "commander";
import { parseEther, type Address, isAddress } from "viem";
import chalk from "chalk";
import { loadAbi, CONTRACTS } from "../config.js";
import {
  readContract,
  writeContract,
  printHeader,
  printField,
  printSuccess,
  printInfo,
  shortAddr,
  toEth,
  toDate,
  handleError,
} from "../utils.js";

const ABI = loadAbi("TaskEscrow");

// ──────────────────────────────────────────────────────────────
// create
// ──────────────────────────────────────────────────────────────

async function create(
  worker: string,
  totalPayment: string,
  deadline: string,
  descriptionHash: string,
  milestoneDescriptions: string,
  milestonePayments: string
): Promise<void> {
  if (!isAddress(worker)) throw new Error(`Invalid worker address: ${worker}`);

  const totalWei = parseEther(totalPayment);
  const deadlineNum = parseInt(deadline, 10);
  if (isNaN(deadlineNum) || deadlineNum <= 0) {
    throw new Error("Deadline must be a positive Unix timestamp");
  }

  const descriptions = milestoneDescriptions
    .split("|")
    .map((d) => d.trim())
    .filter(Boolean);
  const payments = milestonePayments
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (descriptions.length !== payments.length) {
    throw new Error(
      "Milestone descriptions (| separated) and payments (, separated) must have the same count"
    );
  }

  const paymentWeiList = payments.map((p) => parseEther(p));
  const totalFromMilestones = paymentWeiList.reduce((sum, p) => sum + p, 0n);

  if (totalFromMilestones !== totalWei) {
    throw new Error(
      `Total payment (${totalPayment} ETH) does not match sum of milestone payments (${Number(totalFromMilestones) / 1e18} ETH)`
    );
  }

  printHeader("Creating Milestone Task");
  printField("Worker", worker);
  printField("Total Payment", `${totalPayment} ETH`);
  printField("Deadline", toDate(deadlineNum));
  printField("Description CID", descriptionHash);
  printField("Milestones", String(descriptions.length));

  for (let i = 0; i < descriptions.length; i++) {
    printInfo(`  Milestone ${i}: ${descriptions[i]} — ${payments[i]} ETH`);
  }

  const result = await writeContract(
    CONTRACTS.TaskEscrow,
    ABI,
    "createMilestoneTask",
    [
      worker as Address,
      totalWei,
      BigInt(deadlineNum),
      descriptionHash,
      descriptions,
      paymentWeiList,
    ],
    totalWei
  );

  printSuccess(`Milestone task created — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// submit
// ──────────────────────────────────────────────────────────────

async function submit(
  taskId: string,
  index: string,
  deliverableHash: string
): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");

  const idx = parseInt(index, 10);
  if (isNaN(idx) || idx < 0)
    throw new Error("Milestone index must be a non-negative integer");

  printHeader("Submitting Milestone");
  printField("Task ID", String(id));
  printField("Milestone Index", String(idx));
  printField("Deliverable CID", deliverableHash);

  const result = await writeContract(
    CONTRACTS.TaskEscrow,
    ABI,
    "submitMilestone",
    [BigInt(id), BigInt(idx), deliverableHash]
  );

  printSuccess(`Milestone submitted — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// verify
// ──────────────────────────────────────────────────────────────

async function verify(
  taskId: string,
  index: string,
  success: string
): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");

  const idx = parseInt(index, 10);
  if (isNaN(idx) || idx < 0)
    throw new Error("Milestone index must be a non-negative integer");

  const approved =
    success.toLowerCase() === "true" || success === "1";

  printHeader("Verifying Milestone");
  printField("Task ID", String(id));
  printField("Milestone Index", String(idx));
  printField("Result", approved ? "Approved" : "Rejected");

  const result = await writeContract(
    CONTRACTS.TaskEscrow,
    ABI,
    "verifyMilestone",
    [BigInt(id), BigInt(idx), approved]
  );

  printSuccess(`Milestone verified — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// Command registration
// ──────────────────────────────────────────────────────────────

export function registerMilestonesCommand(parent: Command): void {
  const milestones = parent
    .command("milestones")
    .description("Milestone-based task operations");

  milestones
    .command("create")
    .description("Create a milestone-based task")
    .requiredOption("--worker <addr>", "Worker agent's Ethereum address")
    .requiredOption("--payment <eth>", "Total payment in ETH")
    .requiredOption("--deadline <ts>", "Unix timestamp deadline (seconds)")
    .requiredOption("--desc <cid>", "IPFS CID for task description")
    .requiredOption(
      "--milestone-descs <descs>",
      "Pipe-separated milestone descriptions (e.g. 'Design|Build|Test')"
    )
    .requiredOption(
      "--milestone-pays <pays>",
      "Comma-separated milestone payments in ETH (e.g. '0.003,0.005,0.002')"
    )
    .action(async (opts) => {
      try {
        await create(
          opts.worker,
          opts.payment,
          opts.deadline,
          opts.desc,
          opts.milestoneDescs,
          opts.milestonePays
        );
      } catch (e) {
        handleError(e);
      }
    });

  milestones
    .command("submit <taskId> <index>")
    .description("Submit a milestone deliverable")
    .requiredOption("--hash <cid>", "IPFS CID of the milestone deliverable")
    .action(async (taskId, index, opts) => {
      try {
        await submit(taskId, index, opts.hash);
      } catch (e) {
        handleError(e);
      }
    });

  milestones
    .command("verify <taskId> <index>")
    .description("Verify a milestone and release its payment")
    .option("--success", "Approve the milestone (default)", true)
    .option("--reject", "Reject the milestone")
    .action(async (taskId, index, opts) => {
      try {
        await verify(taskId, index, opts.reject ? "false" : "true");
      } catch (e) {
        handleError(e);
      }
    });
}
