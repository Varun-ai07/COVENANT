/**
 * covenant agent — CovenantIdentity subcommands.
 *
 *   register    — register a new agent on-chain
 *   get         — look up an agent profile by address
 *   stake       — increase stake
 *   deactivate  — deactivate agent
 *   capability  — check if agent has a capability
 */
import { Command } from "commander";
import { parseEther, type Address, isAddress, toBytes } from "viem";
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

const ABI = loadAbi("CovenantIdentity");

// ──────────────────────────────────────────────────────────────
// register
// ──────────────────────────────────────────────────────────────

async function register(stake: string, metadata: string): Promise<void> {
  const stakeWei = parseEther(stake);
  const metadataRoot = metadata as `0x${string}`;

  printHeader("Registering Agent");
  printField("Stake", `${stake} ETH`);
  printField("Metadata Root", metadataRoot);

  const result = await writeContract(
    CONTRACTS.CovenantIdentity,
    ABI,
    "register",
    [stakeWei, metadataRoot],
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
    CONTRACTS.CovenantIdentity,
    ABI,
    "getAgent",
    [address as Address]
  )) as any;

  printHeader(`Agent Profile — ${shortAddr(address)}`);

  if (Array.isArray(data)) {
    printField("Stake", toEth(data[0]));
    printField("Reputation", String(data[1] ?? 0));
    printField("Registered", toDate(data[2]));
    printField("Metadata Root", data[3] ?? "—");
    printField("Active", data[4] ? "Yes" : "No");
    printField("Tasks Completed", String(data[5] ?? 0));
    printField("Tasks Failed", String(data[6] ?? 0));
  } else {
    printField("Stake", toEth(data.stakedAmount ?? data.stake));
    printField("Reputation", String(data.reputation ?? 0));
    printField("Registered", toDate(data.registeredAt ?? data.registered));
    printField("Metadata Root", data.metadataRoot ?? data.metadata ?? "—");
    printField("Active", (data.isActive ?? data.active) ? "Yes" : "No");
    printField("Tasks Completed", String(data.tasksCompleted ?? 0));
    printField("Tasks Failed", String(data.tasksFailed ?? 0));
  }
}

// ──────────────────────────────────────────────────────────────
// stake
// ──────────────────────────────────────────────────────────────

async function stake(amount: string): Promise<void> {
  const amountWei = parseEther(amount);

  printHeader("Increasing Stake");
  printField("Amount", `${amount} ETH`);

  const result = await writeContract(
    CONTRACTS.CovenantIdentity,
    ABI,
    "increaseStake",
    [],
    amountWei
  );

  printSuccess(`Stake increased — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// deactivate
// ──────────────────────────────────────────────────────────────

async function deactivate(): Promise<void> {
  printHeader("Deactivating Agent");

  const result = await writeContract(
    CONTRACTS.CovenantIdentity,
    ABI,
    "deactivate",
    []
  );

  printSuccess(`Agent deactivated — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// capability
// ──────────────────────────────────────────────────────────────

async function capability(address: string, capHash: string): Promise<void> {
  if (!isAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }

  const result = (await readContract(
    CONTRACTS.CovenantIdentity,
    ABI,
    "hasCapability",
    [address as Address, capHash as `0x${string}`]
  )) as boolean;

  printHeader(`Capability Check — ${shortAddr(address)}`);
  printField("Capability Hash", capHash);
  printField("Has Capability", result ? chalk.green("Yes") : chalk.red("No"));
}

// ──────────────────────────────────────────────────────────────
// total
// ──────────────────────────────────────────────────────────────

async function total(): Promise<void> {
  const count = (await readContract(
    CONTRACTS.CovenantIdentity,
    ABI,
    "totalAgents",
    []
  )) as bigint;

  printHeader("Total Agents");
  printField("Count", String(count));
}

// ──────────────────────────────────────────────────────────────
// Command registration
// ──────────────────────────────────────────────────────────────

export function registerAgentCommand(parent: Command): void {
  const agent = parent.command("agent").description("Agent identity operations (CovenantIdentity)");

  agent
    .command("register")
    .description("Register a new agent on-chain")
    .requiredOption("--stake <eth>", "Stake amount in ETH")
    .requiredOption("--metadata <hash>", "Metadata root hash (bytes32)")
    .action(async (opts) => {
      try {
        await register(opts.stake, opts.metadata);
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
    .command("stake")
    .description("Increase agent stake")
    .requiredOption("--amount <eth>", "Amount to stake in ETH")
    .action(async (opts) => {
      try {
        await stake(opts.amount);
      } catch (e) {
        handleError(e);
      }
    });

  agent
    .command("deactivate")
    .description("Deactivate your agent")
    .action(async () => {
      try {
        await deactivate();
      } catch (e) {
        handleError(e);
      }
    });

  agent
    .command("capability <address> <capHash>")
    .description("Check if agent has a capability")
    .action(async (address, capHash) => {
      try {
        await capability(address, capHash);
      } catch (e) {
        handleError(e);
      }
    });

  agent
    .command("total")
    .description("Get total number of registered agents")
    .action(async () => {
      try {
        await total();
      } catch (e) {
        handleError(e);
      }
    });
}
