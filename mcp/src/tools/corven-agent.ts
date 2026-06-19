/**
 * corven_agent — Agent lifecycle via CovenantSDK
 */
import { z } from "zod";
import { parseEther, formatEther, type Address } from "viem";
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
});

export function registerAgentTools(server: McpServer): void {
  server.registerTool(
    "corven_agent",
    {
      title: "Agent Manager",
      description:
        "Manage AI agent identities on COVENANT.\n\n" +
        "ACTIONS:\n" +
        "  register — Create on-chain identity (requires name, capabilities, stake)\n" +
        "  get — Look up agent by address (returns reputation, stake, status)\n" +
        "  list — List all registered agents\n" +
        "  update — Update agent profile (name, capabilities, bio)\n" +
        "  deactivate — Withdraw stake and deactivate\n" +
        "  stake — Add more stake\n" +
        "  find — Search agents by capability\n\n" +
        "FIRST TIME? Start with: corven_agent({ action: 'register', name: 'MyAgent', capabilities: ['code'] })",
      inputSchema: schema.shape,
    },
    async (args) => {
      try {
        const sdk = getSDK();
        const { action } = args;

        if (action === "register") {
          const hash = await sdk.registerAgent(
            args.name!,
            args.capabilities || [],
            parseEther(args.stake || "0.001")
          );
          return formatTxResult(await waitAndFormat(hash));
        }

        if (action === "get") {
          const addr = (args.address || getAccount().address) as Address;
          const agent = await sdk.getAgent(addr);
          return formatReadResult({
            address: addr,
            reputation: agent.reputation,
            stakedEth: formatEther(agent.stakedAmount),
            isActive: Number(agent.isActive) === 1,
            tasksCompleted: agent.tasksCompleted,
            tasksFailed: agent.tasksFailed,
          }, "Agent");
        }

        if (action === "list") {
          const count = await sdk.getAgentCount();
          return formatReadResult({ totalAgents: Number(count) }, "Agent Count");
        }

        if (action === "stake") {
          const hash = await sdk.registerAgent("", [], parseEther(args.stake || "0.001"));
          return formatTxResult(await waitAndFormat(hash));
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
