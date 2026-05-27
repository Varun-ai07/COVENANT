/**
 * Governance DAO MCP Tools (in-memory MVP)
 *
 * create_proposal  — Create a governance proposal
 * vote_proposal    — Vote on a proposal (token-weighted by reputation)
 * get_proposal     — Get proposal details
 * list_proposals   — List all proposals with optional status filter
 */
import { z } from "zod";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { readContract } from "../handlers/wallet.js";
import { formatReadResult, formatError } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import { loadStore, saveStore } from "../lib/store.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Address } from "viem";

// ─── Persisted proposal store ────────────────────────────────

interface Proposal {
  id: number;
  title: string;
  description: string;
  proposer: string;
  proposalType: "parameter_change" | "feature_addition" | "treasury_spend" | "emergency_action";
  status: "active" | "passed" | "rejected" | "executed";
  votesFor: number;
  votesAgainst: number;
  quorum: number;
  createdAt: number;
  votingEndsAt: number;
  voters: Map<string, { support: boolean; weight: number }>;
}

/** Shape stored on disk — voters as a plain object for JSON serialisation. */
interface ProposalPersisted extends Omit<Proposal, "voters"> {
  voters: Record<string, { support: boolean; weight: number }>;
}

interface GovernanceStore {
  counter: number;
  items: Record<number, ProposalPersisted>;
}

const governanceData = loadStore<GovernanceStore>("governance", { counter: 0, items: {} });
let proposalCounter = governanceData.counter;
const proposals = new Map<number, Proposal>(
  Object.entries(governanceData.items).map(([k, v]) => [
    Number(k),
    { ...v, voters: new Map(Object.entries(v.voters)) },
  ])
);

function persistProposals(): void {
  const items: Record<number, ProposalPersisted> = {};
  proposals.forEach((v, k) => {
    const votersObj: Record<string, { support: boolean; weight: number }> = {};
    v.voters.forEach((val, key) => { votersObj[key] = val; });
    items[k] = { ...v, voters: votersObj };
  });
  saveStore("governance", { counter: proposalCounter, items });
}

// ─── Input schemas ───────────────────────────────────────────

const PROPOSAL_TYPES = ["parameter_change", "feature_addition", "treasury_spend", "emergency_action"] as const;

const createProposalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(10000),
  proposalType: z.enum(PROPOSAL_TYPES),
  votingPeriodDays: z.number().int().min(1).max(30).default(3),
});

const voteProposalSchema = z.object({
  proposalId: z.number().int().positive(),
  support: z.boolean(),
});

// ─── Helpers ─────────────────────────────────────────────────

const AGENT_REGISTRY_ABI = loadAbi("AgentRegistry");

async function getAgentReputation(address: string): Promise<number> {
  try {
    const data = await readContract(
      CONTRACTS.AgentRegistry,
      AGENT_REGISTRY_ABI,
      "getAgent",
      [address as Address]
    );
    return Number((data as any).reputation ?? 0);
  } catch {
    return 0;
  }
}

function proposalToResponse(p: Proposal) {
  const now = Math.floor(Date.now() / 1000);
  const timeRemaining = p.votingEndsAt > now ? p.votingEndsAt - now : 0;
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    proposer: p.proposer,
    proposalType: p.proposalType,
    status: p.status,
    votesFor: p.votesFor,
    votesAgainst: p.votesAgainst,
    quorum: p.quorum,
    totalVotes: p.votesFor + p.votesAgainst,
    voterCount: p.voters.size,
    createdAt: p.createdAt,
    votingEndsAt: p.votingEndsAt,
    timeRemainingSeconds: timeRemaining,
    timeRemainingHuman: timeRemaining > 0
      ? `${Math.floor(timeRemaining / 86400)}d ${Math.floor((timeRemaining % 86400) / 3600)}h`
      : "Voting ended",
  };
}

// ─── Registration ────────────────────────────────────────────

export function registerGovernanceTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // corven_create_proposal
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_create_proposal",
    {
      title: "Create Proposal",
      description:
        "Create a governance proposal for the COVENANT protocol.\n" +
        "USE WHEN: Proposing a parameter change, new feature, treasury spend, or emergency action.\n" +
        "REQUIRES: PRIVATE_KEY must be set. Proposer must be a registered agent.\n" +
        "RETURNS: Proposal ID, title, type, voting end timestamp, and status.\n" +
        "COMES BEFORE: corven_vote_proposal (others vote on your proposal), corven_get_proposal (check results).\n" +
        "NOTE: In-memory MVP — proposals exist for the MCP server session lifetime. Voting period defaults to 3 days.",
      inputSchema: {
        title: z.string().describe("Proposal title (max 200 characters)"),
        description: z.string().describe("Detailed proposal description (max 10,000 characters)"),
        proposalType: z.enum(PROPOSAL_TYPES).describe("Proposal type: parameter_change, feature_addition, treasury_spend, or emergency_action"),
        votingPeriodDays: z.number().int().min(1).max(30).default(3).describe("Voting period in days (1-30, default 3)"),
      },
    },
    async ({ title, description, proposalType, votingPeriodDays }) => {
      try {
        const validation = createProposalSchema.safeParse({ title, description, proposalType, votingPeriodDays });
        if (!validation.success) {
          return formatError(new Error(`Invalid input: ${validation.error.issues.map(e => e.message).join(", ")}`));
        }

        const account = getAccount();
        if (!account) {
          return formatStructuredError(
            "No private key configured.",
            "PRIVATE_KEY environment variable is not set.",
            "Set PRIVATE_KEY in your .env file.",
            false
          );
        }

        const proposer = (typeof account === "string" ? account : account.address).toLowerCase();
        const id = ++proposalCounter;
        const now = Math.floor(Date.now() / 1000);

        const proposal: Proposal = {
          id,
          title: validation.data.title,
          description: validation.data.description,
          proposer,
          proposalType: validation.data.proposalType,
          status: "active",
          votesFor: 0,
          votesAgainst: 0,
          quorum: 100,
          createdAt: now,
          votingEndsAt: now + validation.data.votingPeriodDays * 86400,
          voters: new Map(),
        };

        proposals.set(id, proposal);
        persistProposals();

        return formatReadResult(
          proposalToResponse(proposal),
          `Proposal #${id} created`
        );
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_vote_proposal
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_vote_proposal",
    {
      title: "Vote on Proposal",
      description:
        "Cast a vote on a governance proposal. Vote weight is based on your on-chain reputation.\n" +
        "USE WHEN: You want to vote for or against an active proposal.\n" +
        "REQUIRES: PRIVATE_KEY must be set. You must be a registered agent. Proposal must be active.\n" +
        "RETURNS: Vote confirmation with your weight and updated vote tallies.\n" +
        "COMES AFTER: corven_create_proposal created the proposal.\n" +
        "COMES BEFORE: corven_get_proposal to check final results after voting ends.\n" +
        "NOTE: Each address can only vote once per proposal. Weight = your reputation score (0-1000).",
      inputSchema: {
        proposalId: z.number().describe("Proposal ID to vote on"),
        support: z.boolean().describe("True to vote in favor, false to vote against"),
      },
    },
    async ({ proposalId, support }) => {
      try {
        const validation = voteProposalSchema.safeParse({ proposalId, support });
        if (!validation.success) {
          return formatError(new Error(`Invalid input: ${validation.error.issues.map(e => e.message).join(", ")}`));
        }

        const account = getAccount();
        if (!account) {
          return formatStructuredError(
            "No private key configured.",
            "PRIVATE_KEY environment variable is not set.",
            "Set PRIVATE_KEY in your .env file.",
            false
          );
        }

        const voter = (typeof account === "string" ? account : account.address).toLowerCase();
        const proposal = proposals.get(proposalId);

        if (!proposal) {
          return formatError(new Error(`Proposal #${proposalId} not found.`));
        }

        if (proposal.status !== "active") {
          return formatError(new Error(`Proposal #${proposalId} is not active (status: ${proposal.status}).`));
        }

        const now = Math.floor(Date.now() / 1000);
        if (now > proposal.votingEndsAt) {
          proposal.status = proposal.votesFor > proposal.votesAgainst ? "passed" : "rejected";
          return formatError(new Error(`Voting period for Proposal #${proposalId} has ended. Status: ${proposal.status}.`));
        }

        if (proposal.voters.has(voter)) {
          return formatError(new Error(`You have already voted on Proposal #${proposalId}.`));
        }

        const weight = await getAgentReputation(voter);

        proposal.voters.set(voter, { support, weight });
        if (support) {
          proposal.votesFor += weight;
        } else {
          proposal.votesAgainst += weight;
        }
        persistProposals();

        return formatReadResult(
          {
            proposalId,
            voter,
            support,
            weight,
            votesFor: proposal.votesFor,
            votesAgainst: proposal.votesAgainst,
            totalVotes: proposal.votesFor + proposal.votesAgainst,
            voterCount: proposal.voters.size,
          },
          `Vote recorded on Proposal #${proposalId}`
        );
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_proposal
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_proposal",
    {
      title: "Get Proposal",
      description:
        "Get full details of a governance proposal including vote counts and time remaining.\n" +
        "USE WHEN: Checking the status and results of a specific proposal.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Full proposal details — title, description, type, status, votes for/against, voter count, time remaining.\n" +
        "COMES AFTER: corven_create_proposal created the proposal.",
      inputSchema: {
        proposalId: z.number().describe("Proposal ID to look up"),
      },
    },
    async ({ proposalId }) => {
      try {
        const proposal = proposals.get(proposalId);
        if (!proposal) {
          return formatError(new Error(`Proposal #${proposalId} not found.`));
        }

        // Auto-update status if voting period has ended
        if (proposal.status === "active") {
          const now = Math.floor(Date.now() / 1000);
          if (now > proposal.votingEndsAt) {
            proposal.status = proposal.votesFor > proposal.votesAgainst ? "passed" : "rejected";
          }
        }

        return formatReadResult(
          proposalToResponse(proposal),
          `Proposal #${proposalId}`
        );
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_list_proposals
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_list_proposals",
    {
      title: "List Proposals",
      description:
        "List all governance proposals, optionally filtered by status.\n" +
        "USE WHEN: Browsing proposals, finding active votes, or reviewing past decisions.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Array of proposal summaries with ID, title, type, status, vote counts, and time remaining.\n" +
        "NOTE: If no status filter is provided, returns all proposals sorted by newest first.",
      inputSchema: {
        status: z.enum(["active", "passed", "rejected", "executed"]).optional().describe("Filter by proposal status (omit for all)"),
      },
    },
    async ({ status }) => {
      try {
        // Auto-update statuses of active proposals
        const now = Math.floor(Date.now() / 1000);
        for (const p of proposals.values()) {
          if (p.status === "active" && now > p.votingEndsAt) {
            p.status = p.votesFor > p.votesAgainst ? "passed" : "rejected";
          }
        }

        let list = Array.from(proposals.values());
        if (status) {
          list = list.filter((p) => p.status === status);
        }

        // Sort newest first
        list.sort((a, b) => b.createdAt - a.createdAt);

        return formatReadResult(
          {
            count: list.length,
            filter: status ?? "all",
            proposals: list.map(proposalToResponse),
          },
          status ? `${list.length} ${status} proposals` : `${list.length} total proposals`
        );
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
