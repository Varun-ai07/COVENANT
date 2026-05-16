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
        "Submit an insurance claim for a failed task. " +
        "May require governance approval depending on claim type.",
      inputSchema: {
        taskId: z.number().describe("Task ID to claim insurance for"),
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
        return formatError(e);
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
      description: "Retrieve details of an insurance claim.",
      inputSchema: {
        claimId: z.number().describe("Claim ID"),
      },
    },
    async ({ claimId }) => {
      try {
        const data = await readContract(
          CONTRACTS.AgentInsurance,
          ABI,
          "getClaim",
          [BigInt(claimId)]
        );

        const enriched = {
          ...(data as any),
          amountEth: (data as any).amount ? formatEther((data as any).amount) : "0",
        };
        return formatReadResult(enriched, `Insurance Claim #${claimId}`);
      } catch (e) {
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // get_claim_counter
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_claim_counter",
    {
      title: "Get Claim Counter",
      description: "Get the total number of insurance claims filed.",
      inputSchema: {},
    },
    async () => {
      try {
        const count = await readContract(
          CONTRACTS.AgentInsurance,
          ABI,
          "claimCounter",
          []
        );
        return formatReadResult({ count: Number(count) }, "Insurance Claim Counter");
      } catch (e) {
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // get_coverage_percent
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_coverage_percent",
    {
      title: "Get Coverage Percentage",
      description: "Get the insurance coverage percentage (e.g., 80% = 80).",
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
        return formatError(e);
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
      description: "Join the agent insurance pool by contributing ETH (min 0.01 ETH).",
      inputSchema: {
        contribution: z.string().describe("Contribution amount in ETH (min 0.01)"),
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
      } catch (e) { return formatError(e); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_pay_premium
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_pay_premium",
    {
      title: "Pay Insurance Premium",
      description: "Pay insurance premium for a specific task to get coverage. Premium is typically a percentage (e.g., 5%) of the task payment.",
      inputSchema: {
        taskId: z.number().describe("Task ID to insure"),
        premium: z.string().describe("Premium amount in ETH (e.g., '0.0001')"),
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
      } catch (e) { return formatError(e); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_vote_on_claim
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_vote_on_claim",
    {
      title: "Vote on Insurance Claim",
      description: "Governance member votes on an insurance claim.",
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
      } catch (e) { return formatError(e); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_pay_claim
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_pay_claim",
    {
      title: "Pay Insurance Claim",
      description: "Pay out an approved insurance claim.",
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
      } catch (e) { return formatError(e); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_pool_balance
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_pool_balance",
    {
      title: "Get Insurance Pool Balance",
      description: "Get the current balance of the insurance pool.",
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
      } catch (e) { return formatError(e); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_member_info
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_member_info",
    {
      title: "Get Insurance Member Info",
      description: "Get insurance membership info for an agent.",
      inputSchema: {
        agent: z.string().describe("Agent's Ethereum address"),
      },
    },
    async ({ agent }) => {
      try {
        const data = await readContract(
          CONTRACTS.AgentInsurance, ABI, "getMemberInfo", [agent as Address]
        );
        return formatReadResult(data, `Insurance info for ${agent}`);
      } catch (e) { return formatError(e); }
    }
  );
}
