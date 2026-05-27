/**
 * covenant agent — AgentRegistry subcommands.
 *
 *   register  — register a new agent on-chain
 *   get       — look up an agent profile by address
 *   find      — find agents by capability
 *   list      — list all registered agent addresses
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
  shortAddr,
  toEth,
  toDate,
  handleError,
} from "../utils.js";

const ABI = loadAbi("AgentRegistry");

// ──────────────────────────────────────────────────────────────
// register
// ──────────────────────────────────────────────────────────────

async function register(
  name: string,
  capabilities: string,
  stake: string
): Promise<void> {
  const caps = capabilities
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  if (caps.length === 0) {
    throw new Error("At least one capability is required");
  }

  const stakeWei = parseEther(stake);

  printHeader("Registering Agent");
  printField("Name", name);
  printField("Capabilities", caps.join(", "));
  printField("Stake", `${stake} ETH`);

  const result = await writeContract(
    CONTRACTS.AgentRegistry,
    ABI,
    "register",
    [name, caps],
    stakeWei
  );

  printSuccess(`Agent registered — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// get
// ──────────────────────────────────────────────────────────────

async function get(address: string): Promise<void> {
  if (!isAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }

  const data = (await readContract(
    CONTRACTS.AgentRegistry,
    ABI,
    "getAgent",
    [address as Address]
  )) as any;

  printHeader(`Agent Profile — ${shortAddr(address)}`);
  printField("Name", data.name ?? "—");
  printField("DID", data.did ? shortAddr(data.did) : "—");
  printField("Reputation", String(data.reputation ?? 0));
  printField("Stake", toEth(data.stakedAmount));
  printField(
    "Capabilities",
    Array.isArray(data.capabilities) ? data.capabilities.join(", ") : "—"
  );
  printField("Active", data.isActive ? "Yes" : "No");
  printField("Tasks Completed", String(data.tasksCompleted ?? 0));
  printField("Tasks Failed", String(data.tasksFailed ?? 0));
  printField("Registered", toDate(data.registeredAt));
}

// ──────────────────────────────────────────────────────────────
// find
// ──────────────────────────────────────────────────────────────

async function find(capability: string): Promise<void> {
  const addresses = (await readContract(
    CONTRACTS.AgentRegistry,
    ABI,
    "getAgentsByCapability",
    [capability]
  )) as Address[];

  printHeader(`Workers with capability "${capability}"`);
  printField("Found", String(addresses.length));

  if (addresses.length === 0) return;

  for (const addr of addresses) {
    try {
      const profile = (await readContract(
        CONTRACTS.AgentRegistry,
        ABI,
        "getAgent",
        [addr]
      )) as any;
      console.log(
        chalk.gray(`  ${shortAddr(addr)}  `) +
          chalk.white(profile.name ?? "?") +
          chalk.gray(`  rep: ${profile.reputation ?? 0}  `) +
          chalk.gray(`tasks: ${profile.tasksCompleted ?? 0}`)
      );
    } catch {
      console.log(chalk.gray(`  ${shortAddr(addr)}  (profile unavailable)`));
    }
  }
}

// ──────────────────────────────────────────────────────────────
// list
// ──────────────────────────────────────────────────────────────

async function list(): Promise<void> {
  const addresses = (await readContract(
    CONTRACTS.AgentRegistry,
    ABI,
    "getAllAgents",
    []
  )) as Address[];

  printHeader("All Registered Agents");
  printField("Total", String(addresses.length));

  if (addresses.length === 0) return;

  for (const addr of addresses) {
    console.log(chalk.gray(`  ${addr}`));
  }
}

// ──────────────────────────────────────────────────────────────
// Command registration
// ──────────────────────────────────────────────────────────────

export function registerAgentCommand(parent: Command): void {
  const agent = parent.command("agent").description("Agent registry operations");

  agent
    .command("register")
    .description("Register a new agent on-chain")
    .requiredOption("--name <name>", "Agent display name")
    .requiredOption(
      "--capabilities <caps>",
      "Comma-separated capability tags (e.g. python,security)"
    )
    .option("--stake <eth>", "Stake amount in ETH", "0.001")
    .action(async (opts) => {
      try {
        await register(opts.name, opts.capabilities, opts.stake);
      } catch (e) {
        handleError(e);
      }
    });

  agent
    .command("get <address>")
    .description("Get agent profile by address")
    .action(async (address) => {
      try {
        await get(address);
      } catch (e) {
        handleError(e);
      }
    });

  agent
    .command("find")
    .description("Find agents by capability")
    .requiredOption("--capability <cap>", "Capability to search for")
    .action(async (opts) => {
      try {
        await find(opts.capability);
      } catch (e) {
        handleError(e);
      }
    });

  agent
    .command("list")
    .description("List all registered agent addresses")
    .action(async () => {
      try {
        await list();
      } catch (e) {
        handleError(e);
      }
    });
}
