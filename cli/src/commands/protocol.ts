/**
 * covenant protocol — Protocol-wide subcommands.
 *
 *   stats       — aggregate protocol statistics
 *   leaderboard — top agents by reputation
 */
import { Command } from "commander";
import { type Address } from "viem";
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
  printHeader("Agent Leaderboard");

  try {
    const agentRegistryAbi = loadAbi("AgentRegistry");
    const agents = (await readContract(
      CONTRACTS.AgentRegistry,
      agentRegistryAbi,
      "getAllAgents",
      []
    )) as Address[];

    if (!agents || agents.length === 0) {
      printField("Result", "No agents registered yet");
      return;
    }

    const identityAbi = loadAbi("CovenantIdentity");
    const entries: { addr: string; rep: number }[] = [];

    const toCheck = agents.slice(0, Math.min(agents.length, limit + 5));
    const results = await Promise.allSettled(
      toCheck.map((addr) =>
        readContract(CONTRACTS.CovenantIdentity, identityAbi, "getAgent", [addr])
      )
    );

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled") {
        const data = r.value as any;
        const rep = Number(Array.isArray(data) ? data[1] : data.reputation ?? 0);
        entries.push({ addr: toCheck[i], rep });
      }
    }

    entries.sort((a, b) => b.rep - a.rep);
    const top = entries.slice(0, limit);

    printField("Total Agents", String(agents.length));
    console.log();

    for (let i = 0; i < top.length; i++) {
      const { addr, rep } = top[i];
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
      console.log(
        chalk.gray(`  ${medal.padEnd(5)}`) +
        chalk.white(shortAddr(addr)) +
        chalk.gray("  rep ") +
        chalk.cyan(String(rep))
      );
    }
  } catch {
    printField("Result", "Leaderboard requires the full agent list. Use corven_match for worker discovery.");
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
