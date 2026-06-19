import { z } from "zod";
import { parseEther, formatEther, type Address } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("AgentRegistry");

const actionSchema = z.enum(["post", "claim", "winner", "list", "get"]);

const schema = z.object({
  action: actionSchema,
  title: z.string().optional(),
  description: z.string().optional(),
  reward: z.string().optional(),
  deadline: z.number().optional(),
  bountyId: z.number().optional(),
  deliverableHash: z.string().optional(),
  winnerAddress: z.string().optional(),
});

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
        "NOTE: Bounties are offchain MVP. In production, reward ETH is escrowed.",
      inputSchema: schema.shape,
    },
    async (args) => {
      try {
        const { action } = args;

        if (action === "post") {
          const result = await executeOrPrepare(
            CONTRACTS.AgentRegistry, ABI, "postBounty",
            [args.title!, args.description!, parseEther(args.reward || "0.01"), BigInt(args.deadline!)],
            parseEther(args.reward || "0.01")
          );
          return formatTxResult(result);
        }

        if (action === "claim") {
          const result = await executeOrPrepare(
            CONTRACTS.AgentRegistry, ABI, "claimBounty",
            [BigInt(args.bountyId!), args.deliverableHash!],
            0n
          );
          return formatTxResult(result);
        }

        if (action === "winner") {
          const result = await executeOrPrepare(
            CONTRACTS.AgentRegistry, ABI, "selectWinner",
            [BigInt(args.bountyId!), args.winnerAddress as Address],
            0n
          );
          return formatTxResult(result);
        }

        if (action === "list") {
          const count = await readContract(CONTRACTS.AgentRegistry, ABI, "getBountyCount", []);
          return formatReadResult({ totalBounties: Number(count) }, "Bounties");
        }

        if (action === "get") {
          const data = await readContract(CONTRACTS.AgentRegistry, ABI, "getBounty", [BigInt(args.bountyId!)]);
          return formatReadResult({
            id: Number((data as any).id),
            title: (data as any).title,
            description: (data as any).description,
            creator: (data as any).creator,
            reward: formatEther((data as any).reward),
            status: ["Open", "Claimed", "Completed", "Cancelled"][(data as any).status] || "Unknown",
            deadline: Number((data as any).deadline),
            submissions: Number((data as any).submissions),
          }, `Bounty #${args.bountyId}`);
        }

        return formatReadResult({ error: "Unknown action" }, "Error");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
