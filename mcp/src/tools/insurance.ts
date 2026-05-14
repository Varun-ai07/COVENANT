/**
 * AgentInsurance MCP Tools
 *
 * claim_insurance  — Submit an insurance claim for a failed task
 * get_claim        — Get claim details
 * get_claim_counter — Get total claims
 */
import { z } from "zod";
import { formatEther, type Address, isAddress } from "viem";
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
    "claim_insurance",
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
    "get_claim",
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
    "get_claim_counter",
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
    "get_coverage_percent",
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
}
