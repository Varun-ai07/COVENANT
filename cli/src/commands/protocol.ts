/**
 * covenant protocol — Protocol-wide subcommands.
 *
 *   stats       — aggregate protocol statistics
 *   leaderboard — top agents by reputation
 */
import { Command } from "commander";
import { formatEther, type Address } from "viem";
import chalk from "chalk";
import { loadAbi, CONTRACTS } from "../config.js";
import {
  readContract,
  printHeader,
  printField,
  shortAddr,
  toEth,
  handleError,
} from "../utils.js";

const registryAbi = loadAbi("AgentRegistry");
const escrowAbi = loadAbi("TaskEscrow");

// ──────────────────────────────────────────────────────────────
// stats
// ──────────────────────────────────────────────────────────────

async function stats(): Promise<void> {
  const [totalAgents, totalTasks, accumulatedFees] = await Promise.all([
    readContract(CONTRACTS.AgentRegistry, registryAbi, "getAgentCount", []),
    readContract(CONTRACTS.TaskEscrow, escrowAbi, "taskCounter", []),
    readContract(CONTRACTS.TaskEscrow, escrowAbi, "accumulatedFees", []),
  ]);

  printHeader("COVENANT Protocol Statistics");
  printField("Total Agents", String(totalAgents));
  printField("Total Tasks", String(totalTasks));
  printField("Protocol Fees", toEth(accumulatedFees as bigint));
}

// ──────────────────────────────────────────────────────────────
// leaderboard
// ──────────────────────────────────────────────────────────────

async function leaderboard(limit: number): Promise<void> {
  // getAllAgents returns all registered agent addresses
  const addresses = (await readContract(
    CONTRACTS.AgentRegistry,
    registryAbi,
    "getAllAgents",
    []
  )) as Address[];

  if (addresses.length === 0) {
    printHeader("Agent Leaderboard");
    console.log(chalk.gray("  No registered agents yet."));
    return;
  }

  // Deduplicate addresses (contract may return duplicates)
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))] as Address[];

  // Fetch profiles in parallel
  const profiles = await Promise.all(
    unique.map((addr) =>
      readContract(CONTRACTS.AgentRegistry, registryAbi, "getAgent", [addr])
        .then((p: any) => ({ ...p, _addr: addr }))
        .catch(() => null)
    )
  );

  const agents: any[] = profiles.filter((p) => p && p.isActive);

  agents.sort(
    (a: any, b: any) => Number(b.reputation ?? 0) - Number(a.reputation ?? 0)
  );

  const top = agents.slice(0, Math.min(limit, 50));

  printHeader("Agent Leaderboard");
  printField("Total Agents", String(addresses.length));
  printField("Active", String(agents.length));
  printField("Showing", String(top.length));
  console.log();

  // Table header
  console.log(
    chalk.gray(
      "  " +
        "Rank".padEnd(6) +
        "Address".padEnd(14) +
        "Name".padEnd(20) +
        "Reputation".padEnd(12) +
        "Done".padEnd(6) +
        "Failed".padEnd(8) +
        "Stake"
    )
  );
  console.log(chalk.gray("  " + "─".repeat(72)));

  for (let i = 0; i < top.length; i++) {
    const a = top[i];
    const addr = a._addr;
    const name = (a.name ?? "?").slice(0, 18).padEnd(20);
    const rep = String(a.reputation ?? 0).padEnd(12);
    const done = String(a.tasksCompleted ?? 0).padEnd(6);
    const failed = String(a.tasksFailed ?? 0).padEnd(8);
    const stake = toEth(a.stakedAmount);

    console.log(
      chalk.gray(`  #${String(i + 1).padEnd(4)}`) +
        chalk.white(`${shortAddr(addr).padEnd(14)}`) +
        chalk.white(name) +
        chalk.cyan(rep) +
        chalk.green(done) +
        chalk.red(failed) +
        chalk.gray(stake)
    );
  }
}

// ──────────────────────────────────────────────────────────────
// Command registration
// ──────────────────────────────────────────────────────────────

export function registerProtocolCommand(parent: Command): void {
  const protocol = parent
    .command("protocol")
    .description("Protocol-wide operations");

  protocol
    .command("stats")
    .description("Show aggregate protocol statistics")
    .action(async () => {
      try {
        await stats();
      } catch (e) {
        handleError(e);
      }
    });

  protocol
    .command("leaderboard")
    .description("Show top agents by reputation")
    .option("--limit <n>", "Number of agents to show (max 50)", "10")
    .action(async (opts) => {
      try {
        await leaderboard(parseInt(opts.limit, 10));
      } catch (e) {
        handleError(e);
      }
    });
}
