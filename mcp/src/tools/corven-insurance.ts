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

const ABI = loadAbi("AgentInsurance");

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
        "COVERAGE: Protocol-wide coverage percentage (e.g. 80%). Premium is ~5% of task payment.",
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
          const result = await executeOrPrepare(
            CONTRACTS.AgentInsurance, ABI, "joinPool", [], contribWei
          );
          return formatTxResult(result);
        }

        if (action === "premium") {
          if (args.taskId === undefined || !args.premium) {
            return formatStructuredError("Missing required fields.", "premium requires taskId and premium.", "Provide both parameters.", false);
          }
          const premiumWei = parseEther(args.premium);
          const result = await executeOrPrepare(
            CONTRACTS.AgentInsurance, ABI, "payPremium",
            [BigInt(args.taskId)],
            premiumWei
          );
          return formatTxResult(result);
        }

        if (action === "claim") {
          if (args.taskId === undefined) {
            return formatStructuredError("Missing required field.", "claim requires taskId.", "Provide taskId.", false);
          }
          const result = await executeOrPrepare(
            CONTRACTS.AgentInsurance, ABI, "claimInsurance",
            [BigInt(args.taskId)],
            0n
          );
          return formatTxResult(result);
        }

        if (action === "vote") {
          if (args.claimId === undefined || args.inFavor === undefined) {
            return formatStructuredError("Missing required fields.", "vote requires claimId and inFavor.", "Provide both parameters.", false);
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
            const data = await readContract(CONTRACTS.AgentInsurance, ABI, "getClaim", [BigInt(args.claimId)]);
            const enriched = { ...(data as any), amountEth: (data as any).amount ? formatEther((data as any).amount) : "0" };
            return formatReadResult(enriched, `Insurance Claim #${args.claimId}`);
          }
          if (args.agent) {
            const data = await readContract(CONTRACTS.AgentInsurance, ABI, "getMemberInfo", [args.agent as Address]);
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
            claimCount: Number(await readContract(CONTRACTS.AgentInsurance, ABI, "claimCounter", [])),
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
