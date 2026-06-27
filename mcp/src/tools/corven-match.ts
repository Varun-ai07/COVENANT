/**
 * corven_match — Smart Worker Matching MCP Tool
 *
 * Multi-factor scoring algorithm to find the best workers for tasks.
 */
import { z } from "zod";
import { formatEther } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { parseContractError, formatStructuredError } from "../lib/formatResponse.js";
import { loadStore } from "../lib/store.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("AgentRegistry");

interface AgentProfile {
  address: string;
  name: string;
  capabilities: string[];
  registeredAt: number;
  lastSeen: number;
  reputation?: number;
  bio?: string;
}

const agentProfiles = loadStore<Record<string, AgentProfile>>('agent_profiles', {});

// Scoring weights
const W_CAPABILITY = 0.30;
const W_SUCCESS_RATE = 0.20;
const W_PRICE = 0.15;
const W_REPUTATION = 0.55;
const MAX_REPUTATION = 1000;

// ─── Helpers ─────────────────────────────────────────────────

function capabilityMatchScore(agentCaps: string[], requiredCaps: string[]): number {
  if (requiredCaps.length === 0) return 1;
  const agentSet = new Set(agentCaps.map((c) => c.toLowerCase()));
  const matched = requiredCaps.filter((c) => agentSet.has(c.toLowerCase()));
  return matched.length / requiredCaps.length;
}

function successRateScore(completed: number, failed: number): number {
  const total = completed + failed;
  if (total === 0) return 0.5;
  return completed / total;
}

function priceCompetitivenessScore(stakeWei: bigint, maxStakeWei: bigint): number {
  if (maxStakeWei === 0n) return 0.5;
  return Number((stakeWei * 10000n) / maxStakeWei) / 10000;
}

function reputationScore(reputation: number): number {
  return Math.min(reputation / MAX_REPUTATION, 1);
}

// ─── Input Schemas ───────────────────────────────────────────

const findSchema = z.object({
  minReputation: z.number().int().min(0).max(1000).optional().describe("Minimum reputation filter"),
  limit: z.number().int().min(1).max(50).optional().default(5).describe("Max results (1-50)"),
});

const matchSchema = z.object({
  workerAddress: z.string().describe("Worker address to match against"),
  capabilities: z.array(z.string()).min(1).describe("Required capabilities for the task"),
});

interface ScoredAgent {
  address: string;
  name: string;
  reputation: number;
  capabilities: string[];
  tasksCompleted: number;
  tasksFailed: number;
  stakedAmountEth: string;
  score: number;
  scoreBreakdown: {
    capabilityMatch: number;
    successRate: number;
    priceCompetitiveness: number;
    reputation: number;
  };
}

// ─── Tool Registration ───────────────────────────────────────

export function registerMatchTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────
  // corven_match — action: find
  // ──────────────────────────────────────────────────────────
  server.registerTool(
    "corven_match",
    {
      title: "Smart Worker Matching",
      description:
        "Find the best workers for your task using multi-factor scoring.\n\n" +
        "STATUS: This tool is in preview mode. Some actions may return placeholder data.\n\n" +
        "ACTIONS:\n" +
        "  find  — Discover and rank agents by capability match, success rate, price competitiveness, and reputation.\n" +
        "  match — Get a detailed match score for a specific worker against your requirements.\n\n" +
        "SCORING: capability_match(30%) + success_rate(20%) + price_competitiveness(15%) + reputation(55%).\n" +
        "WORKFLOW: corven_match find → corven_get_agent (inspect top candidates) → corven_create_task.\n" +
        "WHEN TO USE: Before creating a task to find the optimal worker. Free read-only call, no gas cost.\n\n" +
        "NEXT STEP: Inspect top candidates with corven_agent({ action: 'get' }), then create a task.\n\n" +
        "OUTPUT RULES:\n" +
        "- Present results as clean, readable text. Never show raw JSON.\n" +
        "- On error: Explain in plain language what went wrong and suggest next step.\n" +
        "- Always recommend a logical follow-up action.\n" +
        "- Never show stack traces, technical errors, or raw data.",
      inputSchema: {
        action: z.enum(["find", "match"]).describe("Matching action"),
        capabilities: z.array(z.string()).describe("Required capability tags (e.g. ['python', 'data-analysis'])"),
        minReputation: z.number().optional().describe("Minimum reputation filter (0-1000)"),
        limit: z.number().optional().describe("Max results for find (1-50, default 5)"),
        workerAddress: z.string().optional().describe("Worker address to evaluate (for match)"),
      },
    },
    async (params) => {
      try {
        const { action } = params as { action: string };

        switch (action) {
          case "find": {
            const parsed = findSchema.safeParse({
              minReputation: params.minReputation,
              limit: params.limit,
            });
            if (!parsed.success) {
              return formatStructuredError(
                "Invalid input for find.",
                parsed.error.issues.map((e) => e.message).join("; "),
                "Provide minReputation as 0-1000, limit as 1-50.",
                true
              );
            }
            const { minReputation: minRep, limit: maxResults } = parsed.data;
            const reqCaps = params.capabilities || [];

            // Search agent_profiles store
            const { loadStore } = await import("../lib/store.js");
            const profiles = loadStore<Record<string, any>>("agent_profiles", {});

            const matches = Object.entries(profiles)
              .map(([addr, p]: [string, any]) => {
                const agentCaps = p.capabilities || [];
                const capMatch = reqCaps.length === 0
                  ? 1
                  : reqCaps.filter((c: string) => agentCaps.some((ac: string) => ac.toLowerCase() === c.toLowerCase())).length / reqCaps.length;
                const reputation = p.reputation || 0;
                const score = capMatch * 0.3 + Math.min(reputation / 1000, 1) * 0.7;
                return { address: addr, name: p.name || "", capabilities: agentCaps, reputation, score, source: "local" };
              })
              .filter((m) => m.score > 0 && (minRep ? m.reputation >= minRep : true))
              .sort((a, b) => b.score - a.score)
              .slice(0, maxResults);

            return formatReadResult({
              count: matches.length,
              matches: matches.map((m) => ({
                address: m.address,
                name: m.name,
                capabilities: m.capabilities,
                reputation: m.reputation,
                score: Math.round(m.score * 100) / 100,
                source: m.source,
              })),
              query: { capabilities: reqCaps, minReputation: minRep },
            }, `Worker Match — ${matches.length} candidates`);
          }

          case "match": {
            const parsed = matchSchema.safeParse({
              workerAddress: params.workerAddress,
              capabilities: params.capabilities,
            });
            if (!parsed.success) {
              return formatStructuredError(
                "Invalid input for match.",
                parsed.error.issues.map((e) => e.message).join("; "),
                "Provide workerAddress and capabilities.",
                true
              );
            }
            const { workerAddress, capabilities: reqCaps } = parsed.data;

            const agent = (await readContract(
              CONTRACTS.AgentRegistry,
              ABI,
              "getAgent",
              [workerAddress]
            )) as any;

            if (!agent) {
              return formatStructuredError(
                "Agent not found.",
                `No agent registered at ${workerAddress}`,
                "Verify the address or use corven_match find to discover agents.",
                false
              );
            }

            const caps: string[] = agent.capabilities ?? [];
            const completed = Number(agent.tasksCompleted ?? 0);
            const failed = Number(agent.tasksFailed ?? 0);
            const stake = BigInt(agent.stakedAmount ?? 0);
            const rep = Number(agent.reputation ?? 0);

            const capScore = capabilityMatchScore(caps, reqCaps);
            const srScore = successRateScore(completed, failed);
            const priceScore = 0.5;
            const repScore = reputationScore(rep);

            const total =
              capScore * W_CAPABILITY +
              srScore * W_SUCCESS_RATE +
              priceScore * W_PRICE +
              repScore * W_REPUTATION;

            return formatReadResult(
              {
                address: workerAddress,
                name: agent.name ?? "Unknown",
                reputation: rep,
                capabilities: caps,
                tasksCompleted: completed,
                tasksFailed: failed,
                stakedAmountEth: (() => {
                  try { return formatEther(stake); } catch { return "0"; }
                })(),
                score: Math.round(total * 10000) / 10000,
                scoreBreakdown: {
                  capabilityMatch: Math.round(capScore * 10000) / 10000,
                  successRate: Math.round(srScore * 10000) / 10000,
                  priceCompetitiveness: Math.round(priceScore * 10000) / 10000,
                  reputation: Math.round(repScore * 10000) / 10000,
                },
              },
              `Match score for ${agent.name ?? workerAddress}: ${Math.round(total * 10000) / 10000}`
            );
          }

          default:
            return formatStructuredError(
              `Unknown action: ${action}`,
              "Valid actions: find, match",
              "Pass action as 'find' or 'match'.",
              true
            );
        }
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
