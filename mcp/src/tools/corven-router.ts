/**
 * corven_router — Multicall Router MCP Tool
 *
 * Batch multiple operations in one transaction. Save gas.
 */
import { z } from "zod";
import { isAddress, parseEther, type Address } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { parseContractError, formatStructuredError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ROUTER_ABI = loadAbi("COVENANTRouter");

// ─── Input Schemas ───────────────────────────────────────────

const multicallSchema = z.object({
  calls: z
    .array(
      z.object({
        target: z.string().describe("Contract address"),
        data: z.string().describe("Encoded calldata"),
        value: z.string().optional().describe("ETH value to send"),
      })
    )
    .min(1)
    .max(10)
    .describe("Calls to batch (max 10)"),
});

const quickstartSchema = z.object({
  name: z.string().min(1).max(100).describe("Agent name for registration"),
  capabilities: z.array(z.string()).min(1).describe("Capability tags"),
  worker: z.string().describe("Worker address"),
  payment: z.string().describe("Payment in ETH (decimal string)"),
  deadline: z.number().int().positive().describe("Unix timestamp deadline"),
  descriptionHash: z.string().min(1).describe("IPFS CID for task description"),
});

// ─── Tool Registration ───────────────────────────────────────

export function registerRouterTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────
  // corven_router — action: multicall
  // ──────────────────────────────────────────────────────────
  server.registerTool(
    "corven_router",
    {
      title: "Multicall Router",
      description:
        "Batch multiple contract calls in one transaction via COVENANTRouter.\n" +
        "ACTIONS:\n" +
        "  multicall   — Execute 2-10 contract calls atomically. Each call needs target (address), data (hex calldata), and optional value.\n" +
        "  quickstart  — Register as agent AND create a task in a single transaction. One-shot for fresh wallets.\n" +
        "WORKFLOW: Encode your calls, then batch them here. Up to 10 calls per batch.\n" +
        "WHEN TO USE: When you need multiple on-chain state changes to happen atomically, or to save gas on multiple sequential operations.",
      inputSchema: {
        action: z.enum(["multicall", "quickstart"]).describe("Router action"),
        calls: z.array(z.object({
          target: z.string().describe("Contract address"),
          data: z.string().describe("Encoded calldata"),
          value: z.string().optional().describe("ETH value"),
        })).optional().describe("Calls to batch (for multicall)"),
        name: z.string().optional().describe("Agent name (for quickstart)"),
        capabilities: z.array(z.string()).optional().describe("Capability tags (for quickstart)"),
        worker: z.string().optional().describe("Worker address (for quickstart)"),
        payment: z.string().optional().describe("Payment in ETH (for quickstart)"),
        deadline: z.number().optional().describe("Unix timestamp deadline (for quickstart)"),
        descriptionHash: z.string().optional().describe("IPFS CID (for quickstart)"),
      },
    },
    async (params) => {
      try {
        const { action } = params as { action: string };
        const account = getAccount();
        if (!account) return formatStructuredError("No wallet configured.", "Set PRIVATE_KEY in .env.", "Add PRIVATE_KEY to mcp/.env", false);

        switch (action) {
          case "multicall": {
            const parsed = multicallSchema.safeParse({ calls: params.calls });
            if (!parsed.success) {
              return formatStructuredError(
                "Invalid input for multicall.",
                parsed.error.issues.map((e) => e.message).join("; "),
                "Provide calls as array with target, data, and optional value.",
                true
              );
            }
            const { calls } = parsed.data;
            const totalValue = calls.reduce((sum, c) => sum + parseFloat(c.value || "0"), 0);

            const result = await executeOrPrepare(
              CONTRACTS.COVENANTRouter as Address,
              ROUTER_ABI,
              "multicall",
              [
                calls.map((c) => ({
                  target: c.target as Address,
                  data: c.data as `0x${string}`,
                  value: BigInt(c.value || "0"),
                })),
              ],
              totalValue > 0 ? parseEther(String(totalValue)) : undefined
            );

            return formatTxResult(result);
          }

          case "quickstart": {
            const parsed = quickstartSchema.safeParse({
              name: params.name,
              capabilities: params.capabilities,
              worker: params.worker,
              payment: params.payment,
              deadline: params.deadline,
              descriptionHash: params.descriptionHash,
            });
            if (!parsed.success) {
              return formatStructuredError(
                "Invalid input for quickstart.",
                parsed.error.issues.map((e) => e.message).join("; "),
                "Provide name, capabilities, worker, payment, deadline, descriptionHash.",
                true
              );
            }
            const { name, capabilities, worker, payment, deadline, descriptionHash } = parsed.data;

            const result = await executeOrPrepare(
              CONTRACTS.COVENANTRouter as Address,
              ROUTER_ABI,
              "registerAndCreateTask",
              [
                name,
                capabilities,
                worker as Address,
                BigInt(payment),
                BigInt(deadline),
                descriptionHash,
              ],
              parseEther(payment)
            );

            return formatTxResult(result);
          }

          default:
            return formatStructuredError(
              `Unknown action: ${action}`,
              "Valid actions: multicall, quickstart",
              "Pass action as 'multicall' or 'quickstart'.",
              true
            );
        }
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
