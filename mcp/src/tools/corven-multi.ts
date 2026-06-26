/**
 * corven_multi — Multi-Token Escrow MCP Tool
 *
 * ERC-20 token escrow. Pay with USDC, DAI, USDT instead of ETH.
 */
import { z } from "zod";
import { parseUnits, formatUnits, isAddress, type Address } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { TASK_STATUS } from "../types.js";
import { parseContractError, formatStructuredError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("MultiTokenEscrow");

// Known token addresses (Base Sepolia)
const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e": { symbol: "USDC", decimals: 6 },
  "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb": { symbol: "DAI", decimals: 18 },
  "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2": { symbol: "USDT", decimals: 6 },
};

function getMultiTokenAddress(): Address {
  const addr = CONTRACTS.MultiTokenEscrow;
  if (!addr || addr === "0x0000000000000000000000000000000000000000") {
    throw new Error("MultiTokenEscrow not deployed. Set MULTI_TOKEN_ESCROW env var.");
  }
  return addr;
}

// ─── Input Schemas ───────────────────────────────────────────

const createSchema = z.object({
  worker: z.string().describe("Worker address"),
  payment: z.string().describe("Token amount (e.g. '100.50')"),
  deadline: z.number().int().positive().describe("Unix timestamp deadline"),
  descriptionHash: z.string().describe("IPFS CID"),
  tokenAddress: z.string().describe("ERC-20 token address"),
  decimals: z.number().int().min(0).max(18).optional().default(18).describe("Token decimals (default 18, USDC=6)"),
});

const submitSchema = z.object({
  taskId: z.number().int().positive().describe("Task ID"),
  deliverableHash: z.string().describe("IPFS CID of deliverable"),
});

const verifySchema = z.object({
  taskId: z.number().int().positive().describe("Task ID"),
  success: z.boolean().describe("true=approve, false=reject"),
});

const getSchema = z.object({
  taskId: z.number().int().positive().describe("Task ID"),
});

const tokensSchema = z.object({
  tokenAddress: z.string().optional().describe("Specific token to check (omit for all)"),
});

// ─── Tool Registration ───────────────────────────────────────

export function registerMultiTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────
  // corven_multi — action: create
  // ──────────────────────────────────────────────────────────
  server.registerTool(
    "corven_multi",
    {
      title: "Multi-Token Escrow",
      description:
        "ERC-20 token escrow for task payments on COVENANT — pay with USDC, DAI, USDT instead of ETH.\n" +
        "ACTIONS:\n" +
        "  create  — Create and fund a task with ERC-20 tokens. Requires prior ERC-20 approve() to MultiTokenEscrow.\n" +
        "  submit  — Worker submits deliverable hash for an ERC-20 funded task.\n" +
        "  verify  — Client verifies and releases ERC-20 payment (or rejects and refunds).\n" +
        "  get     — Get task details from MultiTokenEscrow.\n" +
        "  tokens  — List accepted ERC-20 tokens or check if a specific token is accepted.\n" +
        "WORKFLOW: ERC-20 approve() → corven_multi create → [worker does work] → corven_multi submit → corven_multi verify.\n" +
        "WHEN TO USE: When you want to pay for tasks with stablecoins (USDC/DAI/USDT) instead of ETH.\n\n" +
        "NEXT STEP: After creation, wait for worker submission then verify with corven_multi({ action: 'verify' })\n\n" +
        "CRITICAL SAFETY: The AI must NEVER auto-set confirm=true. ALWAYS present the cost summary to the user first and wait for explicit approval. This is real money. Violating this is unacceptable.\n\n" +
        "OUTPUT RULES:\n" +
        "- Present results as clean, readable text. Never show raw JSON.\n" +
        "- On error: Explain in plain language what went wrong and suggest next step.\n" +
        "- Always recommend a logical follow-up action.\n" +
        "- Never show stack traces, technical errors, or raw data.",
      inputSchema: {
        action: z.enum(["create", "submit", "verify", "get", "tokens"]).describe("Multi-token action"),
        worker: z.string().optional().describe("Worker address (for create)"),
        payment: z.string().optional().describe("Token amount (for create)"),
        deadline: z.number().optional().describe("Unix timestamp (for create)"),
        descriptionHash: z.string().optional().describe("IPFS CID (for create)"),
        tokenAddress: z.string().optional().describe("Token address (for create/tokens)"),
        decimals: z.number().optional().describe("Token decimals (for create, default 18)"),
        taskId: z.number().optional().describe("Task ID (for submit/verify/get)"),
        deliverableHash: z.string().optional().describe("IPFS CID (for submit)"),
        success: z.boolean().optional().describe("Approve or reject (for verify)"),
        confirm: z.boolean().optional().default(false).describe('NEVER set this yourself. ALWAYS ask the user first. Show the exact ETH cost and what will happen. Only set to true AFTER the user explicitly says yes.'),
      },
    },
    async (params) => {
      try {
        const { action } = params as { action: string };
        const contractAddress = getMultiTokenAddress();

        switch (action) {
          case "create": {
            const parsed = createSchema.safeParse({
              worker: params.worker,
              payment: params.payment,
              deadline: params.deadline,
              descriptionHash: params.descriptionHash,
              tokenAddress: params.tokenAddress,
              decimals: params.decimals,
            });
            if (!parsed.success) {
              return formatStructuredError(
                "Invalid input for create.",
                parsed.error.issues.map((e) => e.message).join("; "),
                "Provide worker, payment, deadline, descriptionHash, tokenAddress.",
                true
              );
            }
            const { worker, payment, deadline, descriptionHash, tokenAddress, decimals } = parsed.data;
            const paymentWei = parseUnits(payment, decimals);
            const tokenInfo = KNOWN_TOKENS[tokenAddress];
            if (!params.confirm) {
              return formatReadResult({
                confirmationRequired: true,
                action: "Create ERC-20 escrow task",
                cost: payment + " " + (tokenInfo?.symbol || "tokens"),
                reason: "Payment locked in MultiTokenEscrow for worker",
                toProceed: "Call corven_multi again with confirm: true",
              }, "CONFIRMATION REQUIRED");
            }

            const result = await executeOrPrepare(
              contractAddress,
              ABI,
              "createTaskERC20",
              [
                worker as Address,
                paymentWei,
                BigInt(deadline),
                descriptionHash,
                tokenAddress as Address,
              ]
            );

            return formatTxResult(result);
          }

          case "submit": {
            const parsed = submitSchema.safeParse({
              taskId: params.taskId,
              deliverableHash: params.deliverableHash,
            });
            if (!parsed.success) {
              return formatStructuredError(
                "Invalid input for submit.",
                parsed.error.issues.map((e) => e.message).join("; "),
                "Provide taskId and deliverableHash.",
                true
              );
            }
            return formatReadResult({
              info: "Work submission is not available in V5 MultiTokenEscrow.",
              reason: "V5 MultiTokenEscrow uses createTaskERC20 + verifyTask directly. Work submission is handled through the main escrow.",
              taskId: params.taskId,
            }, "Submit Work — Not Available");
          }

          case "verify": {
            const parsed = verifySchema.safeParse({
              taskId: params.taskId,
              success: params.success,
            });
            if (!parsed.success) {
              return formatStructuredError(
                "Invalid input for verify.",
                parsed.error.issues.map((e) => e.message).join("; "),
                "Provide taskId and success (boolean).",
                true
              );
            }
            const { taskId, success } = parsed.data;
            if (!params.confirm) {
              return formatReadResult({
                confirmationRequired: true,
                action: success ? "Approve and release payment for task #" + taskId : "Reject task #" + taskId,
                cost: success ? "ERC-20 payment released to worker" : "No cost (payment refunded)",
                reason: success ? "Approving releases escrowed tokens" : "Rejection refunds tokens to client",
                toProceed: "Call corven_multi again with confirm: true",
              }, "CONFIRMATION REQUIRED");
            }

            const result = await executeOrPrepare(
              contractAddress,
              ABI,
              "verifyTask",
              [BigInt(taskId), success]
            );

            return formatTxResult(result);
          }

          case "get": {
            const parsed = getSchema.safeParse({ taskId: params.taskId });
            if (!parsed.success) {
              return formatStructuredError(
                "Invalid input for get.",
                parsed.error.issues.map((e) => e.message).join("; "),
                "Provide taskId.",
                true
              );
            }
            return formatReadResult({
              info: "Task retrieval is not available in V5 MultiTokenEscrow.",
              reason: "V5 MultiTokenEscrow does not have a getTask function. Use the main escrow (corven_task) to get task details.",
              taskId: params.taskId,
            }, "Get Task — Not Available");
          }

          case "tokens": {
            const parsed = tokensSchema.safeParse({ tokenAddress: params.tokenAddress });
            if (!parsed.success) {
              return formatStructuredError(
                "Invalid input for tokens.",
                parsed.error.issues.map((e) => e.message).join("; "),
                "Provide optional tokenAddress.",
                true
              );
            }
            const { tokenAddress } = parsed.data;

            if (tokenAddress) {
              if (!isAddress(tokenAddress as Address)) {
                return formatStructuredError("Invalid token address.", "Must be a valid 42-char address.", "Check the token address format.", true);
              }
              const accepted = await readContract(contractAddress, ABI, "acceptedTokens", [tokenAddress as Address]);
              const known = KNOWN_TOKENS[tokenAddress];
              return formatReadResult(
                {
                  tokenAddress,
                  symbol: known?.symbol || "Unknown",
                  isAccepted: accepted,
                },
                `Token Check: ${known?.symbol || tokenAddress}`
              );
            }

            // Check all common tokens
            const results: Record<string, { symbol: string; isAccepted: boolean }> = {};
            for (const [addr, info] of Object.entries(KNOWN_TOKENS)) {
              const accepted = await readContract(contractAddress, ABI, "acceptedTokens", [addr as Address]);
              results[addr] = { symbol: info.symbol, isAccepted: !!accepted };
            }
            return formatReadResult(results, "Accepted ERC-20 Tokens");
          }

          default:
            return formatStructuredError(
              `Unknown action: ${action}`,
              "Valid actions: create, submit, verify, get, tokens",
              "Pass action as one of: create, submit, verify, get, tokens.",
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
