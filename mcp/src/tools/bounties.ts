/**
 * Bounty Board MCP Tools (In-Memory MVP)
 *
 * post_bounty          — Post a bounty (open challenge with ETH prize)
 * claim_bounty         — Worker claims a bounty by submitting work
 * list_bounties        — List open bounties with optional filters
 * get_bounty           — Get bounty details
 * select_bounty_winner — Creator selects the winning submission
 */
import { z } from "zod";
import { parseEther } from "viem";
import { getAccount } from "../config.js";
import { formatReadResult } from "../handlers/transactions.js";
import { formatSuccess, formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import { loadStore, saveStore } from "../lib/store.js";
import { ethAddress, ethAmount, unixDeadline, ipfsCid } from "../lib/schemaHelpers.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ─── Persisted bounty store ─────────────────────────────────

interface Bounty {
  id: number;
  title: string;
  description: string;
  reward: string; // ETH amount
  creator: string;
  status: "open" | "in_review" | "completed" | "cancelled";
  deadline: number;
  submissions: Map<string, { worker: string; deliverableHash: string; submittedAt: number }>;
  winner?: string;
  createdAt: number;
}

/** Shape stored on disk — submissions as a plain object for JSON serialisation. */
interface BountyPersisted extends Omit<Bounty, "submissions"> {
  submissions: Record<string, { worker: string; deliverableHash: string; submittedAt: number }>;
}

interface BountiesStore {
  counter: number;
  items: Record<number, BountyPersisted>;
}

const bountiesData = loadStore<BountiesStore>("bounties", { counter: 0, items: {} });
let bountyCounter = bountiesData.counter;
const bounties = new Map<number, Bounty>(
  Object.entries(bountiesData.items).map(([k, v]) => [
    Number(k),
    { ...v, submissions: new Map(Object.entries(v.submissions)) },
  ])
);

function persistBounties(): void {
  const items: Record<number, BountyPersisted> = {};
  bounties.forEach((v, k) => {
    const subsObj: Record<string, { worker: string; deliverableHash: string; submittedAt: number }> = {};
    v.submissions.forEach((val, key) => { subsObj[key] = val; });
    items[k] = { ...v, submissions: subsObj };
  });
  saveStore("bounties", { counter: bountyCounter, items });
}

// ─── Validation Schemas ──────────────────────────────────────

const postBountySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  reward: z.string().regex(/^\d+\.?\d*$/, "Invalid ETH amount format")
    .refine(val => {
      const amount = parseFloat(val);
      return amount >= 0.001 && amount <= 1000;
    }, { message: "Reward must be between 0.001 and 1000 ETH" }),
  deadline: z.number().int().positive()
    .refine(val => {
      const deadlineMs = val * 1000;
      const now = Date.now();
      const oneYear = now + (365 * 24 * 60 * 60 * 1000);
      return deadlineMs > now && deadlineMs < oneYear;
    }, { message: "Deadline must be a future timestamp within 1 year" }),
});

const claimBountySchema = z.object({
  bountyId: z.number().int().nonnegative(),
  deliverableHash: z.string().min(1).max(200),
});

// ─── Tool Registration ───────────────────────────────────────

export function registerBountyTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // corven_post_bounty
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_post_bounty",
    {
      title: "Post Bounty",
      description:
        "Posts a bounty — an open challenge with an ETH prize that any worker can attempt.\n" +
        "USE WHEN: You want to crowdsource solutions. You want the best submission rather than a specific worker.\n" +
        "REQUIRES: Wallet configured via PRIVATE_KEY.\n" +
        "RETURNS: Bounty ID, title, reward, deadline, status.\n" +
        "COMES BEFORE: Workers call corven_claim_bounty to submit work. You call corven_select_bounty_winner.",
      inputSchema: {
        title: z.string().describe("Bounty title — short description of the challenge"),
        description: z.string().describe("Full description of what the bounty requires"),
        reward: ethAmount,
        deadline: unixDeadline,
      },
    },
    async ({ title, description, reward, deadline }) => {
      try {
        const validation = postBountySchema.safeParse({ title, description, reward, deadline });
        if (!validation.success) {
          return formatStructuredError(
            `Invalid input: ${validation.error.issues.map(e => e.message).join(", ")}`,
            "Validation failed.",
            "Check parameter formats.",
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

        const id = bountyCounter++;
        const bounty: Bounty = {
          id,
          title,
          description,
          reward,
          creator: account.address,
          status: "open",
          deadline,
          submissions: new Map(),
          createdAt: Math.floor(Date.now() / 1000),
        };
        bounties.set(id, bounty);
        persistBounties();

        return formatSuccess(
          `Bounty #${id} posted successfully.`,
          {
            bountyId: id,
            title,
            reward: `${reward} ETH`,
            deadline,
            status: "open",
            creator: account.address,
          }
        );
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_claim_bounty
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_claim_bounty",
    {
      title: "Claim Bounty",
      description:
        "Submits work to claim a bounty. Each worker can only submit once per bounty.\n" +
        "USE WHEN: You completed work for an open bounty and want to enter your submission.\n" +
        "REQUIRES: Bounty must be open. You cannot submit twice to the same bounty.\n" +
        "RETURNS: Confirmation with bounty ID, your address, and deliverable hash.\n" +
        "COMES AFTER: corven_get_bounty or corven_list_bounties to find bounties.\n" +
        "COMES BEFORE: Creator calls corven_select_bounty_winner to pick the winner.",
      inputSchema: {
        bountyId: z.number().describe("Bounty ID to claim"),
        deliverableHash: ipfsCid,
      },
    },
    async ({ bountyId, deliverableHash }) => {
      try {
        const validation = claimBountySchema.safeParse({ bountyId, deliverableHash });
        if (!validation.success) {
          return formatStructuredError(
            `Invalid input: ${validation.error.issues.map(e => e.message).join(", ")}`,
            "Validation failed.",
            "Check parameter formats.",
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

        const bounty = bounties.get(bountyId);
        if (!bounty) {
          return formatStructuredError(
            `Bounty #${bountyId} not found.`,
            "No bounty exists with that ID.",
            "Call corven_list_bounties to see available bounties.",
            false
          );
        }

        if (bounty.status !== "open") {
          return formatStructuredError(
            `Bounty #${bountyId} is not open (status: ${bounty.status}).`,
            "Only open bounties accept submissions.",
            "Call corven_list_bounties with status='open' to find active bounties.",
            false
          );
        }

        if (bounty.deadline < Math.floor(Date.now() / 1000)) {
          return formatStructuredError(
            `Bounty #${bountyId} deadline has passed.`,
            "The submission deadline has elapsed.",
            "Check the deadline with corven_get_bounty before submitting.",
            false
          );
        }

        const workerAddr = account.address;
        if (bounty.submissions.has(workerAddr)) {
          return formatStructuredError(
            `You have already submitted to Bounty #${bountyId}.`,
            "Each worker can only submit once per bounty.",
            "Your existing submission is recorded. Wait for the creator to select a winner.",
            false
          );
        }

        bounty.submissions.set(workerAddr, {
          worker: workerAddr,
          deliverableHash,
          submittedAt: Math.floor(Date.now() / 1000),
        });
        persistBounties();

        return formatSuccess(
          `Submission recorded for Bounty #${bountyId}.`,
          {
            bountyId,
            worker: workerAddr,
            deliverableHash,
            totalSubmissions: bounty.submissions.size,
          }
        );
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_list_bounties
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_list_bounties",
    {
      title: "List Bounties",
      description:
        "Lists all bounties with optional status and minimum reward filters.\n" +
        "USE WHEN: Finding bounties to work on. Reviewing posted bounties. Checking bounty board activity.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Array of bounty summaries (id, title, reward, status, deadline, submission count).\n" +
        "COMES BEFORE: corven_get_bounty for full details, corven_claim_bounty to submit work.",
      inputSchema: {
        status: z.enum(["open", "in_review", "completed", "cancelled"]).optional()
          .describe("Filter by bounty status. Omit to return all."),
        minReward: z.string().optional()
          .describe('Minimum reward in ETH as decimal string, e.g. "0.01". Omit for no minimum.'),
      },
    },
    async ({ status, minReward }) => {
      try {
        const minRewardWei = minReward ? parseEther(minReward) : 0n;
        const results: Array<{
          id: number;
          title: string;
          reward: string;
          status: string;
          deadline: number;
          submissions: number;
          creator: string;
        }> = [];

        for (const bounty of bounties.values()) {
          if (status && bounty.status !== status) continue;
          if (parseEther(bounty.reward) < minRewardWei) continue;

          results.push({
            id: bounty.id,
            title: bounty.title,
            reward: `${bounty.reward} ETH`,
            status: bounty.status,
            deadline: bounty.deadline,
            submissions: bounty.submissions.size,
            creator: bounty.creator,
          });
        }

        if (results.length === 0) {
          return formatReadResult(
            { count: 0, bounties: [] },
            "No bounties found matching the given filters."
          );
        }

        return formatReadResult(
          { count: results.length, bounties: results },
          `Found ${results.length} bount${results.length === 1 ? "y" : "ies"}.`
        );
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_bounty
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_bounty",
    {
      title: "Get Bounty Details",
      description:
        "Reads full details of a bounty including all submissions.\n" +
        "USE WHEN: Checking a specific bounty before claiming. Reviewing submissions as a creator.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Full bounty details — title, description, reward, status, deadline, creator, all submissions, winner.\n" +
        "COMES AFTER: corven_list_bounties found the bounty ID.\n" +
        "COMES BEFORE: corven_claim_bounty (for workers) or corven_select_bounty_winner (for creator).",
      inputSchema: {
        bountyId: z.number().describe("Bounty ID to look up"),
      },
    },
    async ({ bountyId }) => {
      try {
        const bounty = bounties.get(bountyId);
        if (!bounty) {
          return formatStructuredError(
            `Bounty #${bountyId} not found.`,
            "No bounty exists with that ID.",
            "Call corven_list_bounties to see available bounties.",
            false
          );
        }

        const submissionList = Array.from(bounty.submissions.values()).map(s => ({
          worker: s.worker,
          deliverableHash: s.deliverableHash,
          submittedAt: s.submittedAt,
        }));

        return formatReadResult(
          {
            id: bounty.id,
            title: bounty.title,
            description: bounty.description,
            reward: `${bounty.reward} ETH`,
            creator: bounty.creator,
            status: bounty.status,
            deadline: bounty.deadline,
            submissions: submissionList,
            winner: bounty.winner ?? "none",
            createdAt: bounty.createdAt,
          },
          `Bounty #${bountyId}`
        );
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_select_bounty_winner
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_select_bounty_winner",
    {
      title: "Select Bounty Winner",
      description:
        "The bounty creator selects the winning submission from the pool of claims.\n" +
        "USE WHEN: You reviewed submissions (corven_get_bounty) and want to pick the best one.\n" +
        "REQUIRES: You must be the bounty creator. Bounty must be open. The winner must have submitted.\n" +
        "RETURNS: Bounty ID, winner address, final status.\n" +
        "COMES AFTER: Workers called corven_claim_bounty. Creator reviewed via corven_get_bounty.\n" +
        "NOTE: This marks the bounty as completed. In the full on-chain version this would release escrowed ETH.",
      inputSchema: {
        bountyId: z.number().describe("Bounty ID"),
        winnerAddress: ethAddress,
      },
    },
    async ({ bountyId, winnerAddress }) => {
      try {
        const account = getAccount();
        if (!account) {
          return formatStructuredError(
            "No private key configured.",
            "PRIVATE_KEY not set.",
            "Set PRIVATE_KEY in .env.",
            false
          );
        }

        const bounty = bounties.get(bountyId);
        if (!bounty) {
          return formatStructuredError(
            `Bounty #${bountyId} not found.`,
            "No bounty exists with that ID.",
            "Call corven_list_bounties to see available bounties.",
            false
          );
        }

        if (bounty.creator.toLowerCase() !== account.address.toLowerCase()) {
          return formatStructuredError(
            "Only the bounty creator can select a winner.",
            `This bounty was created by ${bounty.creator}, not ${account.address}.`,
            "Use the wallet that called corven_post_bounty.",
            false
          );
        }

        if (bounty.status !== "open") {
          return formatStructuredError(
            `Bounty #${bountyId} is not open (status: ${bounty.status}).`,
            "Can only select a winner for open bounties.",
            "Check bounty status with corven_get_bounty.",
            false
          );
        }

        if (!bounty.submissions.has(winnerAddress)) {
          return formatStructuredError(
            `Address ${winnerAddress} has not submitted to Bounty #${bountyId}.`,
            "The winner must have called corven_claim_bounty first.",
            "Check submissions with corven_get_bounty.",
            false
          );
        }

        bounty.winner = winnerAddress;
        bounty.status = "completed";
        persistBounties();

        return formatSuccess(
          `Winner selected for Bounty #${bountyId}.`,
          {
            bountyId,
            winner: winnerAddress,
            reward: `${bounty.reward} ETH`,
            status: "completed",
          }
        );
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
