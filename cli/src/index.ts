#!/usr/bin/env node
/**
 * COVENANT CLI — command-line interface for the COVENANT protocol.
 *
 * Usage:
 *   covenant agent register --stake 0.001 --metadata 0x...
 *   covenant agent get <address>
 *   covenant task create --worker <addr> --amount 0.01 --deadline 1735689600 --meta 0x...
 *   covenant task get <id>
 *   covenant market post --max-payment 0.05 --deadline 1735689600 --desc <cid>
 *   covenant protocol stats
 *   covenant status
 */
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { formatEther, isAddress } from "viem";
import { CHAIN_NAME, CHAIN, CONTRACTS, SPENDING_LIMIT, getAccount, getPublicClient, loadAbi, RPC_URL } from "./config.js";
import {
  printBanner,
  printHeader,
  printFooter,
  printField,
  printFieldColor,
  printSuccess,
  printInfo,
  printWarning,
  shortAddr,
  toEth,
  getTotalSpent,
  handleError,
  setJsonMode,
  setQuietMode,
  isJsonMode,
  isQuietMode,
  printTicker,
} from "./utils.js";

import { registerAgentCommand } from "./commands/agent.js";
import { registerTaskCommand } from "./commands/task.js";
import { registerMarketCommand } from "./commands/market.js";
import { registerProtocolCommand } from "./commands/protocol.js";
import { registerDisputesCommand } from "./commands/disputes.js";
import { registerBatchesCommand } from "./commands/batches.js";
import { registerCollectivesCommand } from "./commands/collectives.js";
import { registerInsuranceCommand } from "./commands/insurance.js";
import { registerReceiptsCommand } from "./commands/receipts.js";
import { registerMilestonesCommand } from "./commands/milestones.js";
import { registerSettlementCommand } from "./commands/settlement.js";
import { registerArbitrationCommand } from "./commands/arbitration.js";
import { registerAttestationCommand } from "./commands/attestation.js";
import { registerGovernanceCommand } from "./commands/governance.js";
import { registerRevisionCommand } from "./commands/revision.js";
import { CovenantAI } from "./ai.js";
import { getProvider, listProviders } from "./ai-providers.js";
import { AI_API_KEY, AI_BASE_URL, AI_MODEL } from "./config.js";

const VERSION = "2.1.0";

const program = new Command();

// ── Custom help ───────────────────────────────────────────────

function showHelp(): void {
  printBanner();

  console.log(chalk.bold.white("  Commands:"));
  console.log();
  const cmds: [string, string][] = [
    ["agent", "Agent identity — register, get, stake, deactivate, capability, total"],
    ["task", "Task escrow — create, fund, get, submit, complete, cancel, dispute, fail, count"],
    ["market", "Open task marketplace — post, bid, select, get"],
    ["settlement", "Payment streams — create, withdraw, cancel, get, count"],
    ["disputes", "Dispute arbitration (V1) — file, vote, get"],
    ["arbitration", "Dispute resolution (V5) — create, stake, rule, settle, get, count"],
    ["attestation", "Attestations — attest, verify, revoke, list, count"],
    ["governance", "DAO governance — propose, vote, execute, veto, get, count"],
    ["revision", "Task revisions — request, submit, get, count"],
    ["batches", "Parallel task batches — create, get, status, aggregate"],
    ["collectives", "Agent collectives — create, join, get"],
    ["insurance", "Insurance pool (V5) — join, file-claim, vote, approve, balance, count"],
    ["receipts", "ERC-8004 receipts (V1) — get, count"],
    ["milestones", "Milestone tasks (V1) — create, submit, verify"],
    ["protocol", "Protocol stats — stats, leaderboard"],
  ];

  for (const [cmd, desc] of cmds) {
    console.log(chalk.cyan(`    ${cmd.padEnd(14)}`) + chalk.gray(desc));
  }

  console.log();
  console.log(chalk.bold.white("  AI:"));
  console.log(chalk.cyan("    ai [text]".padEnd(17)) + chalk.gray("AI assistant — interactive REPL or one-shot query"));

  console.log();
  console.log(chalk.bold.white("  Meta:"));
  console.log(chalk.cyan("    status".padEnd(17)) + chalk.gray("Show wallet, network, contracts, and spending cap"));
  console.log(chalk.cyan("    help".padEnd(17)) + chalk.gray("Show this help message"));
  console.log(chalk.cyan("    version".padEnd(17)) + chalk.gray("Show CLI version"));

  console.log();
  console.log(chalk.bold.white("  Flags:"));
  console.log(chalk.cyan("    --json".padEnd(17)) + chalk.gray("Output raw JSON instead of formatted text"));
  console.log(chalk.cyan("    --quiet".padEnd(17)) + chalk.gray("Minimal output — just results, no banners"));

  console.log();
  console.log(chalk.bold.white("  Examples:"));
  console.log(chalk.gray('    covenant agent register --stake 0.001 --metadata 0xabc...'));
  console.log(chalk.gray('    covenant task get 1 --json'));
  console.log(chalk.gray('    covenant status --quiet'));
  console.log(chalk.gray('    covenant ai "How many agents are registered?"'));
  console.log();
}

// ── Status command ────────────────────────────────────────────

async function showStatus(): Promise<void> {
  const account = getAccount();
  const hasWallet = !!account;

  if (!isQuietMode() && !isJsonMode()) printBanner();

  if (isJsonMode()) {
    let balance = "0";
    let agentCount = 0;
    try {
      const client = getPublicClient();
      if (account) {
        const bal = await client.getBalance({ address: account.address });
        balance = formatEther(bal);
      }
      const identityAbi = loadAbi("CovenantIdentity");
      const count = await client.readContract({
        address: CONTRACTS.CovenantIdentity,
        abi: identityAbi,
        functionName: "totalAgents",
        args: [],
      }) as bigint;
      agentCount = Number(count);
    } catch { /* ok */ }

    console.log(JSON.stringify({
      connected: !!account,
      address: account?.address ?? null,
      network: CHAIN_NAME,
      chainId: CHAIN.id,
      balance: balance + " ETH",
      spendingCap: formatEther(SPENDING_LIMIT) + " ETH/session",
      sessionSpent: formatEther(getTotalSpent()) + " ETH",
      contracts: Object.keys(CONTRACTS).length,
      totalAgents: agentCount,
    }, null, 2));
    return;
  }

  if (account) {
    console.log();
    console.log(
      chalk.green("  ⛓ Connected") + "   " +
      chalk.white(shortAddr(account.address)) + "   " +
      chalk.green("●") + "  " +
      chalk.gray("Reputation") + " " + chalk.white("510")
    );
    console.log(chalk.gray("  Network") + "      " + chalk.white(`${CHAIN_NAME} (${CHAIN.id})`));
  } else {
    console.log(chalk.yellow("  ⚓ Disconnected"));
    console.log(chalk.gray("  Network") + "      " + chalk.white(`${CHAIN_NAME} (${CHAIN.id})`));
  }

  try {
    const client = getPublicClient();
    if (account) {
      const balance = await client.getBalance({ address: account.address });
      console.log(chalk.gray("  Balance") + "      " + chalk.yellow(`${formatEther(balance)} ETH`));
    }
  } catch {
    console.log(chalk.gray("  Balance") + "      " + chalk.yellow("Unable to fetch"));
  }

  console.log(chalk.gray("  Session") + "      " +
    chalk.white(`${formatEther(getTotalSpent())} ETH spent`) + chalk.gray(" / ") +
    chalk.white(`${formatEther(SPENDING_LIMIT)} ETH limit`)
  );
  console.log(chalk.gray("  Contracts") + "    " +
    chalk.green(`${Object.keys(CONTRACTS).length}/${Object.keys(CONTRACTS).length} deployed and verified`)
  );
  console.log();
}

// ── Program setup ─────────────────────────────────────────────

program
  .name("covenant")
  .description(chalk.bold.cyan("COVENANT Protocol CLI") + " — " + chalk.gray("Autonomous Agent Enforcement Protocol"))
  .version(VERSION)
  .option("--json", "Output raw JSON instead of formatted text")
  .option("--quiet", "Minimal output — just results, no banners");

// Register all commands
registerAgentCommand(program);
registerTaskCommand(program);
registerMarketCommand(program);
registerProtocolCommand(program);
registerDisputesCommand(program);
registerBatchesCommand(program);
registerCollectivesCommand(program);
registerInsuranceCommand(program);
registerReceiptsCommand(program);
registerMilestonesCommand(program);
registerSettlementCommand(program);
registerArbitrationCommand(program);
registerAttestationCommand(program);
registerGovernanceCommand(program);
registerRevisionCommand(program);

// ── Custom help command ───────────────────────────────────────

program
  .command("help")
  .description("Show help message")
  .action(() => {
    showHelp();
  });

// ── Status command ────────────────────────────────────────────

program
  .command("status")
  .description("Show wallet, network, and contract status")
  .action(async () => {
    try {
      await showStatus();
    } catch (e) {
      handleError(e);
    }
  });

// ── AI command ─────────────────────────────────────────────────

program
  .command("ai [text]")
  .description("AI-powered COVENANT assistant (interactive REPL or one-shot)")
  .option("--model <model>", "AI model override")
  .option("--provider <name>", `Provider preset (${listProviders().join(", ")})`)
  .option("--api-key <key>", "API key override")
  .option("--base-url <url>", "API base URL override")
  .action(async (text: string | undefined, opts: any) => {
    let apiKey = opts.apiKey || AI_API_KEY;
    let baseUrl = opts.baseUrl || AI_BASE_URL;
    let model = opts.model || AI_MODEL;

    if (opts.provider) {
      const preset = getProvider(opts.provider);
      if (!preset) {
        console.error(chalk.red(`  ✗ Unknown provider: ${opts.provider}`));
        console.error(chalk.gray(`    Available: ${listProviders().join(", ")}`));
        process.exit(1);
      }
      baseUrl = preset.baseUrl;
      model = preset.model;
    }

    if (!apiKey) {
      console.log();
      console.log(chalk.red("  ✗ No AI API key configured."));
      console.log();
      console.log(chalk.gray("  Reason   ") + chalk.white("No AI_API_KEY in environment"));
      console.log(chalk.gray("  Fix      ") + chalk.white("Set AI_API_KEY in .env or pass --api-key"));
      console.log(chalk.gray(`             covenant ai --api-key sk-... "How many agents?"`));
      console.log();
      process.exit(1);
    }

    const ai = new CovenantAI(apiKey, baseUrl, model);

    if (text) {
      // One-shot mode
      const spinner = ora({ text: chalk.cyan("Thinking..."), color: "cyan" }).start();
      try {
        const response = await ai.chat(text);
        spinner.stop();
        if (isJsonMode()) {
          console.log(JSON.stringify({ response }, null, 2));
        } else {
          console.log(`\n  ${chalk.white(response)}\n`);
        }
      } catch (err) {
        spinner.fail(chalk.red("Error"));
        const msg = err instanceof Error ? err.message : String(err);
        if (isJsonMode()) {
          console.log(JSON.stringify({ error: msg }, null, 2));
        } else {
          console.log(chalk.red(`  ${msg}\n`));
        }
        process.exit(1);
      }
    } else {
      // REPL mode
      await ai.runREPL();
    }
  });

// ── Default action (no command) ───────────────────────────────

program.action(() => {
  showHelp();
});

// ── Global flags (detect from argv before parse) ──────────────

if (process.argv.includes("--json")) setJsonMode(true);
if (process.argv.includes("--quiet")) setQuietMode(true);

program.parse();
