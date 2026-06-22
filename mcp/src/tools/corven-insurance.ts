/**
 * corven_insurance — Insurance pool
 *
 * Consolidates: corven_join_insurance_pool, corven_pay_premium,
 *               corven_claim_insurance, corven_vote_on_claim,
 *               corven_get_claim, corven_get_coverage_percent,
 *               corven_get_pool_balance, corven_get_member_info
 */
import { z } from "zod";
import { parseEther, formatEther, type Address } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("InsurancePool");

const actionSchema = z.enum([
  "join", "premium", "claim", "vote", "get",
]);

const schema = z.object({
  action: actionSchema,
  taskId: z.number().optional(),
  premium: z.string().optional(),
  claimId: z.number().optional(),
  inFavor: z.boolean().optional(),
  agent: z.string().optional(),
  contribution: z.string().optional(),
  confirm: z.boolean().optional().default(false).describe('Set to true to execute. Without this, shows what will happen.'),
});

export function registerInsuranceTools(server: McpServer): void {
  server.registerTool(
    "corven_insurance",
    {
      title: "Insurance Manager",
      description:
        "Protect against task failures with the COVENANT insurance pool.\n\n" +
        "ACTIONS:\n" +
        "  join — Join the insurance pool (requires contribution, min 0.01 ETH)\n" +
        "  premium — Pay premium for a specific task (requires taskId, premium)\n" +
        "  claim — File an insurance claim for a failed task (requires taskId)\n" +
        "  vote — Governance vote on an insurance claim (requires claimId, inFavor)\n" +
        "  get — Get claim details, pool balance, or coverage info\n\n" +
        "WORKFLOW: join pool → pay premium per task → if task fails → claim → vote → payout\n" +
        "COVERAGE: Protocol-wide coverage percentage (e.g. 80%). Premium is ~5% of task payment.\n\n" +
        "WHEN TO USE: When you want financial protection against worker non-delivery or task failure.\n\n" +
        "NEXT STEP: Pay a premium for a task with corven_insurance({ action: 'premium' })\n\n" +
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

        if (action === "join") {
          if (!args.contribution) {
            return formatStructuredError("Missing required field.", "join requires contribution.", "Provide contribution in ETH (min 0.01).", false);
          }
          const contribWei = parseEther(args.contribution);
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Join insurance pool",
              cost: formatEther(contribWei) + " ETH contribution",
              reason: "Contribution joins the shared insurance pool",
              toProceed: "Call corven_insurance again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const result = await executeOrPrepare(
            CONTRACTS.AgentInsurance, ABI, "joinPool", [], contribWei
          );
          return formatTxResult(result);
        }

        if (action === "premium") {
          if (args.taskId === undefined || !args.premium) {
            return formatStructuredError("Missing required fields.", "premium requires taskId and premium.", "Provide both parameters.", false);
          }
          return formatReadResult({
            info: "Premium payment is not available in V5 InsurancePool.",
            reason: "V5 InsurancePool uses a different premium model. Use joinPool to contribute to the pool.",
            taskId: args.taskId,
          }, "Premium Payment — Not Available");
        }

        if (action === "claim") {
          if (args.taskId === undefined) {
            return formatStructuredError("Missing required field.", "claim requires taskId.", "Provide taskId.", false);
          }
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "File insurance claim for failed task #" + args.taskId,
              cost: "0 ETH (gas only)",
              reason: "Claim triggers payout evaluation from pool",
              toProceed: "Call corven_insurance again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const result = await executeOrPrepare(
            CONTRACTS.AgentInsurance, ABI, "fileClaim",
            [BigInt(args.taskId)],
            0n
          );
          return formatTxResult(result);
        }

        if (action === "vote") {
          if (args.claimId === undefined || args.inFavor === undefined) {
            return formatStructuredError("Missing required fields.", "vote requires claimId and inFavor.", "Provide both parameters.", false);
          }
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Vote on insurance claim #" + args.claimId,
              cost: "0 ETH (gas only)",
              reason: "Vote records your position on the claim",
              toProceed: "Call corven_insurance again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const result = await executeOrPrepare(
            CONTRACTS.AgentInsurance, ABI, "voteOnClaim",
            [BigInt(args.claimId), args.inFavor],
            0n
          );
          return formatTxResult(result);
        }

        if (action === "get") {
          if (args.claimId !== undefined) {
            const data = await readContract(CONTRACTS.AgentInsurance, ABI, "claims", [BigInt(args.claimId)]);
            const enriched = { ...(data as any), amountEth: (data as any).amount ? formatEther((data as any).amount) : "0" };
            return formatReadResult(enriched, `Insurance Claim #${args.claimId}`);
          }
          if (args.agent) {
            const data = await readContract(CONTRACTS.AgentInsurance, ABI, "members", [args.agent as Address]);
            return formatReadResult(data, `Insurance Info for ${args.agent}`);
          }
          // Default: show pool balance and coverage
          const [balance, coverage] = await Promise.all([
            readContract(CONTRACTS.AgentInsurance, ABI, "getPoolBalance", []),
            readContract(CONTRACTS.AgentInsurance, ABI, "CLAIM_COVERAGE_PERCENT", []),
          ]);
          return formatReadResult({
            poolBalanceEth: formatEther(balance as bigint),
            coveragePercent: Number(coverage),
            claimCount: Number(await readContract(CONTRACTS.AgentInsurance, ABI, "claimCount", [])),
          }, "Insurance Pool");
        }

        return formatReadResult({ error: "Unknown action" }, "Error");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
