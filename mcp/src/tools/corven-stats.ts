/**
 * corven_stats — Protocol Statistics MCP Tool
 *
 * Protocol health metrics: agent count, task volume, top performers.
 */
import { z } from "zod";
import { formatEther } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { parseContractError, formatStructuredError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const registryAbi = loadAbi("AgentRegistry");
const escrowAbi = loadAbi("TaskEscrow");

// ─── Input Schemas ───────────────────────────────────────────

const statsSchema = z.object({});
const leaderboardSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(10).describe("Number of top agents (1-50)"),
});

// ─── Tool Registration ───────────────────────────────────────

export function registerStatsTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────
  // corven_stats — action: stats
  // ──────────────────────────────────────────────────────────
  server.registerTool(
    "corven_stats",
    {
      title: "Protocol Statistics",
      description:
        "Get aggregate COVENANT protocol health metrics.\n" +
        "ACTIONS:\n" +
        "  stats       — Total agents, tasks created, total volume (ETH), and fees collected.\n" +
        "  leaderboard — Top N agents ranked by reputation with address, name, tasks completed, stake, and capabilities.\n" +
        "WORKFLOW: corven_stats stats → corven_stats leaderboard (if you want top performers).\n" +
        "WHEN TO USE: To assess protocol activity, growth, or discover top agents. Free read-only call.",
      inputSchema: {
        action: z.enum(["stats", "leaderboard"]).describe("Stats action"),
        limit: z.number().optional().describe("Leaderboard size (1-50, default 10)"),
      },
    },
    async (params) => {
      try {
        const { action } = params as { action: string };

        switch (action) {
          case "stats": {
            const [totalAgents, totalTasks, accumulatedFees] = await Promise.all([
              readContract(CONTRACTS.AgentRegistry, registryAbi, "agentCount", []),
              readContract(CONTRACTS.TaskEscrow, escrowAbi, "taskCounter", []),
              readContract(CONTRACTS.TaskEscrow, escrowAbi, "accumulatedFees", []),
            ]);

            return formatReadResult(
              {
                totalAgents: Number(totalAgents),
                totalTasks: Number(totalTasks),
                totalFeesEth: formatEther(accumulatedFees as bigint),
              },
              "COVENANT Protocol Statistics"
            );
          }

          case "leaderboard": {
            const parsed = leaderboardSchema.safeParse({ limit: params.limit });
            if (!parsed.success) {
              return formatStructuredError(
                "Invalid input.",
                parsed.error.issues.map((e) => e.message).join("; "),
                "Provide limit as 1-50.",
                true
              );
            }
            const { limit: topN } = parsed.data;

            const totalAgents = Number(
              await readContract(CONTRACTS.AgentRegistry, registryAbi, "agentCount", [])
            );

            if (totalAgents === 0) {
              return formatReadResult(
                { agents: [], totalAgents: 0 },
                "No registered agents yet"
              );
            }

            const agentPromises = [];
            const count = Math.min(totalAgents, 200);
            for (let i = 0; i < count; i++) {
              agentPromises.push(
                readContract(CONTRACTS.AgentRegistry, registryAbi, "getAgentByIndex", [BigInt(i)]).catch(() => null)
              );
            }

            const results = await Promise.all(agentPromises);
            const agents: any[] = [];
            for (const agent of results) {
              if (agent && (agent as any).isActive) {
                agents.push(agent);
              }
            }

            agents.sort(
              (a: any, b: any) => Number(b.reputation ?? 0) - Number(a.reputation ?? 0)
            );

            const topAgents = agents.slice(0, topN).map((a: any, i: number) => ({
              rank: i + 1,
              address: a.addr ?? a.address ?? "unknown",
              name: a.name,
              reputation: Number(a.reputation),
              tasksCompleted: Number(a.tasksCompleted ?? 0),
              tasksFailed: Number(a.tasksFailed ?? 0),
              stakedEth: formatEther(a.stakedAmount ?? 0n),
              capabilities: a.capabilities ?? [],
            }));

            return formatReadResult(
              { totalAgents, showing: topAgents.length, agents: topAgents },
              "COVENANT Agent Leaderboard"
            );
          }

          default:
            return formatStructuredError(
              `Unknown action: ${action}`,
              "Valid actions: stats, leaderboard",
              "Pass action as 'stats' or 'leaderboard'.",
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
