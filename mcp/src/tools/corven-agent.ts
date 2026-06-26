/**
 * corven_agent — Agent lifecycle via CovenantSDK
 */
import { z } from "zod";
import { parseEther, formatEther, type Address, keccak256, toBytes } from "viem";
import { getSDK, getAccount, getPublicClient } from "../config.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import type { TxResult } from "../types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

async function waitAndFormat(hash: `0x${string}`): Promise<TxResult> {
  const client = getPublicClient();
  const receipt = await client.waitForTransactionReceipt({ hash });
  return { status: "success", txHash: hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed };
}

const schema = z.object({
  action: z.enum(["register", "get", "list", "update", "deactivate", "stake", "find"]),
  name: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  stake: z.string().optional().default("0.001"),
  address: z.string().optional(),
  capability: z.string().optional(),
  bio: z.string().optional(),
  confirm: z.boolean().optional().default(false).describe('NEVER set this yourself. ALWAYS ask the user first. Show the exact ETH cost and what will happen. Only set to true AFTER the user explicitly says yes.'),
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
        "  get — Look up agent by address (reputation, stake, status)\n" +
        "  list — List all registered agents\n" +
        "  update — Update agent profile (name, capabilities, bio)\n" +
        "  deactivate — Withdraw stake and deactivate agent\n" +
        "  stake — Add more stake to existing agent\n" +
        "  find — Search agents by capability tag\n\n" +
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
          return formatTxResult(await waitAndFormat(hash));
        }

        if (action === "get") {
          const addr = (args.address || getAccount()?.address) as Address;
          if (!addr) return formatReadResult({ error: "No address provided and no wallet connected" }, "Error");
          const agent = await sdk.getAgent(addr);
          return formatReadResult({
            address: addr,
            reputation: agent.reputation,
            stakedEth: formatEther(agent.stakedAmount),
            isActive: agent.isActive,
            tasksCompleted: agent.tasksCompleted,
            tasksFailed: agent.tasksFailed,
          }, "Agent");
        }

        if (action === "list") {
          const count = await sdk.getAgentCount();
          return formatReadResult({ totalAgents: Number(count) }, "Agent Count");
        }

        if (action === "stake") {
          return formatReadResult({ info: "Use increaseStake() on the CovenantIdentity contract directly" }, "Stake Info");
        }

        if (action === "find") {
          const agents = await sdk.findAgents(args.capability || "");
          return formatReadResult({
            query: args.capability,
            found: agents.length,
            agents: agents.slice(0, 10),
          }, "Agent Search");
        }

        return formatReadResult({ error: "Unknown action" }, "Error");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
