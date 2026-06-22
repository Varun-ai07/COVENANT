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
import { formatEther, isAddress } from "viem";
import { CHAIN_NAME, CONTRACTS, SPENDING_LIMIT, getAccount, getPublicClient, loadAbi, RPC_URL } from "./config.js";
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

const VERSION = "2.0.0";

const program = new Command();

// ── Custom help ───────────────────────────────────────────────

function showHelp(): void {
  printBanner();

  console.log(chalk.bold.white("  Usage:"));
  console.log(chalk.gray("    covenant <command> [subcommand] [options]\n"));

  console.log(chalk.bold.white("  Commands:"));
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

  console.log(chalk.bold.white("\n  Meta:"));
  console.log(chalk.cyan("    status".padEnd(17)) + chalk.gray("Show wallet, network, contracts, and spending cap"));
  console.log(chalk.cyan("    help".padEnd(17)) + chalk.gray("Show this help message"));
  console.log(chalk.cyan("    version".padEnd(17)) + chalk.gray("Show CLI version"));

  console.log(chalk.bold.white("\n  Examples:"));
  console.log(chalk.gray('    covenant agent register --stake 0.001 --metadata 0xabc...'));
  console.log(chalk.gray('    covenant task create --worker 0x... --amount 0.01 --deadline 1735689600 --meta 0x...'));
  console.log(chalk.gray('    covenant task get 1'));
  console.log(chalk.gray('    covenant market post --max-payment 0.05 --deadline 1735689600 --desc Qm...'));
  console.log(chalk.gray('    covenant settlement create --payee 0x... --rate 0.0001 --duration 3600'));
  console.log(chalk.gray('    covenant arbitration create 1 --evidence 0x...'));
  console.log(chalk.gray('    covenant attestation attest --subject 0x... --schema 0x... --data 0x... --expires 1735689600'));
  console.log(chalk.gray('    covenant governance propose --target 0x... --calldata 0x... --description 0x... --voting-period 86400'));
  console.log(chalk.gray('    covenant revision request 1 --reason 0x...'));
  console.log(chalk.gray('    covenant status'));
  console.log();
}

// ── Status command ────────────────────────────────────────────

async function showStatus(): Promise<void> {
  printBanner();

  const account = getAccount();
  const hasWallet = !!account;

  printHeader("System Status");
  printField("CLI Version", VERSION);
  printField("Network", CHAIN_NAME);
  printField("RPC URL", RPC_URL);
  printField("Spending Cap", `${formatEther(SPENDING_LIMIT)} ETH/session`);
  printField("Session Spent", `${formatEther(getTotalSpent())} ETH`);
  console.log(chalk.bold.cyan("  └" + "─".repeat(48) + "┘"));

  printHeader("Wallet");
  if (hasWallet && account) {
    printField("Address", chalk.green(account.address));
    try {
      const client = getPublicClient();
      const balance = await client.getBalance({ address: account.address });
      printField("Balance", chalk.yellow(`${formatEther(balance)} ETH`));
    } catch {
      printField("Balance", chalk.yellow("Unable to fetch"));
    }
  } else {
    printWarning("No PRIVATE_KEY configured — read-only mode");
    printInfo("Set PRIVATE_KEY in .env to enable transactions");
  }
  console.log(chalk.bold.cyan("  └" + "─".repeat(48) + "┘"));

  printHeader("Contracts");
  const contractNames = Object.keys(CONTRACTS);
  for (const name of contractNames) {
    const addr = CONTRACTS[name];
    const short = shortAddr(addr);
    printField(name, chalk.dim(short));
  }
  console.log(chalk.bold.cyan("  └" + "─".repeat(48) + "┘"));

  printHeader("On-Chain Status");
  try {
    const client = getPublicClient();
    const blockNumber = await client.getBlockNumber();
    printField("Latest Block", chalk.green(String(blockNumber)));
  } catch {
    printField("Latest Block", chalk.red("Unable to connect"));
  }

  if (hasWallet && account) {
    try {
      const identityAbi = loadAbi("CovenantIdentity");
      const client = getPublicClient();
      const result = await client.readContract({
        address: CONTRACTS.CovenantIdentity,
        abi: identityAbi,
        functionName: "getAgent",
        args: [account.address],
      }) as any;
      const isActive = Array.isArray(result) ? result[4] : (result?.isActive ?? result?.active);
      printField("Agent Status", isActive ? chalk.green("Registered & Active") : chalk.red("Not Registered"));
    } catch {
      printField("Agent Status", chalk.yellow("Not Registered"));
    }
  }

  try {
    const identityAbi = loadAbi("CovenantIdentity");
    const client = getPublicClient();
    const agentCount = await client.readContract({
      address: CONTRACTS.CovenantIdentity,
      abi: identityAbi,
      functionName: "totalAgents",
      args: [],
    }) as bigint;
    printField("Total Agents", chalk.cyan(String(agentCount)));
  } catch {
    printField("Total Agents", chalk.dim("—"));
  }
  console.log(chalk.bold.cyan("  └" + "─".repeat(48) + "┘"));
  console.log();
}

// ── Program setup ─────────────────────────────────────────────

program
  .name("covenant")
  .description(chalk.bold.cyan("COVENANT Protocol CLI") + " — " + chalk.gray("Autonomous Agent Enforcement Protocol"))
  .version(VERSION);

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

// ── Default action (no command) ───────────────────────────────

program.action(() => {
  showHelp();
});

program.parse();
