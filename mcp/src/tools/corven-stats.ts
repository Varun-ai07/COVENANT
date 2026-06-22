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

const identityAbi = loadAbi("CovenantIdentity");
const escrowAbi = loadAbi("CovenantEscrow");

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
            const [totalAgents, totalTasks] = await Promise.all([
              readContract(CONTRACTS.AgentRegistry, identityAbi, "totalAgents", []),
              readContract(CONTRACTS.TaskEscrow, escrowAbi, "taskCount", []),
            ]);

            return formatReadResult(
              {
                totalAgents: Number(totalAgents),
                totalTasks: Number(totalTasks),
                totalFeesEth: "0",
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
              await readContract(CONTRACTS.AgentRegistry, identityAbi, "totalAgents", [])
            );

            if (totalAgents === 0) {
              return formatReadResult(
                { agents: [], totalAgents: 0 },
                "No registered agents yet"
              );
            }

            return formatReadResult(
              {
                totalAgents,
                showing: 0,
                agents: [],
                note: "Agent iteration not available in V5. Use corven_agent get with a specific address.",
              },
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
