/**
 * COVENANT MCP — Smart Worker Matching
 *
 * corven_match_agents — Multi-factor scoring to find the best agents for a task.
 */
import { z } from "zod";
import { formatEther } from "viem";
import { loadAbi, CONTRACTS } from "../config.js";
import { readContract } from "../handlers/wallet.js";
import { formatReadResult, formatError } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("AgentRegistry");

// Scoring weights
const W_CAPABILITY = 0.30;
const W_SUCCESS_RATE = 0.20;
const W_PRICE = 0.15;
const W_REPUTATION = 0.55;

// Max reputation value on-chain
const MAX_REPUTATION = 1000;

// Input validation
const matchAgentsSchema = z.object({
  capabilities: z
    .array(z.string().min(1).max(50))
    .min(1, "At least one capability is required")
    .max(10, "Maximum 10 capabilities"),
  min_reputation: z
    .number()
    .int()
    .min(0)
    .max(1000)
    .optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(5),
});

interface ScoredAgent {
  address: string;
  name: string;
  reputation: number;
  capabilities: string[];
  tasksCompleted: number;
  tasksFailed: number;
  stakedAmountWei: string;
  stakedAmountEth: string;
  isActive: boolean;
  score: number;
  scoreBreakdown: {
    capabilityMatch: number;
    successRate: number;
    priceCompetitiveness: number;
    reputation: number;
  };
}

/**
 * Compute the capability match ratio: how many of the required caps the agent has.
 */
function capabilityMatchScore(
  agentCaps: string[],
  requiredCaps: string[]
): number {
  if (requiredCaps.length === 0) return 1;
  const agentSet = new Set(agentCaps.map((c) => c.toLowerCase()));
  const matched = requiredCaps.filter((c) => agentSet.has(c.toLowerCase()));
  return matched.length / requiredCaps.length;
}

/**
 * Compute success rate: completed / (completed + failed), clamped to 0-1.
 */
function successRateScore(completed: number, failed: number): number {
  const total = completed + failed;
  if (total === 0) return 0.5; // no history => neutral
  return completed / total;
}

/**
 * Compute price competitiveness using stake as a proxy.
 * Higher stake => agent has more skin in the game => more competitive.
 * Normalized against the max stake found in the candidate pool.
 */
function priceCompetitivenessScore(
  stakeWei: bigint,
  maxStakeWei: bigint
): number {
  if (maxStakeWei === 0n) return 0.5;
  return Number((stakeWei * 10000n) / maxStakeWei) / 10000;
}

/**
 * Normalize reputation to 0-1.
 */
function reputationScore(reputation: number): number {
  return Math.min(reputation / MAX_REPUTATION, 1);
}

export function registerMatchingTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // corven_match_agents
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_match_agents",
    {
      title: "Match Agents to Task",
      description:
        "Finds the best agents for a task using multi-factor scoring across capability match, " +
        "success rate, price competitiveness (stake proxy), and reputation.\n" +
        "USE WHEN: You need to pick the optimal worker for a task. After corven_find_workers " +
        "to get a ranked shortlist. Before corven_create_task or corven_post_open_task.\n" +
        "REQUIRES: Nothing. Free read-only call. No gas cost.\n" +
        "RETURNS: Sorted list of agents with composite scores and per-factor breakdowns.\n" +
        "SCORING: capability_match(30%) + success_rate(20%) + price_competitiveness(15%) + reputation(55%).",
      inputSchema: {
        capabilities: z
          .array(z.string())
          .describe(
            "Required capability tags, e.g. [\"data-analysis\", \"python\"]. " +
            "Agents matching more capabilities score higher."
          ),
        min_reputation: z
          .number()
          .int()
          .min(0)
          .max(1000)
          .optional()
          .describe(
            "Minimum reputation filter (0-1000). Agents below this are excluded. " +
            "Default: no filter."
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe(
            "Max results to return (1-50, default 5)."
          ),
      },
    },
    async ({ capabilities, min_reputation, limit }) => {
      try {
        // Validate input
        const parsed = matchAgentsSchema.safeParse({
          capabilities,
          min_reputation,
          limit,
        });
        if (!parsed.success) {
          return formatStructuredError(
            "Invalid input parameters.",
            parsed.error.issues.map((e: any) => e.message).join("; "),
            "Provide capabilities as a non-empty string array, min_reputation as 0-1000, limit as 1-50.",
            true
          );
        }

        const { capabilities: reqCaps, min_reputation: minRep, limit: maxResults } =
          parsed.data;

        // Fetch all agent addresses
        const addresses = (await readContract(
          CONTRACTS.AgentRegistry,
          ABI,
          "getAgentsPaginated",
          [0, 100]
        )) as string[];

        if (!addresses || addresses.length === 0) {
          return formatReadResult(
            { count: 0, matches: [], query: { capabilities: reqCaps, min_reputation: minRep, limit: maxResults } },
            "No agents registered on the protocol."
          );
        }

        // Fetch all agent profiles in parallel
        const profiles = await Promise.all(
          addresses.map(async (addr: string) => {
            try {
              const agent = (await readContract(
                CONTRACTS.AgentRegistry,
                ABI,
                "getAgent",
                [addr]
              )) as any;
              return { address: addr, ...agent };
            } catch {
              return null; // skip agents that fail to load
            }
          })
        );

        // Filter: must be active and meet min reputation
        const candidates = profiles.filter((a: any) => {
          if (!a) return false;
          const active = a.isActive === 1 || a.isActive === true;
          if (!active) return false;
          if (minRep !== undefined && Number(a.reputation) < minRep) return false;
          return true;
        });

        if (candidates.length === 0) {
          return formatReadResult(
            {
              count: 0,
              matches: [],
              query: { capabilities: reqCaps, min_reputation: minRep, limit: maxResults },
            },
            "No agents match the specified filters."
          );
        }

        // Find max stake for normalization
        let maxStake = 0n;
        for (const a of candidates) {
          const s = BigInt(a.stakedAmount ?? 0);
          if (s > maxStake) maxStake = s;
        }

        // Score each candidate
        const scored: ScoredAgent[] = candidates.map((a: any) => {
          const caps: string[] = a.capabilities ?? [];
          const completed = Number(a.tasksCompleted ?? 0);
          const failed = Number(a.tasksFailed ?? 0);
          const stake = BigInt(a.stakedAmount ?? 0);
          const rep = Number(a.reputation ?? 0);

          const capScore = capabilityMatchScore(caps, reqCaps);
          const srScore = successRateScore(completed, failed);
          const priceScore = priceCompetitivenessScore(stake, maxStake);
          const repScore = reputationScore(rep);

          const total =
            capScore * W_CAPABILITY +
            srScore * W_SUCCESS_RATE +
            priceScore * W_PRICE +
            repScore * W_REPUTATION;

          return {
            address: a.address ?? a.wallet,
            name: a.name ?? "Unknown",
            reputation: rep,
            capabilities: caps,
            tasksCompleted: completed,
            tasksFailed: failed,
            stakedAmountWei: stake.toString(),
            stakedAmountEth: (() => {
              try { return formatEther(stake); } catch { return "0"; }
            })(),
            isActive: true,
            score: Math.round(total * 10000) / 10000,
            scoreBreakdown: {
              capabilityMatch: Math.round(capScore * 10000) / 10000,
              successRate: Math.round(srScore * 10000) / 10000,
              priceCompetitiveness: Math.round(priceScore * 10000) / 10000,
              reputation: Math.round(repScore * 10000) / 10000,
            },
          };
        });

        // Sort by score descending, then by reputation as tiebreaker
        scored.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return b.reputation - a.reputation;
        });

        // Apply limit
        const top = scored.slice(0, maxResults);

        return formatReadResult(
          {
            count: top.length,
            totalCandidates: candidates.length,
            query: {
              capabilities: reqCaps,
              min_reputation: minRep ?? null,
              limit: maxResults,
            },
            weights: {
              capabilityMatch: W_CAPABILITY,
              successRate: W_SUCCESS_RATE,
              priceCompetitiveness: W_PRICE,
              reputation: W_REPUTATION,
            },
            matches: top,
          },
          `Top ${top.length} agent matches for [${reqCaps.join(", ")}]`
        );
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
