/**
 * covenant collectives — AgentCollective subcommands.
 *
 *   create — create a new collective
 *   join   — join an existing collective
 *   get    — get collective details
 */
import { Command } from "commander";
import { parseEther, type Address } from "viem";
import chalk from "chalk";
import { loadAbi, CONTRACTS } from "../config.js";
import {
  readContract,
  writeContract,
  preWriteGuard,
  printHeader,
  printField,
  printSuccess,
  shortAddr,
  toEth,
  toDate,
  handleError,
} from "../utils.js";

const ABI = loadAbi("AgentCollective");

// ──────────────────────────────────────────────────────────────
// create
// ──────────────────────────────────────────────────────────────

async function create(
  minContribution: string,
  maxMembers: string
): Promise<void> {
  const contributionWei = parseEther(minContribution);
  const max = parseInt(maxMembers, 10);
  if (isNaN(max) || max < 2 || max > 100) {
    throw new Error("Max members must be between 2 and 100");
  }

  await preWriteGuard(
    `Create collective with min contribution ${minContribution} ETH, max ${max} members.`,
    minContribution
  );

  printHeader("Creating Collective");
  printField("Min Contribution", `${minContribution} ETH`);
  printField("Max Members", String(max));

  const result = await writeContract(
    CONTRACTS.AgentCollective,
    ABI,
    "createCollective",
    [contributionWei, BigInt(max)],
    contributionWei
  );

  printSuccess(`Collective created — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// join
// ──────────────────────────────────────────────────────────────

async function join(collectiveId: string, contribution: string): Promise<void> {
  const id = parseInt(collectiveId, 10);
  if (isNaN(id) || id < 0)
    throw new Error("Collective ID must be a non-negative integer");

  const contributionWei = parseEther(contribution);

  await preWriteGuard(
    `Join collective #${id} with ${contribution} ETH contribution.`,
    contribution
  );

  printHeader("Joining Collective");
  printField("Collective ID", String(id));
  printField("Contribution", `${contribution} ETH`);

  const result = await writeContract(
    CONTRACTS.AgentCollective,
    ABI,
    "joinCollective",
    [BigInt(id)],
    contributionWei
  );

  printSuccess(`Joined collective — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// get
// ──────────────────────────────────────────────────────────────

async function get(collectiveId: string): Promise<void> {
  const id = parseInt(collectiveId, 10);
  if (isNaN(id) || id < 0)
    throw new Error("Collective ID must be a non-negative integer");

  const data = (await readContract(
    CONTRACTS.AgentCollective,
    ABI,
    "getCollective",
    [BigInt(id)]
  )) as any;

  const isTuple = Array.isArray(data);
  const creator = isTuple ? data[0] : data.creator;
  const minContribution = isTuple ? data[1] : data.minContribution;
  const maxMembers = isTuple ? data[2] : data.maxMembers;
  const members = isTuple ? data[3] : data.members;
  const treasury = isTuple ? data[4] : data.treasury;

  printHeader(`Collective #${id}`);
  printField("Creator", creator ? shortAddr(creator) : "—");
  printField("Min Contribution", toEth(minContribution));
  printField("Max Members", String(maxMembers ?? "—"));
  printField(
    "Members",
    Array.isArray(members) ? String(members.length) : "—"
  );
  printField("Treasury", toEth(treasury));

  if (Array.isArray(members) && members.length > 0) {
    console.log(chalk.gray("  Members:"));
    for (const m of members) {
      console.log(chalk.gray(`    ${m}`));
    }
  }
}

// ──────────────────────────────────────────────────────────────
// Command registration
// ──────────────────────────────────────────────────────────────

export function registerCollectivesCommand(parent: Command): void {
  const collectives = parent
    .command("collectives")
    .description("Agent collective operations");

  collectives
    .command("create")
    .description("Create a new collective")
    .requiredOption(
      "--min-contribution <eth>",
      "Minimum contribution in ETH to join"
    )
    .requiredOption(
      "--max-members <n>",
      "Maximum number of members (2-100)"
    )
    .action(async (opts) => {
      try {
        await create(opts.minContribution, opts.maxMembers);
      } catch (e) {
        handleError(e);
      }
    });

  collectives
    .command("join <collectiveId>")
    .description("Join an existing collective")
    .requiredOption(
      "--contribution <eth>",
      "Contribution amount in ETH"
    )
    .action(async (collectiveId, opts) => {
      try {
        await join(collectiveId, opts.contribution);
      } catch (e) {
        handleError(e);
      }
    });

  collectives
    .command("get <collectiveId>")
    .description("Get collective details")
    .action(async (collectiveId) => {
      try {
        await get(collectiveId);
      } catch (e) {
        handleError(e);
      }
    });
}
