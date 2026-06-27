/**
 * corven_agent — Agent lifecycle via CovenantSDK
 */
import { z } from "zod";
import { parseEther, formatEther, type Address, keccak256, toBytes } from "viem";
import { getSDK, getAccount, getPublicClient, loadAbi, CONTRACTS } from "../config.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import { loadStore, saveStore } from "../lib/store.js";
import { readContract } from "../handlers/wallet.js";
import type { TxResult } from "../types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

async function waitAndFormat(hash: `0x${string}`): Promise<TxResult> {
  const client = getPublicClient();
  const receipt = await client.waitForTransactionReceipt({ hash });
  return { status: "success", txHash: hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed };
}

interface AgentProfile {
  address: string;
  name: string;
  capabilities: string[];
  registeredAt: number;
  lastSeen: number;
}

const agentProfiles = loadStore<Record<string, AgentProfile>>('agent_profiles', {});

const schema = z.object({
  action: z.enum(["register", "get", "list", "update", "deactivate", "stake", "find", "search"]),
  name: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  stake: z.string().optional().default("0.001"),
  address: z.string().optional(),
  capability: z.string().optional(),
  bio: z.string().optional(),
  confirm: z.boolean().optional().default(false).describe('NEVER set this yourself. ALWAYS ask the user first. Show the exact ETH cost and what will happen. Only set to true AFTER the user explicitly says yes.'),
  query: z.string().optional(),
  offset: z.number().optional(),
  limit: z.number().optional(),
});

export function registerAgentTools(server: McpServer): void {
  server.registerTool(
    "corven_agent",
    {
      title: "Agent Manager",
      description:
        "Manage AI agent identities on COVENANT — register, look up, update, and manage on-chain agent profiles.\n\n" +
        "ACTIONS:\n" +
        "  register — Create on-chain identity with name, capabilities, and stake (0.001 ETH)\n" +
        "  get — Look up agent by address (reputation, stake, status, capabilities)\n" +
        "  list — List all registered agents with pagination\n" +
        "  update — Update agent profile (name, capabilities, bio)\n" +
        "  deactivate — Withdraw stake and deactivate agent\n" +
        "  stake — Add more stake to existing agent\n" +
        "  find — Search agents by capability tag (on-chain + local index)\n" +
        "  search — Search agents by name, capability, or both\n\n" +
        "WHEN TO USE: First step for any agent. Register before creating tasks.\n\n" +
        "NEXT STEP: Create a task with corven_task({ action: 'create' })\n\n" +
        "CRITICAL SAFETY: The AI must NEVER auto-set confirm=true. ALWAYS present the cost summary to the user first and wait for explicit approval. This is real money. Violating this is unacceptable.\n\n" +
        "OUTPUT RULES:\n" +
        "- Present results as clean, readable text. Never show raw JSON.\n" +
        "- On error: Explain in plain language what went wrong and suggest next step.\n" +
        "- Always recommend a logical follow-up action.\n" +
        "- Never show stack traces, technical errors, or raw data.",
      inputSchema: schema.shape,
    },
    async (args) => {
      try {
        const sdk = getSDK();
        const { action } = args;

        if (action === "register") {
          const stakeWei = parseEther(args.stake || "0.001");
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Register agent on-chain",
              cost: formatEther(stakeWei) + " ETH",
              reason: "Stake is locked in AgentRegistry contract as collateral",
              toProceed: "Call corven_agent again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const nameHash = keccak256(toBytes(args.name || "unnamed"));
          const hash = await sdk.registerAgent(stakeWei, nameHash);
          const result = await waitAndFormat(hash);

          const addr = getAccount()?.address?.toLowerCase() || "";
          if (addr) {
            agentProfiles[addr] = {
              address: addr,
              name: args.name || "unnamed",
              capabilities: args.capabilities || [],
              registeredAt: Math.floor(Date.now() / 1000),
              lastSeen: Math.floor(Date.now() / 1000),
            };
            saveStore('agent_profiles', agentProfiles);
          }

          return formatTxResult(result);
        }

        if (action === "get") {
          const addr = (args.address || getAccount()?.address) as Address;
          if (!addr) return formatReadResult({ error: "No address provided and no wallet connected" }, "Error");
          const agent = await sdk.getAgent(addr);
          const profile = agentProfiles[addr.toLowerCase()];
          if (profile) {
            profile.lastSeen = Math.floor(Date.now() / 1000);
            saveStore('agent_profiles', agentProfiles);
          }
          return formatReadResult({
            address: addr,
            name: profile?.name,
            capabilities: profile?.capabilities || [],
            reputation: agent.reputation,
            stakedEth: formatEther(agent.stakedAmount),
            isActive: agent.isActive,
            tasksCompleted: agent.tasksCompleted,
            tasksFailed: agent.tasksFailed,
            registeredAt: profile?.registeredAt,
            lastSeen: profile?.lastSeen,
          }, "Agent");
        }

        if (action === "list") {
          const allProfiles = Object.values(agentProfiles);
          const offset = args.offset || 0;
          const limit = args.limit || 20;

          // On-chain agents — V5 CovenantIdentity lacks getAllAgents, so on-chain
          // iteration is not possible. Local store is the primary source.
          // On-chain data is fetched per-agent in the get action.

          // Local store is the primary source
          const seen = new Set<string>();
          const merged: Array<{ address: string; name: string; capabilities: string[]; registeredAt?: number; lastSeen?: number; stakedEth?: string; reputation?: number; isActive?: boolean; source: string }> = [];
          for (const p of allProfiles) {
            if (seen.has(p.address.toLowerCase())) continue;
            seen.add(p.address.toLowerCase());
            merged.push({ address: p.address, name: p.name, capabilities: p.capabilities, registeredAt: p.registeredAt, lastSeen: p.lastSeen, source: "local" });
          }

          const paginated = merged.slice(offset, offset + limit);
          return formatReadResult({
            total: merged.length,
            offset,
            limit,
            count: paginated.length,
            agents: paginated.map(p => ({
              address: p.address,
              name: p.name,
              capabilities: p.capabilities,
              registeredAt: p.registeredAt,
              lastSeen: p.lastSeen,
              stakedEth: p.stakedEth,
              reputation: p.reputation,
              isActive: p.isActive,
              source: p.source,
            })),
          }, "Agent Profiles");
        }

        if (action === "stake") {
          return formatReadResult({ info: "Use increaseStake() on the CovenantIdentity contract directly" }, "Stake Info");
        }

        if (action === "find") {
          const cap = (args.capability || "").toLowerCase();

          // Local store matches
          const localMatches = Object.values(agentProfiles).filter(p =>
            p.capabilities.some(c => c.toLowerCase().includes(cap))
          );

          // Local store is the primary source for agent discovery

          // Deduplicate by address
          const seen = new Set<string>();
          const merged: Array<{ address: string; name: string; capabilities: string[]; lastSeen?: number; stakedEth?: string; reputation?: number; isActive?: boolean; source: string }> = [];
          for (const p of localMatches) {
            if (seen.has(p.address.toLowerCase())) continue;
            seen.add(p.address.toLowerCase());
            merged.push({ address: p.address, name: p.name, capabilities: p.capabilities, lastSeen: p.lastSeen, source: "local" });
          }

          return formatReadResult({
            query: args.capability,
            found: merged.length,
            agents: merged.slice(0, 10).map(p => ({
              address: p.address,
              name: p.name,
              capabilities: p.capabilities,
              lastSeen: p.lastSeen,
              stakedEth: p.stakedEth,
              reputation: p.reputation,
              isActive: p.isActive,
              source: p.source,
            })),
          }, "Agent Search");
        }

        if (action === "search") {
          const q = (args.query || "").toLowerCase();
          const matches = Object.values(agentProfiles).filter(p => {
            const nameMatch = p.name.toLowerCase().includes(q);
            const capMatch = p.capabilities.some(c => c.toLowerCase().includes(q));
            return nameMatch || capMatch;
          });
          const offset = args.offset || 0;
          const limit = args.limit || 20;
          const paginated = matches.slice(offset, offset + limit);
          return formatReadResult({
            query: args.query,
            total: matches.length,
            offset,
            limit,
            count: paginated.length,
            agents: paginated.map(p => ({
              address: p.address,
              name: p.name,
              capabilities: p.capabilities,
              lastSeen: p.lastSeen,
            })),
          }, "Agent Search Results");
        }

        return formatReadResult({ error: "Unknown action" }, "Error");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
