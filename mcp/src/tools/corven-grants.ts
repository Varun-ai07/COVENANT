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
  confirm: z.boolean().optional().default(false).describe('NEVER set this yourself. ALWAYS ask the user first. Show the exact ETH cost and what will happen. Only set to true AFTER the user explicitly says yes.'),
});

export function registerGrantTools(server: McpServer): void {
  server.registerTool(
    "corven_grants",
    {
      title: "Grant Program",
      description:
        "DAO-funded grants for agent development on COVENANT — apply, vote, and fund.\n\n" +
        "ACTIONS:\n" +
        "  apply — Submit a grant application (requires title, description, category, amount)\n" +
        "  vote — Vote on a grant application (requires grantId, support)\n" +
        "  list — List grant applications\n" +
        "  get — Get grant details by ID (requires grantId)\n\n" +
        "WORKFLOW: apply → vote → approve → fund\n" +
        "CATEGORIES: ecosystem_growth, research, community, security\n\n" +
        "WHEN TO USE: When you need DAO funding for agent development or ecosystem growth.\n\n" +
        "NEXT STEP: Vote on grants with corven_grants({ action: 'vote' })\n\n" +
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
        const { action } = args;

        if (action === "apply") {
          if (!args.title || args.title.trim() === "") {
            return formatReadResult({ error: "Title is required and must be non-empty" }, "Error");
          }
          if (!args.description || args.description.trim() === "") {
            return formatReadResult({ error: "Description is required and must be non-empty" }, "Error");
          }
          const grantAmount = Number(args.amount || "1");
          if (grantAmount <= 0) {
            return formatReadResult({ error: "Amount must be > 0 ETH" }, "Error");
          }
          const amountWei = parseEther(args.amount || "1");
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Submit grant application",
              cost: "Gas only",
              reason: "Requests " + (args.amount || "1") + " ETH from DAO treasury",
              toProceed: "Call corven_grants again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const result = await executeOrPrepare(
            CONTRACTS.GrantProgram, ABI, "applyGrant",
            [args.title!, args.description!, args.category!, amountWei],
            0n
          );
          return formatTxResult(result);
        }

        if (action === "vote") {
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Vote on grant #" + args.grantId,
              cost: "Gas only",
              reason: args.support ? "Supporting the grant application" : "Opposing the grant application",
              toProceed: "Call corven_grants again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const result = await executeOrPrepare(
            CONTRACTS.GrantProgram, ABI, "voteGrant",
            [BigInt(args.grantId!), args.support!],
            0n
          );
          return formatTxResult(result);
        }

        if (action === "list") {
          const count = await readContract(CONTRACTS.GrantProgram, ABI, "grantCount", []);
          return formatReadResult({ totalGrants: Number(count) }, "Grant Applications");
        }

        if (action === "get") {
          const data = await readContract(CONTRACTS.GrantProgram, ABI, "grants", [BigInt(args.grantId!)]);
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
