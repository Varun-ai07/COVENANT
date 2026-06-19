import { z } from "zod";
import { parseEther, formatEther, type Address } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("GrantProgram");

const actionSchema = z.enum(["apply", "vote", "list", "get"]);

const schema = z.object({
  action: actionSchema,
  title: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  amount: z.string().optional(),
  grantId: z.number().optional(),
  support: z.boolean().optional(),
});

export function registerGrantTools(server: McpServer): void {
  server.registerTool(
    "corven_grants",
    {
      title: "Grant Program",
      description:
        "DAO-funded grants for agent development. Apply, vote, fund.\n\n" +
        "ACTIONS:\n" +
        "  apply — Submit a grant application (requires title, description, category, amount)\n" +
        "  vote — Vote on a grant application (requires grantId, support)\n" +
        "  list — List grant applications\n" +
        "  get — Get grant details by ID (requires grantId)\n\n" +
        "WORKFLOW: apply → vote → approve → fund\n" +
        "CATEGORIES: ecosystem_growth, research, community, security",
      inputSchema: schema.shape,
    },
    async (args) => {
      try {
        const { action } = args;

        if (action === "apply") {
          const result = await executeOrPrepare(
            CONTRACTS.GrantProgram, ABI, "applyGrant",
            [args.title!, args.description!, args.category!, parseEther(args.amount || "1")],
            0n
          );
          return formatTxResult(result);
        }

        if (action === "vote") {
          const result = await executeOrPrepare(
            CONTRACTS.GrantProgram, ABI, "voteGrant",
            [BigInt(args.grantId!), args.support!],
            0n
          );
          return formatTxResult(result);
        }

        if (action === "list") {
          const count = await readContract(CONTRACTS.GrantProgram, ABI, "getGrantCount", []);
          return formatReadResult({ totalGrants: Number(count) }, "Grant Applications");
        }

        if (action === "get") {
          const data = await readContract(CONTRACTS.GrantProgram, ABI, "getGrant", [BigInt(args.grantId!)]);
          return formatReadResult({
            id: Number((data as any).id),
            title: (data as any).title,
            description: (data as any).description,
            applicant: (data as any).applicant,
            category: (data as any).category,
            amountRequested: formatEther((data as any).amountRequested),
            status: ["Pending", "Approved", "Rejected", "Funded"][(data as any).status] || "Unknown",
            votesFor: Number((data as any).votesFor),
            votesAgainst: Number((data as any).votesAgainst),
          }, `Grant #${args.grantId}`);
        }

        return formatReadResult({ error: "Unknown action" }, "Error");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
