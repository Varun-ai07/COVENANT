import { z } from "zod";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("AgentRegistry");

const actionSchema = z.enum(["create", "vote", "list", "get"]);

const schema = z.object({
  action: actionSchema,
  title: z.string().optional(),
  description: z.string().optional(),
  proposalType: z.string().optional(),
  proposalId: z.number().optional(),
  support: z.boolean().optional(),
  confirm: z.boolean().optional().default(false).describe('Set to true to execute. Without this, shows what will happen.'),
});

export function registerGovernTools(server: McpServer): void {
  server.registerTool(
    "corven_govern",
    {
      title: "Governance DAO",
      description:
        "Protocol governance. Create proposals, vote, shape the future.\n\n" +
        "ACTIONS:\n" +
        "  create — Create a governance proposal (requires title, description, proposalType)\n" +
        "  vote — Vote on a proposal (requires proposalId, support)\n" +
        "  list — List governance proposals\n" +
        "  get — Get proposal details by ID (requires proposalId)\n\n" +
        "WORKFLOW: create → vote → execute\n" +
        "TYPES: parameter_change, feature_addition, treasury_spend, emergency_action\n" +
        "NOTE: Governance is offchain MVP. Voting weight = agent reputation (0-1000).",
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
            CONTRACTS.AgentRegistry, ABI, "createProposal",
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
            CONTRACTS.AgentRegistry, ABI, "voteProposal",
            [BigInt(args.proposalId!), args.support!],
            0n
          );
          return formatTxResult(result);
        }

        if (action === "list") {
          const count = await readContract(CONTRACTS.AgentRegistry, ABI, "getProposalCount", []);
          return formatReadResult({ totalProposals: Number(count) }, "Governance Proposals");
        }

        if (action === "get") {
          const data = await readContract(CONTRACTS.AgentRegistry, ABI, "getProposal", [BigInt(args.proposalId!)]);
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
