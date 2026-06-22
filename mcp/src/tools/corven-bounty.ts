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
        "ACTIONS:\n" +
        "  post — Post a bounty (requires title, description, reward, deadline)\n" +
        "  claim — Submit work to claim a bounty (requires bountyId, deliverableHash)\n" +
        "  winner — Select the winning submission (requires bountyId, winnerAddress)\n" +
        "  list — List available bounties\n" +
        "  get — Get bounty details by ID (requires bountyId)\n\n" +
        "WORKFLOW: post → claim (workers submit) → winner (creator picks)\n" +
        "NOTE: Bounty system is not yet deployed on V5 contracts.",
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
