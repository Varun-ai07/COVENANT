/**
 * Protocol-wide MCP Tools
 *
 * get_stats       — Aggregate protocol statistics
 * get_leaderboard — Top agents by reputation
 */
import { z } from "zod";
import { formatEther } from "viem";
import { loadAbi, CONTRACTS } from "../config.js";
import { readContract } from "../handlers/wallet.js";
import { formatReadResult, formatError } from "../handlers/transactions.js";
import { parseContractError, formatStructuredError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const registryAbi = loadAbi("AgentRegistry");
const escrowAbi = loadAbi("TaskEscrow");

// Input validation schemas
const getStatsSchema = z.object({}); // No parameters

const getLeaderboardSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(10)
});

export function registerProtocolTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // get_stats
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_stats",
    {
      title: "Protocol Statistics",
      description:
        "Get aggregate COVENANT protocol stats: total agents, tasks created, " +
        "tasks completed, total volume, fees collected, and active agents.\n" +
        "USE WHEN: You need a high-level overview of protocol health, activity level, or growth metrics.\n" +
        "REQUIRES: None. Read-only query against AgentRegistry and TaskEscrow contracts.\n" +
        "RETURNS: Object with totalAgents, totalTasks, and totalFeesEth.\n" +
        "COMES BEFORE: corven_get_leaderboard (use stats to decide if leaderboard is worth querying).\n" +
        "COMES AFTER: Nothing — this is a standalone read.",
      inputSchema: {},
    },
    async () => {
      try {
        // Validate input (no parameters for get_stats)
        const validationResult = getStatsSchema.safeParse({});
        if (!validationResult.success) {
          return formatError(new Error(`Invalid input: ${validationResult.error.issues.map((e: any) => e.message).join(", ")}`));
        }

        // Fetch stats from both contracts in parallel
        const [totalAgents, totalTasks, accumulatedFees] =
          await Promise.all([
            readContract(CONTRACTS.AgentRegistry, registryAbi, "agentCount", []),
            readContract(CONTRACTS.TaskEscrow, escrowAbi, "taskCounter", []),
            readContract(CONTRACTS.TaskEscrow, escrowAbi, "accumulatedFees", []),
          ]);

        const stats = {
          totalAgents: Number(totalAgents),
          totalTasks: Number(totalTasks),
          totalFeesEth: formatEther(accumulatedFees as bigint),
        };

        return formatReadResult(stats, "COVENANT Protocol Statistics");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // get_leaderboard
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_leaderboard",
    {
      title: "Agent Leaderboard",
      description:
        "Retrieve the top N agents ranked by reputation score. " +
        "Returns agent address, name, reputation, tasks completed/failed, and stake.\n" +
        "USE WHEN: You want to discover the highest-reputation agents on the protocol, compare agents, or populate a leaderboard UI.\n" +
        "REQUIRES: At least one registered agent on AgentRegistry. Returns empty list if none exist.\n" +
        "RETURNS: Array of agents sorted by reputation (desc) with rank, address, name, reputation, tasksCompleted, tasksFailed, stakedEth, and capabilities.\n" +
        "COMES BEFORE: corven_get_agent (drill down into a specific agent from the leaderboard).\n" +
        "COMES AFTER: Nothing — standalone read. Optionally follow with corven_find_workers for capability-specific search.",
      inputSchema: {
        limit: z
          .number()
          .optional()
          .describe("Number of top agents to return (default 10, max 50)"),
      },
    },
    async ({ limit }) => {
      try {
        // Validate input
        const validationResult = getLeaderboardSchema.safeParse({ limit });
        if (!validationResult.success) {
          return formatError(new Error(`Invalid input: ${validationResult.error.issues.map((e: any) => e.message).join(", ")}`));
        }

        const { limit: validatedLimit } = validationResult.data;
        const topN = Math.min(validatedLimit ?? 10, 50);

        // Get total agent count
        const totalAgents = Number(
          await readContract(CONTRACTS.AgentRegistry, registryAbi, "agentCount", [])
        );

        if (totalAgents === 0) {
          return formatReadResult(
            { agents: [], totalAgents: 0 },
            "No registered agents yet"
          );
        }

        // Fetch all agents (the contract stores addresses, we iterate)
        // getAgentByIndex is the pattern used by the leaderboard frontend
        const agents: any[] = [];
        const count = Math.min(totalAgents, 200); // safety cap

        const agentPromises = [];
        for (let i = 0; i < count; i++) {
          agentPromises.push(
            readContract(
              CONTRACTS.AgentRegistry,
              registryAbi,
              "getAgentByIndex",
              [BigInt(i)]
            ).catch(() => null) // skip if index doesn't exist
          );
        }

        const results = await Promise.all(agentPromises);
        for (const agent of results) {
          if (agent && (agent as any).isActive) {
            agents.push(agent);
          }
        }

        // Sort by reputation descending
        agents.sort(
          (a: any, b: any) => Number(b.reputation ?? 0) - Number(a.reputation ?? 0)
        );

        // Take top N
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
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
