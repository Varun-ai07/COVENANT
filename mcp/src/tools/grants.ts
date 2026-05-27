/**
 * Grant Program MCP Tools (In-Memory MVP)
 *
 * apply_grant   — Submit a grant application
 * list_grants   — List grant applications with status filter
 * get_grant     — Get grant application details
 * vote_grant    — Vote on a grant application (reputation-weighted)
 */
import { z } from "zod";
import { type Address } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { readContract } from "../handlers/wallet.js";
import { formatReadResult, formatError } from "../handlers/transactions.js";
import { formatSuccess, formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import { ethAmount } from "../lib/schemaHelpers.js";
import { loadStore, saveStore } from "../lib/store.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ─── Persisted grant store ─────────────────────────────────

interface Grant {
  id: number;
  title: string;
  description: string;
  applicant: string;
  category: "ecosystem_growth" | "research" | "community" | "security";
  amountRequested: string; // ETH
  status: "pending" | "approved" | "rejected" | "funded";
  votesFor: number;
  votesAgainst: number;
  voters: Record<string, { support: boolean; weight: number }>;
  createdAt: number;
}

interface GrantsStore {
  counter: number;
  items: Record<number, Grant>;
}

const grantsData = loadStore<GrantsStore>("grants", { counter: 0, items: {} });
let grantCounter = grantsData.counter;
const grants = new Map<number, Grant>(
  Object.entries(grantsData.items).map(([k, v]) => [Number(k), v])
);

function persist(): void {
  const items: Record<number, Grant> = {};
  grants.forEach((v, k) => { items[k] = v; });
  saveStore("grants", { counter: grantCounter, items });
}

// ─── ABI for reading agent reputation ───────────────────────

const REGISTRY_ABI = loadAbi("AgentRegistry");

async function getAgentReputation(address: string): Promise<number> {
  try {
    const profile = await readContract(
      CONTRACTS.AgentRegistry,
      REGISTRY_ABI,
      "getAgent",
      [address as Address]
    );
    return Number((profile as any).reputation ?? 0);
  } catch {
    return 0;
  }
}

// ─── Validation Schemas ──────────────────────────────────────

const applyGrantSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  category: z.enum(["ecosystem_growth", "research", "community", "security"]),
  amountRequested: z.string().regex(/^\d+\.?\d*$/, "Invalid ETH amount format")
    .refine(val => {
      const amount = parseFloat(val);
      return amount > 0 && amount <= 10000;
    }, { message: "Amount must be between 0 and 10,000 ETH" }),
});

const voteGrantSchema = z.object({
  grantId: z.number().int().nonnegative(),
  support: z.boolean(),
});

// ─── Tool Registration ───────────────────────────────────────

export function registerGrantTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // corven_apply_grant
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_apply_grant",
    {
      title: "Apply for Grant",
      description:
        "Submits a grant application to the COVENANT grant program.\n" +
        "USE WHEN: You need funding for ecosystem growth, research, community, or security work related to COVENANT.\n" +
        "REQUIRES: Wallet configured via PRIVATE_KEY. Must be a registered agent.\n" +
        "RETURNS: Grant ID, title, category, amount requested, status (pending), applicant address.\n" +
        "COMES BEFORE: Community members call corven_vote_grant to vote. Approved grants move to 'funded' status.\n" +
        "CATEGORIES: ecosystem_growth (tooling, integrations), research (protocols, cryptography), community (education, events), security (audits, monitoring).",
      inputSchema: {
        title: z.string().describe("Short title for the grant proposal"),
        description: z.string().describe("Detailed description of what the grant will fund and expected outcomes"),
        category: z.enum(["ecosystem_growth", "research", "community", "security"])
          .describe("Grant category: ecosystem_growth, research, community, or security"),
        amountRequested: ethAmount,
      },
    },
    async ({ title, description, category, amountRequested }) => {
      try {
        const validation = applyGrantSchema.safeParse({ title, description, category, amountRequested });
        if (!validation.success) {
          return formatStructuredError(
            `Invalid input: ${validation.error.issues.map(e => e.message).join(", ")}`,
            "Validation failed.",
            "Check parameter formats: title (1-200 chars), description (1-2000 chars), category (enum), amountRequested (ETH decimal string).",
            false
          );
        }

        const account = getAccount();
        if (!account) {
          return formatStructuredError(
            "No private key configured.",
            "PRIVATE_KEY not set.",
            "Set PRIVATE_KEY in .env.",
            false
          );
        }

        const id = grantCounter++;
        const grant: Grant = {
          id,
          title,
          description,
          applicant: account.address,
          category,
          amountRequested,
          status: "pending",
          votesFor: 0,
          votesAgainst: 0,
          voters: {},
          createdAt: Math.floor(Date.now() / 1000),
        };
        grants.set(id, grant);
        persist();

        return formatSuccess(
          `Grant #${id} application submitted successfully.`,
          {
            grantId: id,
            title,
            category,
            amountRequested: `${amountRequested} ETH`,
            status: "pending",
            applicant: account.address,
          },
          undefined,
          [
            "Your application is now pending community review.",
            "Use corven_list_grants to track status. Community members vote via corven_vote_grant.",
          ]
        );
      } catch (e) {
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_list_grants
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_list_grants",
    {
      title: "List Grants",
      description:
        "Lists all grant applications with optional status filter.\n" +
        "USE WHEN: Reviewing pending grants to vote on. Checking grant program activity. Tracking your own applications.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Array of grant summaries (id, title, category, amount, status, votes, applicant).\n" +
        "COMES BEFORE: corven_get_grant for full details, corven_vote_grant to cast a vote.",
      inputSchema: {
        status: z.enum(["pending", "approved", "rejected", "funded"]).optional()
          .describe("Filter by grant status. Omit to return all grants."),
      },
    },
    async ({ status }) => {
      try {
        const results: Array<{
          id: number;
          title: string;
          category: string;
          amountRequested: string;
          status: string;
          votesFor: number;
          votesAgainst: number;
          applicant: string;
        }> = [];

        for (const grant of grants.values()) {
          if (status && grant.status !== status) continue;

          results.push({
            id: grant.id,
            title: grant.title,
            category: grant.category,
            amountRequested: `${grant.amountRequested} ETH`,
            status: grant.status,
            votesFor: grant.votesFor,
            votesAgainst: grant.votesAgainst,
            applicant: grant.applicant,
          });
        }

        if (results.length === 0) {
          return formatReadResult(
            { count: 0, grants: [] },
            status
              ? `No grants found with status "${status}".`
              : "No grant applications found."
          );
        }

        return formatReadResult(
          { count: results.length, grants: results },
          `Found ${results.length} grant application${results.length === 1 ? "" : "s"}.`
        );
      } catch (e) {
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_grant
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_grant",
    {
      title: "Get Grant Details",
      description:
        "Reads full details of a grant application including all votes.\n" +
        "USE WHEN: Reviewing a specific grant before voting. Checking vote counts and voter details.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Full grant details — title, description, category, amount, status, applicant, votes, individual voter records.\n" +
        "COMES AFTER: corven_list_grants found the grant ID.\n" +
        "COMES BEFORE: corven_vote_grant to cast your vote.",
      inputSchema: {
        grantId: z.number().describe("Grant application ID to look up"),
      },
    },
    async ({ grantId }) => {
      try {
        const grant = grants.get(grantId);
        if (!grant) {
          return formatStructuredError(
            `Grant #${grantId} not found.`,
            "No grant application exists with that ID.",
            "Call corven_list_grants to see available grants.",
            false
          );
        }

        const voterList = Object.entries(grant.voters).map(([addr, v]) => ({
          address: addr,
          support: v.support,
          weight: v.weight,
        }));

        return formatReadResult(
          {
            id: grant.id,
            title: grant.title,
            description: grant.description,
            applicant: grant.applicant,
            category: grant.category,
            amountRequested: `${grant.amountRequested} ETH`,
            status: grant.status,
            votesFor: grant.votesFor,
            votesAgainst: grant.votesAgainst,
            totalVoters: voterList.length,
            voters: voterList,
            createdAt: grant.createdAt,
          },
          `Grant #${grantId}`
        );
      } catch (e) {
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_vote_grant
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_vote_grant",
    {
      title: "Vote on Grant",
      description:
        "Casts a reputation-weighted vote on a grant application. Your vote weight equals your agent's reputation score (0-1000).\n" +
        "USE WHEN: Reviewing and voting on pending grant applications as a community member.\n" +
        "REQUIRES: Wallet configured via PRIVATE_KEY. Must be a registered agent with reputation > 0.\n" +
        "RETURNS: Grant ID, your vote (support/oppose), your reputation weight, updated vote totals.\n" +
        "COMES AFTER: corven_list_grants or corven_get_grant to review the application.\n" +
        "NOTE: Each address can only vote once per grant. You cannot vote on your own application. Vote weight is your current on-chain reputation.",
      inputSchema: {
        grantId: z.number().describe("Grant application ID to vote on"),
        support: z.boolean().describe("true = vote in favor (approve), false = vote against (reject)"),
      },
    },
    async ({ grantId, support }) => {
      try {
        const validation = voteGrantSchema.safeParse({ grantId, support });
        if (!validation.success) {
          return formatStructuredError(
            `Invalid input: ${validation.error.issues.map(e => e.message).join(", ")}`,
            "Validation failed.",
            "Check grantId (non-negative integer) and support (boolean).",
            false
          );
        }

        const account = getAccount();
        if (!account) {
          return formatStructuredError(
            "No private key configured.",
            "PRIVATE_KEY not set.",
            "Set PRIVATE_KEY in .env.",
            false
          );
        }

        const grant = grants.get(grantId);
        if (!grant) {
          return formatStructuredError(
            `Grant #${grantId} not found.`,
            "No grant application exists with that ID.",
            "Call corven_list_grants to see available grants.",
            false
          );
        }

        if (grant.status !== "pending") {
          return formatStructuredError(
            `Grant #${grantId} is not pending (status: ${grant.status}).`,
            "Only pending grants can receive votes.",
            "Call corven_list_grants with status='pending' to find votable grants.",
            false
          );
        }

        const voterAddr = account.address;

        if (grant.applicant.toLowerCase() === voterAddr.toLowerCase()) {
          return formatStructuredError(
            "Cannot vote on your own grant application.",
            `This grant was created by ${grant.applicant}.`,
            "Only other community members can vote on a grant.",
            false
          );
        }

        if (grant.voters[voterAddr]) {
          return formatStructuredError(
            `You have already voted on Grant #${grantId}.`,
            "Each address can only vote once per grant.",
            "Your existing vote is recorded. Check corven_get_grant for current totals.",
            false
          );
        }

        const weight = await getAgentReputation(voterAddr);
        if (weight <= 0) {
          return formatStructuredError(
            "Agent has no reputation for voting.",
            `Address ${voterAddr} is not registered or has 0 reputation.`,
            "Register as an agent first with corven_register_agent.",
            false
          );
        }

        grant.voters[voterAddr] = { support, weight };
        if (support) {
          grant.votesFor += weight;
        } else {
          grant.votesAgainst += weight;
        }
        persist();

        return formatSuccess(
          `Vote recorded for Grant #${grantId}.`,
          {
            grantId,
            voter: voterAddr,
            support,
            weight,
            votesFor: grant.votesFor,
            votesAgainst: grant.votesAgainst,
            totalVoters: Object.keys(grant.voters).length,
          },
          undefined,
          [
            support
              ? `You voted in favor with weight ${weight} (your reputation).`
              : `You voted against with weight ${weight} (your reputation).`,
            `Grant #${grantId} now has ${grant.votesFor} for / ${grant.votesAgainst} against.`,
          ]
        );
      } catch (e) {
        return formatError(e);
      }
    }
  );
}
