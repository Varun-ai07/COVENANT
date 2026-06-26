import { z } from "zod";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("CovenantGovernance");

const actionSchema = z.enum(["create", "vote", "list", "get"]);

const schema = z.object({
  action: actionSchema,
  title: z.string().optional(),
  description: z.string().optional(),
  proposalType: z.string().optional(),
  proposalId: z.number().optional(),
  support: z.boolean().optional(),
  confirm: z.boolean().optional().default(false).describe('NEVER set this yourself. ALWAYS ask the user first. Show the exact ETH cost and what will happen. Only set to true AFTER the user explicitly says yes.'),
});

export function registerGovernTools(server: McpServer): void {
  server.registerTool(
    "corven_govern",
    {
      title: "Governance DAO",
      description:
        "Protocol governance on COVENANT — create proposals, vote, and shape the future.\n\n" +
        "ACTIONS:\n" +
        "  create — Create a governance proposal (requires title, description, proposalType)\n" +
        "  vote — Vote on a proposal (requires proposalId, support)\n" +
        "  list — List governance proposals\n" +
        "  get — Get proposal details by ID (requires proposalId)\n\n" +
        "WORKFLOW: create → vote → execute\n" +
        "TYPES: parameter_change, feature_addition, treasury_spend, emergency_action\n" +
        "NOTE: Governance is offchain MVP. Voting weight = agent reputation (0-1000).\n\n" +
        "WHEN TO USE: When you want to propose or vote on protocol changes.\n\n" +
        "NEXT STEP: Vote on proposals with corven_govern({ action: 'vote' })\n\n" +
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

        if (action === "create") {
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Create governance proposal",
              cost: "Gas only",
              reason: "Submits proposal to DAO for voting",
              toProceed: "Call corven_govern again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const result = await executeOrPrepare(
            (CONTRACTS as any).CovenantGovernance, ABI, "propose",
            [args.title!, args.description!, args.proposalType!],
            0n
          );
          return formatTxResult(result);
        }

        if (action === "vote") {
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Vote on proposal #" + args.proposalId,
              cost: "Gas only",
              reason: args.support ? "Supporting the proposal" : "Opposing the proposal",
              toProceed: "Call corven_govern again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const result = await executeOrPrepare(
            (CONTRACTS as any).CovenantGovernance, ABI, "submitVotes",
            [BigInt(args.proposalId!), args.support!],
            0n
          );
          return formatTxResult(result);
        }

        if (action === "list") {
          const count = await readContract((CONTRACTS as any).CovenantGovernance, ABI, "proposalCount", []);
          return formatReadResult({ totalProposals: Number(count) }, "Governance Proposals");
        }

        if (action === "get") {
          const data = await readContract((CONTRACTS as any).CovenantGovernance, ABI, "getProposal", [BigInt(args.proposalId!)]);
          return formatReadResult({
            id: Number((data as any).id),
            title: (data as any).title,
            description: (data as any).description,
            proposer: (data as any).proposer,
            proposalType: (data as any).proposalType,
            status: ["Active", "Passed", "Rejected", "Executed"][(data as any).status] || "Unknown",
            votesFor: Number((data as any).votesFor),
            votesAgainst: Number((data as any).votesAgainst),
          }, `Proposal #${args.proposalId}`);
        }

        return formatReadResult({ error: "Unknown action" }, "Error");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
