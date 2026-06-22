/**
 * covenant insurance — InsurancePool subcommands (V5).
 *
 *   join       — join the insurance pool
 *   file-claim — file an insurance claim
 *   vote       — vote on a claim
 *   approve    — approve a claim
 *   balance    — get pool balance
 *   count      — get claim count
 */
import { Command } from "commander";
import { parseEther, type Address } from "viem";
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
  CLAIM_STATUS,
  handleError,
} from "../utils.js";

const ABI = loadAbi("InsurancePool");

// ──────────────────────────────────────────────────────────────
// join
// ──────────────────────────────────────────────────────────────

async function join(contribution: string): Promise<void> {
  const contributionWei = parseEther(contribution);

  await preWriteGuard(
    `Join insurance pool with ${contribution} ETH contribution.`,
    contribution
  );

  printHeader("Joining Insurance Pool");
  printField("Contribution", `${contribution} ETH`);

  const result = await writeContract(
    CONTRACTS.InsurancePool,
    ABI,
    "joinPool",
    [],
    contributionWei
  );

  printSuccess(`Joined insurance pool — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// file claim (V5 function name)
// ──────────────────────────────────────────────────────────────

async function fileClaim(taskId: string): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");

  await preWriteGuard(
    `File insurance claim for task #${id}.`,
    "0"
  );

  printHeader("Filing Insurance Claim");
  printField("Task ID", String(id));

  const result = await writeContract(
    CONTRACTS.InsurancePool,
    ABI,
    "fileClaim",
    [BigInt(id)]
  );

  printSuccess(`Claim filed — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// vote on claim (V5 function name)
// ──────────────────────────────────────────────────────────────

async function voteOnClaim(claimId: string, inFavor: string): Promise<void> {
  const id = parseInt(claimId, 10);
  if (isNaN(id) || id < 0) throw new Error("Claim ID must be a non-negative integer");

  const favor = inFavor.toLowerCase() === "true" || inFavor === "1";

  await preWriteGuard(
    `Vote on claim #${id} (${favor ? "approve" : "reject"}).`,
    "0"
  );

  printHeader("Voting on Claim");
  printField("Claim ID", String(id));
  printField("In Favor", favor ? "Yes" : "No");

  const result = await writeContract(
    CONTRACTS.InsurancePool,
    ABI,
    "voteOnClaim",
    [BigInt(id), favor]
  );

  printSuccess(`Vote cast — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// approve claim (V5 function name)
// ──────────────────────────────────────────────────────────────

async function approveClaim(claimId: string): Promise<void> {
  const id = parseInt(claimId, 10);
  if (isNaN(id) || id < 0) throw new Error("Claim ID must be a non-negative integer");

  await preWriteGuard(
    `Approve claim #${id} and release payment.`,
    "0"
  );

  printHeader("Approving Claim");
  printField("Claim ID", String(id));

  const result = await writeContract(
    CONTRACTS.InsurancePool,
    ABI,
    "approveClaim",
    [BigInt(id)]
  );

  printSuccess(`Claim approved — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// balance
// ──────────────────────────────────────────────────────────────

async function balance(): Promise<void> {
  const data = await readContract(
    CONTRACTS.InsurancePool,
    ABI,
    "getPoolBalance",
    []
  );

  printHeader("Insurance Pool Balance");
  printField("Balance", toEth(data as bigint));
}

// ──────────────────────────────────────────────────────────────
// count
// ──────────────────────────────────────────────────────────────

async function claimCount(): Promise<void> {
  const count = (await readContract(
    CONTRACTS.InsurancePool,
    ABI,
    "claimCount",
    []
  )) as bigint;

  printHeader("Insurance Claim Count");
  printField("Total", String(count));
}

// ──────────────────────────────────────────────────────────────
// Command registration
// ──────────────────────────────────────────────────────────────

export function registerInsuranceCommand(parent: Command): void {
  const insurance = parent
    .command("insurance")
    .description("Agent insurance pool operations (InsurancePool — V5)");

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
    .command("file-claim <taskId>")
    .description("File an insurance claim for a failed task")
    .action(async (taskId) => {
      try {
        await fileClaim(taskId);
      } catch (e) {
        handleError(e);
      }
    });

  insurance
    .command("vote <claimId>")
    .description("Vote on an insurance claim")
    .requiredOption("--for <bool>", "true to approve, false to reject")
    .action(async (claimId, opts) => {
      try {
        await voteOnClaim(claimId, opts.for);
      } catch (e) {
        handleError(e);
      }
    });

  insurance
    .command("approve <claimId>")
    .description("Approve a claim and release payment")
    .action(async (claimId) => {
      try {
        await approveClaim(claimId);
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

  insurance
    .command("count")
    .description("Get total claim count")
    .action(async () => {
      try {
        await claimCount();
      } catch (e) {
        handleError(e);
      }
    });
}
