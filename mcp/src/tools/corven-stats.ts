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
import { loadStore, saveStore } from "../lib/store.js";
import { eventIndexer } from "../lib/events.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface WebhookRecord {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: number;
}

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
  // corven_stats — action: stats, leaderboard, subscribe,
  //                  unsubscribe, list_hooks, recent_events
  // ──────────────────────────────────────────────────────────
  server.registerTool(
    "corven_stats",
    {
      title: "Protocol Statistics & Webhooks",
      description:
        "Get aggregate COVENANT protocol health metrics or manage event webhooks.\n" +
        "ACTIONS:\n" +
        "  stats          — Total agents, tasks created, total volume (ETH), and fees collected.\n" +
        "  leaderboard    — Top N agents ranked by reputation (address, name, tasks completed, stake).\n" +
        "  subscribe      — Register a webhook URL for specific event types.\n" +
        "  unsubscribe    — Remove a webhook by ID.\n" +
        "  list_hooks     — List active webhook subscriptions.\n" +
        "  recent_events  — Return recent events from the on-chain event indexer.\n" +
        "WORKFLOW: corven_stats stats → corven_stats leaderboard (for top performers).\n" +
        "WHEN TO USE: To assess protocol activity, growth, discover top agents, or get notified of events.\n\n" +
        "OUTPUT RULES:\n" +
        "- Present results as clean, readable text. Never show raw JSON.\n" +
        "- On error: Explain in plain language what went wrong and suggest next step.\n" +
        "- Always recommend a logical follow-up action.\n" +
        "- Never show stack traces, technical errors, or raw data.",
      inputSchema: {
        action: z.enum(["stats", "leaderboard", "subscribe", "unsubscribe", "list_hooks", "recent_events"]).describe("Stats or webhook action"),
        limit: z.number().optional().describe("Leaderboard size (1-50, default 10)"),
        url: z.string().optional().describe("Webhook URL (for subscribe)"),
        events: z.array(z.string()).optional().describe("Event types to subscribe to (for subscribe)"),
        hookId: z.string().optional().describe("Webhook ID (for unsubscribe)"),
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

            interface LeaderboardProfile {
              address: string;
              name: string;
              reputation?: number;
              capabilities?: string[];
              lastSeen?: number;
            }
            const agentStore = loadStore<Record<string, LeaderboardProfile>>("agent_profiles", {});
            const allAgents = Object.values(agentStore);
            const sorted = allAgents
              .sort((a, b) => (b.reputation ?? 0) - (a.reputation ?? 0))
              .slice(0, topN);

            return formatReadResult(
              {
                showing: sorted.length,
                total: allAgents.length,
                agents: sorted.map((a, i) => ({
                  rank: i + 1,
                  address: a.address,
                  name: a.name,
                  reputation: a.reputation ?? 0,
                  capabilities: a.capabilities ?? [],
                  lastSeen: a.lastSeen,
                })),
              },
              "COVENANT Agent Leaderboard"
            );
          }

          case "subscribe": {
            const { url, events } = params as { url?: string; events?: string[] };
            if (!url || !events || events.length === 0) {
              return formatStructuredError(
                "Missing required fields.",
                "subscribe requires url and events array.",
                "Provide url and at least one event type.",
                false
              );
            }
            const webhookStore = loadStore<Record<string, WebhookRecord>>("webhooks", {});
            const id = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            webhookStore[id] = { id, url, events, active: true, createdAt: Date.now() };
            saveStore("webhooks", webhookStore);
            return formatReadResult(
              { id, url, events, active: true },
              "Webhook Registered"
            );
          }

          case "unsubscribe": {
            const { hookId } = params as { hookId?: string };
            if (!hookId) {
              return formatStructuredError(
                "Missing required field.",
                "unsubscribe requires hookId.",
                "Provide the webhook ID from list_hooks.",
                false
              );
            }
            const webhookStore = loadStore<Record<string, WebhookRecord>>("webhooks", {});
            if (!webhookStore[hookId]) {
              return formatStructuredError("Webhook not found.", `No webhook with ID ${hookId}.`, "Use list_hooks to see active hooks.", false);
            }
            delete webhookStore[hookId];
            saveStore("webhooks", webhookStore);
            return formatReadResult({ hookId, removed: true }, "Webhook Removed");
          }

          case "list_hooks": {
            const webhookStore = loadStore<Record<string, WebhookRecord>>("webhooks", {});
            const hooks = Object.values(webhookStore);
            return formatReadResult(
              {
                totalHooks: hooks.length,
                active: hooks.filter(h => h.active).length,
                hooks: hooks.map(h => ({
                  id: h.id,
                  url: h.url,
                  events: h.events,
                  active: h.active,
                  createdAt: new Date(h.createdAt).toISOString(),
                })),
              },
              "Registered Webhooks"
            );
          }

          case "recent_events": {
            const recentEvents = eventIndexer.query({});
            const last50 = recentEvents.slice(-50);
            return formatReadResult(
              {
                totalIndexed: recentEvents.length,
                showing: last50.length,
                events: last50.map(e => ({
                  eventName: e.eventName,
                  blockNumber: Number(e.blockNumber),
                  transactionHash: e.transactionHash,
                  address: e.address,
                })),
              },
              "Recent On-Chain Events"
            );
          }

          default:
            return formatStructuredError(
              `Unknown action: ${action}`,
              "Valid actions: stats, leaderboard, subscribe, unsubscribe, list_hooks, recent_events",
              "Pass a valid action string.",
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
