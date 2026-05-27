/**
 * AgentInsurance MCP Tools
 *
 * claim_insurance  — Submit an insurance claim for a failed task
 * get_claim        — Get claim details
 * get_claim_counter — Get total claims
 */
import { z } from "zod";
import { parseEther, formatEther, type Address, isAddress } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult, formatError } from "../handlers/transactions.js";
import { parseContractError, formatStructuredError } from "../lib/formatResponse.js";
import { taskId as taskIdSchema, ethAmount, ethAddress } from "../lib/schemaHelpers.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("AgentInsurance");

// Input validation schemas
const claimInsuranceSchema = z.object({
  taskId: z.number().int().positive(),
});

export function registerInsuranceTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // claim_insurance
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_claim_insurance",
    {
      title: "Claim Insurance",
      description:
        "Submit an insurance claim for a failed task. May require governance approval depending on claim type.\n" +
        "USE WHEN: A task you were working on failed (e.g., deadline passed, dispute lost) and you want to recover covered funds.\n" +
        "REQUIRES: You must be a member of the insurance pool (corven_join_insurance_pool). The task must have had a premium paid (corven_pay_premium).\n" +
        "RETURNS: Transaction hash. The claim ID is emitted in the event logs.\n" +
        "COMES AFTER: corven_pay_premium was called for this task, and the task failed.\n" +
        "COMES BEFORE: corven_vote_on_claim (governance votes), corven_pay_claim (payout after approval).\n" +
        "NOTE: Claims may require governance approval. Check coverage with corven_get_coverage_percent.",
      inputSchema: {
        taskId: taskIdSchema,
      },
    },
    async ({ taskId }) => {
      try {
        const validation = claimInsuranceSchema.safeParse({ taskId });
        if (!validation.success) {
          return formatError(new Error(`Invalid input: ${validation.error.issues.map(e => e.message).join(", ")}`));
        }

        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured"));
        }

        const result = await executeOrPrepare(
          CONTRACTS.AgentInsurance,
          ABI,
          "claimInsurance",
          [BigInt(taskId)]
        );
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // get_claim
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_claim",
    {
      title: "Get Insurance Claim",
      description:
        "Get claim details by ID, or total claim count if no ID provided.\n" +
        "USE WHEN: You need to check the status, amount, or resolution of an insurance claim.\n" +
        "REQUIRES: The claim must exist on-chain.\n" +
        "RETURNS: Claim details including claimant, task ID, amount, status, and approval votes. If no ID provided, returns total claim count.\n" +
        "COMES AFTER: corven_claim_insurance filed the claim.\n" +
        "COMES BEFORE: corven_vote_on_claim (if governance voting is pending) or corven_pay_claim (if approved).\n" +
        "NOTE: Omit claimId to get the total number of claims.",
      inputSchema: {
        claimId: z.number().optional().describe("Claim ID. Omit to get total claim count."),
      },
    },
    async ({ claimId }) => {
      try {
        if (claimId === undefined) {
          const count = await readContract(CONTRACTS.AgentInsurance, ABI, "claimCounter", []);
          return formatReadResult({ claimCount: Number(count) }, "Insurance Claim Count");
        }
        const data = await readContract(CONTRACTS.AgentInsurance, ABI, "getClaim", [BigInt(claimId)]);
        const enriched = { ...(data as any), amountEth: (data as any).amount ? formatEther((data as any).amount) : "0" };
        return formatReadResult(enriched, `Insurance Claim #${claimId}`);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // get_claim_counter merged into get_claim (returns count when no claimId)

  // ──────────────────────────────────────────────────────────────
  // get_coverage_percent
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_coverage_percent",
    {
      title: "Get Coverage Percentage",
      description:
        "Get the insurance coverage percentage (e.g., 80% = 80).\n" +
        "USE WHEN: You want to know what percentage of a failed task's payment the insurance pool covers.\n" +
        "REQUIRES: None — this is a read-only query.\n" +
        "RETURNS: The coverage percentage as a number (e.g., 80 means 80% of task payment is covered).\n" +
        "COMES BEFORE: corven_pay_premium (decide if coverage is worth the premium cost).\n" +
        "NOTE: This is a protocol-wide constant, not per-task.",
      inputSchema: {},
    },
    async () => {
      try {
        const percent = await readContract(
          CONTRACTS.AgentInsurance,
          ABI,
          "CLAIM_COVERAGE_PERCENT",
          []
        );
        return formatReadResult({ coveragePercent: Number(percent) }, "Coverage Percentage");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_join_insurance_pool
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_join_insurance_pool",
    {
      title: "Join Insurance Pool",
      description:
        "Join the agent insurance pool by contributing ETH (min 0.01 ETH).\n" +
        "USE WHEN: You want to protect yourself against task failures by joining the shared insurance pool.\n" +
        "REQUIRES: You must be a registered agent. Minimum contribution is 0.01 ETH.\n" +
        "RETURNS: Transaction hash confirming pool membership.\n" +
        "COMES AFTER: corven_register_agent (you must be registered first).\n" +
        "COMES BEFORE: corven_pay_premium (insure specific tasks), corven_claim_insurance (file claims on failures).\n" +
        "NOTE: Your contribution goes into the shared pool. Higher contributions mean more coverage priority.",
      inputSchema: {
        contribution: ethAmount,
      },
    },
    async ({ contribution }) => {
      try {
        const account = getAccount();
        if (!account) return formatError(new Error("No private key configured"));
        const { parseEther } = await import("viem");
        const result = await executeOrPrepare(
          CONTRACTS.AgentInsurance, ABI, "joinPool", [], parseEther(contribution)
        );
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_pay_premium
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_pay_premium",
    {
      title: "Pay Insurance Premium",
      description:
        "Pay insurance premium for a specific task to get coverage. Premium is typically a percentage (e.g., 5%) of the task payment.\n" +
        "USE WHEN: You want to insure a task against failure before starting work.\n" +
        "REQUIRES: You must be a member of the insurance pool (corven_join_insurance_pool). The task must exist.\n" +
        "RETURNS: Transaction hash confirming premium payment and coverage activation.\n" +
        "COMES AFTER: corven_join_insurance_pool (must be a pool member) and corven_create_task (task must exist).\n" +
        "COMES BEFORE: corven_claim_insurance (if the task fails, you can claim coverage).\n" +
        "NOTE: Premium is typically 5% of the task payment. Check corven_get_coverage_percent for the coverage ratio.",
      inputSchema: {
        taskId: taskIdSchema,
        premium: ethAmount,
      },
    },
    async ({ taskId, premium }) => {
      try {
        const account = getAccount();
        if (!account) return formatError(new Error("No private key configured"));

        const premiumWei = parseEther(premium);
        const result = await executeOrPrepare(
          CONTRACTS.AgentInsurance, ABI, "payPremium", [BigInt(taskId)],
          premiumWei  // Value to send with payable function
        );
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_vote_on_claim
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_vote_on_claim",
    {
      title: "Vote on Insurance Claim",
      description:
        "Governance member votes on an insurance claim.\n" +
        "USE WHEN: You are a governance member and an insurance claim needs your approval or rejection.\n" +
        "REQUIRES: You must be a governance-eligible member of the insurance pool.\n" +
        "RETURNS: Transaction hash confirming your vote.\n" +
        "COMES AFTER: corven_claim_insurance filed the claim.\n" +
        "COMES BEFORE: corven_pay_claim (payout after sufficient approvals).\n" +
        "NOTE: Claims need a minimum number of approval votes to be paid out.",
      inputSchema: {
        claimId: z.number().describe("Claim ID"),
        inFavor: z.boolean().describe("True to approve, false to reject"),
      },
    },
    async ({ claimId, inFavor }) => {
      try {
        const account = getAccount();
        if (!account) return formatError(new Error("No private key configured"));
        const result = await executeOrPrepare(
          CONTRACTS.AgentInsurance, ABI, "voteOnClaim", [BigInt(claimId), inFavor]
        );
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_pay_claim
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_pay_claim",
    {
      title: "Pay Insurance Claim",
      description:
        "Pay out an approved insurance claim.\n" +
        "USE WHEN: An insurance claim has received enough governance approval votes and is ready for payout.\n" +
        "REQUIRES: The claim must have sufficient approval votes from governance members.\n" +
        "RETURNS: Transaction hash. The claim amount is transferred to the claimant.\n" +
        "COMES AFTER: corven_vote_on_claim resulted in sufficient approvals.\n" +
        "COMES BEFORE: The claimant receives ETH in their wallet.\n" +
        "NOTE: Anyone can trigger the payout once the claim is approved.",
      inputSchema: {
        claimId: z.number().describe("Claim ID"),
      },
    },
    async ({ claimId }) => {
      try {
        const account = getAccount();
        if (!account) return formatError(new Error("No private key configured"));
        const result = await executeOrPrepare(
          CONTRACTS.AgentInsurance, ABI, "payClaim", [BigInt(claimId)]
        );
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_pool_balance
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_pool_balance",
    {
      title: "Get Insurance Pool Balance",
      description:
        "Get the current balance of the insurance pool.\n" +
        "USE WHEN: You want to check if the pool has enough funds to cover potential claims.\n" +
        "REQUIRES: None — this is a read-only query.\n" +
        "RETURNS: Pool balance in ETH.\n" +
        "COMES BEFORE: corven_join_insurance_pool or corven_claim_insurance.\n" +
        "NOTE: A low pool balance may mean claims cannot be fully paid out.",
      inputSchema: {},
    },
    async () => {
      try {
        const balance = await readContract(
          CONTRACTS.AgentInsurance, ABI, "getPoolBalance", []
        );
        return formatReadResult(
          { poolBalanceEth: formatEther(balance as bigint) },
          "Insurance Pool Balance"
        );
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_member_info
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_member_info",
    {
      title: "Get Insurance Member Info",
      description:
        "Get insurance membership info for an agent.\n" +
        "USE WHEN: You want to check if an agent is a pool member and their contribution level.\n" +
        "REQUIRES: The agent address must be provided.\n" +
        "RETURNS: Membership details including contribution amount, join date, and active status.\n" +
        "COMES BEFORE: corven_pay_premium or corven_claim_insurance (verify membership first).\n" +
        "NOTE: Returns empty/default data if the agent is not a pool member.",
      inputSchema: {
        agent: ethAddress,
      },
    },
    async ({ agent }) => {
      try {
        const data = await readContract(
          CONTRACTS.AgentInsurance, ABI, "getMemberInfo", [agent as Address]
        );
        return formatReadResult(data, `Insurance info for ${agent}`);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
