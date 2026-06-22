/**
 * covenant governance — CovenantGovernance subcommands.
 *
 *   propose  — create a proposal
 *   vote     — submit votes on a proposal
 *   execute  — execute a passed proposal
 *   veto     — veto a proposal (vetoer only)
 *   get      — get proposal details
 *   count    — get proposal count
 */
import { Command } from "commander";
import { type Address, isAddress } from "viem";
import chalk from "chalk";
import { loadAbi, CONTRACTS } from "../config.js";
import {
  readContract,
  writeContract,
  printHeader,
  printField,
  printSuccess,
  shortAddr,
  toDate,
  PROPOSAL_STATUS,
  handleError,
} from "../utils.js";

const ABI = loadAbi("CovenantGovernance");

// ──────────────────────────────────────────────────────────────
// propose
// ──────────────────────────────────────────────────────────────

async function propose(
  target: string,
  callData: string,
  descriptionHash: string,
  votingPeriod: string
): Promise<void> {
  if (!isAddress(target)) throw new Error(`Invalid target address: ${target}`);

  const periodNum = parseInt(votingPeriod, 10);
  if (isNaN(periodNum) || periodNum <= 0) {
    throw new Error("Voting period must be a positive integer (seconds)");
  }

  printHeader("Creating Proposal");
  printField("Target", shortAddr(target));
  printField("Call Data", callData.length > 50 ? callData.slice(0, 50) + "..." : callData);
  printField("Description Hash", descriptionHash);
  printField("Voting Period", `${periodNum} seconds`);

  const result = await writeContract(
    CONTRACTS.CovenantGovernance,
    ABI,
    "propose",
    [
      target as Address,
      callData as `0x${string}`,
      descriptionHash as `0x${string}`,
      BigInt(periodNum),
    ]
  );

  printSuccess(`Proposal created — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// vote
// ──────────────────────────────────────────────────────────────

async function submitVotes(
  proposalId: string,
  forVotes: string,
  againstVotes: string,
  guardianSig: string
): Promise<void> {
  const id = parseInt(proposalId, 10);
  if (isNaN(id) || id < 0) throw new Error("Proposal ID must be a non-negative integer");

  const forNum = parseInt(forVotes, 10);
  const againstNum = parseInt(againstVotes, 10);

  printHeader("Submitting Votes");
  printField("Proposal ID", String(id));
  printField("For Votes", String(forNum));
  printField("Against Votes", String(againstNum));

  const result = await writeContract(
    CONTRACTS.CovenantGovernance,
    ABI,
    "submitVotes",
    [BigInt(id), BigInt(forNum), BigInt(againstNum), guardianSig as `0x${string}`]
  );

  printSuccess(`Votes submitted — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// execute
// ──────────────────────────────────────────────────────────────

async function executeProposal(proposalId: string): Promise<void> {
  const id = parseInt(proposalId, 10);
  if (isNaN(id) || id < 0) throw new Error("Proposal ID must be a non-negative integer");

  printHeader("Executing Proposal");
  printField("Proposal ID", String(id));

  const result = await writeContract(
    CONTRACTS.CovenantGovernance,
    ABI,
    "executeProposal",
    [BigInt(id)]
  );

  printSuccess(`Proposal executed — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// veto
// ──────────────────────────────────────────────────────────────

async function vetoProposal(proposalId: string): Promise<void> {
  const id = parseInt(proposalId, 10);
  if (isNaN(id) || id < 0) throw new Error("Proposal ID must be a non-negative integer");

  printHeader("Vetoing Proposal");
  printField("Proposal ID", String(id));

  const result = await writeContract(
    CONTRACTS.CovenantGovernance,
    ABI,
    "vetoProposal",
    [BigInt(id)]
  );

  printSuccess(`Proposal vetoed — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// get
// ──────────────────────────────────────────────────────────────

async function getProposal(proposalId: string): Promise<void> {
  const id = parseInt(proposalId, 10);
  if (isNaN(id) || id < 0) throw new Error("Proposal ID must be a non-negative integer");

  const data = (await readContract(
    CONTRACTS.CovenantGovernance,
    ABI,
    "getProposal",
    [BigInt(id)]
  )) as any;

  const isTuple = Array.isArray(data);

  printHeader(`Proposal #${id}`);

  if (isTuple) {
    printField("Proposer", data[0] ? shortAddr(data[0]) : "—");
    printField("Target", data[1] ? shortAddr(data[1]) : "—");
    printField("Call Data", data[2] ?? "—");
    printField("Description Hash", data[3] ?? "—");
    printField("Status", PROPOSAL_STATUS[Number(data[4])] ?? `Unknown(${data[4]})`);
    printField("For Votes", String(data[5] ?? 0));
    printField("Against Votes", String(data[6] ?? 0));
    printField("Start Block", String(data[7] ?? "—"));
    printField("End Block", String(data[8] ?? "—"));
  } else {
    printField("Proposer", data.proposer ? shortAddr(data.proposer) : "—");
    printField("Target", data.target ? shortAddr(data.target) : "—");
    printField("Call Data", data.calldata ?? data.callData ?? "—");
    printField("Description Hash", data.descriptionHash ?? "—");
    printField("Status", PROPOSAL_STATUS[Number(data.status)] ?? `Unknown(${data.status})`);
    printField("For Votes", String(data.forVotes ?? 0));
    printField("Against Votes", String(data.againstVotes ?? 0));
    printField("Start Block", String(data.startBlock ?? "—"));
    printField("End Block", String(data.endBlock ?? "—"));
  }
}

// ──────────────────────────────────────────────────────────────
// count
// ──────────────────────────────────────────────────────────────

async function proposalCount(): Promise<void> {
  const count = (await readContract(
    CONTRACTS.CovenantGovernance,
    ABI,
    "proposalCount",
    []
  )) as bigint;

  printHeader("Proposal Count");
  printField("Total", String(count));
}

// ──────────────────────────────────────────────────────────────
// Command registration
// ──────────────────────────────────────────────────────────────

export function registerGovernanceCommand(parent: Command): void {
  const gov = parent
    .command("governance")
    .description("DAO governance operations (CovenantGovernance)");

  gov
    .command("propose")
    .description("Create a governance proposal")
    .requiredOption("--target <addr>", "Target contract address")
    .requiredOption("--calldata <hex>", "Encoded call data (0x...)")
    .requiredOption("--description <hash>", "Description hash (bytes32)")
    .requiredOption("--voting-period <seconds>", "Voting period in seconds")
    .action(async (opts) => {
      try {
        await propose(opts.target, opts.calldata, opts.description, opts.votingPeriod);
      } catch (e) {
        handleError(e);
      }
    });

  gov
    .command("vote <proposalId>")
    .description("Submit votes on a proposal (guardian only)")
    .requiredOption("--for <votes>", "Number of votes in favor")
    .requiredOption("--against <votes>", "Number of votes against")
    .requiredOption("--sig <hash>", "Guardian signature (bytes)")
    .action(async (proposalId, opts) => {
      try {
        await submitVotes(proposalId, opts.for, opts.against, opts.sig);
      } catch (e) {
        handleError(e);
      }
    });

  gov
    .command("execute <proposalId>")
    .description("Execute a passed proposal")
    .action(async (proposalId) => {
      try {
        await executeProposal(proposalId);
      } catch (e) {
        handleError(e);
      }
    });

  gov
    .command("veto <proposalId>")
    .description("Veto a proposal (vetoer only)")
    .action(async (proposalId) => {
      try {
        await vetoProposal(proposalId);
      } catch (e) {
        handleError(e);
      }
    });

  gov
    .command("get <proposalId>")
    .description("Get proposal details")
    .action(async (proposalId) => {
      try {
        await getProposal(proposalId);
      } catch (e) {
        handleError(e);
      }
    });

  gov
    .command("count")
    .description("Get total proposal count")
    .action(async () => {
      try {
        await proposalCount();
      } catch (e) {
        handleError(e);
      }
    });
}
