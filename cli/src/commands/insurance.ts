/**
 * covenant insurance — AgentInsurance subcommands.
 *
 *   join   — join the insurance pool
 *   pay    — pay premium for a task
 *   claim  — file an insurance claim
 *   balance — get pool balance
 */
import { Command } from "commander";
import { parseEther, type Address } from "viem";
import chalk from "chalk";
import { loadAbi, CONTRACTS } from "../config.js";
import {
  readContract,
  writeContract,
  printHeader,
  printField,
  printSuccess,
  toEth,
  handleError,
} from "../utils.js";

const ABI = loadAbi("AgentInsurance");

// ──────────────────────────────────────────────────────────────
// join
// ──────────────────────────────────────────────────────────────

async function join(contribution: string): Promise<void> {
  const contributionWei = parseEther(contribution);

  printHeader("Joining Insurance Pool");
  printField("Contribution", `${contribution} ETH`);

  const result = await writeContract(
    CONTRACTS.AgentInsurance,
    ABI,
    "joinPool",
    [],
    contributionWei
  );

  printSuccess(`Joined insurance pool — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// pay
// ──────────────────────────────────────────────────────────────

async function payPremium(taskId: string, premium: string): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");

  const premiumWei = parseEther(premium);

  printHeader("Paying Insurance Premium");
  printField("Task ID", String(id));
  printField("Premium", `${premium} ETH`);

  const result = await writeContract(
    CONTRACTS.AgentInsurance,
    ABI,
    "payPremium",
    [BigInt(id)],
    premiumWei
  );

  printSuccess(`Premium paid — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// claim
// ──────────────────────────────────────────────────────────────

async function claim(taskId: string): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");

  printHeader("Filing Insurance Claim");
  printField("Task ID", String(id));

  const result = await writeContract(
    CONTRACTS.AgentInsurance,
    ABI,
    "claimInsurance",
    [BigInt(id)]
  );

  printSuccess(`Claim filed — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// balance
// ──────────────────────────────────────────────────────────────

async function balance(): Promise<void> {
  const data = await readContract(
    CONTRACTS.AgentInsurance,
    ABI,
    "getPoolBalance",
    []
  );

  printHeader("Insurance Pool Balance");
  printField("Balance", toEth(data as bigint));
}

// ──────────────────────────────────────────────────────────────
// Command registration
// ──────────────────────────────────────────────────────────────

export function registerInsuranceCommand(parent: Command): void {
  const insurance = parent
    .command("insurance")
    .description("Agent insurance pool operations");

  insurance
    .command("join")
    .description("Join the insurance pool")
    .requiredOption(
      "--contribution <eth>",
      "Contribution amount in ETH (min 0.01)"
    )
    .action(async (opts) => {
      try {
        await join(opts.contribution);
      } catch (e) {
        handleError(e);
      }
    });

  insurance
    .command("pay <taskId>")
    .description("Pay insurance premium for a task")
    .requiredOption("--premium <eth>", "Premium amount in ETH")
    .action(async (taskId, opts) => {
      try {
        await payPremium(taskId, opts.premium);
      } catch (e) {
        handleError(e);
      }
    });

  insurance
    .command("claim <taskId>")
    .description("File an insurance claim for a failed task")
    .action(async (taskId) => {
      try {
        await claim(taskId);
      } catch (e) {
        handleError(e);
      }
    });

  insurance
    .command("balance")
    .description("Get insurance pool balance")
    .action(async () => {
      try {
        await balance();
      } catch (e) {
        handleError(e);
      }
    });
}
