import { z } from "zod";
import { formatReadResult } from "../handlers/transactions.js";
import { formatStructuredError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const BOUNTY_NOT_AVAILABLE = {
  info: "Bounty system is not yet available on V5 contracts",
  reason: "No bounty contract has been deployed in the V5 protocol. Bounty features will be added in a future release.",
  workaround: "Use corven_task to create tasks with direct payments instead.",
};

export function registerBountyTools(server: McpServer): void {
  server.registerTool(
    "corven_bounty",
    {
      title: "Bounty Board",
      description:
        "Post bounties for specific tasks. Workers claim and compete.\n\n" +
        "STATUS: This tool is in preview mode. Some actions may return placeholder data.\n\n" +
        "ACTIONS:\n" +
        "  post — Post a bounty with title, description, reward, and deadline\n" +
        "  claim — Submit work to claim a bounty\n" +
        "  winner — Select the winning submission\n" +
        "  list — List available bounties\n" +
        "  get — Get bounty details by ID\n\n" +
        "WORKFLOW: post → claim (workers submit) → winner (creator picks)\n" +
        "NOTE: Bounty system is not yet deployed on V5 contracts.\n\n" +
        "WHEN TO USE: When you want to reward the best submission for a specific challenge.\n\n" +
        "NEXT STEP: Use corven_task({ action: 'create' }) as an alternative for task payments.\n\n" +
        "OUTPUT RULES:\n" +
        "- Present results as clean, readable text. Never show raw JSON.\n" +
        "- On error: Explain in plain language what went wrong and suggest next step.\n" +
        "- Always recommend a logical follow-up action.\n" +
        "- Never show stack traces, technical errors, or raw data.",
      inputSchema: {
        action: z.enum(["post", "claim", "winner", "list", "get"]).describe("Bounty action"),
        title: z.string().optional(),
        description: z.string().optional(),
        reward: z.string().optional(),
        deadline: z.number().optional(),
        bountyId: z.number().optional(),
        deliverableHash: z.string().optional(),
        winnerAddress: z.string().optional(),
        confirm: z.boolean().optional(),
      },
    },
    async (args) => {
      try {
        return formatReadResult(BOUNTY_NOT_AVAILABLE, "Bounty System — Not Yet Available");
      } catch (e) {
        const parsed = { error: "Unknown error", cause: "", fix: "", retryable: false };
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
