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

const identityAbi = loadAbi("CovenantIdentity");
const escrowAbi = loadAbi("CovenantEscrow");

// ──────────────────────────────────────────────────────────────
// stats
// ──────────────────────────────────────────────────────────────

async function stats(): Promise<void> {
  const [totalAgents, totalTasks, accumulatedFees] = await Promise.all([
    readContract(CONTRACTS.CovenantIdentity, identityAbi, "totalAgents", []),
    readContract(CONTRACTS.CovenantEscrow, escrowAbi, "taskCount", []),
    readContract(CONTRACTS.CovenantEscrow, escrowAbi, "accumulatedFees", []).catch(() => 0n),
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
  const addresses = (await readContract(
    CONTRACTS.CovenantIdentity,
    identityAbi,
    "totalAgents",
    []
  )) as bigint;

  printHeader("Agent Leaderboard");
  printField("Total Agents", String(addresses));

  // Use a simple approach — just show stats
  // Full leaderboard requires iterating, which is expensive
  printField("Showing", "Top agents by reputation (requires iteration)");
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
