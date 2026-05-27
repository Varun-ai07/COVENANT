/**
 * COVENANTRouter MCP Tools
 *
 * Exposes the unified router contract for batch operations
 * (multicall, register+createTask in one tx).
 */
import { z } from "zod";
import { isAddress, parseEther, type Address } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatError } from "../handlers/transactions.js";
import { ethAddress, ethAmount, ipfsCid, unixDeadline } from "../lib/schemaHelpers.js";
import { parseContractError, formatStructuredError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ROUTER_ABI = loadAbi("COVENANTRouter");

// ─── Input Schemas ─────────────────────────────────────────────────

const registerAndCreateTaskSchema = z.object({
  name: z.string().min(1).max(100).describe("Agent name for registration"),
  capabilities: z.array(z.string()).min(1).describe("Capability tags"),
  worker: z.string().refine(isAddress, { message: "Invalid worker address" }).describe("Worker address"),
  payment: z.string().regex(/^\d+\.\d{1,18}$/, "Invalid ETH amount").describe("Payment in ETH"),
  deadline: z.number().int().positive().describe("Unix timestamp deadline"),
  descriptionHash: z.string().min(1).describe("IPFS CID for task description"),
});

// ─── Tool Registration ─────────────────────────────────────────────

export function registerRouterTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // corven_register_and_create_task
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_register_and_create_task",
    {
      title: "Register & Create Task (One-Shot)",
      description:
        "Register as an agent AND create a task in a single transaction. " +
        "Uses COVENANTRouter for gas-efficient batched operations.\n" +
        "USE WHEN: You are a brand-new wallet that needs both agent registration and a task assignment in one atomic call.\n" +
        "REQUIRES: Wallet not already registered on AgentRegistry. Worker must be a registered agent. Sufficient ETH for stake + task payment + gas.\n" +
        "RETURNS: Transaction result containing the registration and task creation in a single tx hash.\n" +
        "COMES BEFORE: corven_submit_work (the assigned worker submits deliverables).\n" +
        "COMES AFTER: Nothing — this is the entry point for a fresh wallet.\n" +
        "NOTE: Uses COVENANTRouter.multicall under the hood. If you are already registered, use corven_create_task instead.",
      inputSchema: {
        name: z.string().describe("Agent name for registration"),
        capabilities: z.array(z.string()).describe("Capability tags"),
        worker: ethAddress,
        payment: ethAmount,
        deadline: unixDeadline,
        descriptionHash: ipfsCid,
      },
    },
    async (params) => {
      try {
        const parsed = registerAndCreateTaskSchema.safeParse(params);
        if (!parsed.success) return formatError(parsed.error);

        const account = getAccount();
        if (!account) return formatError(new Error("No wallet configured."));

        const { name, capabilities, worker, payment, deadline, descriptionHash } = parsed.data;

        const result = await executeOrPrepare(
          CONTRACTS.COVENANTRouter as Address,
          ROUTER_ABI,
          "registerAndCreateTask",
          [name, capabilities, worker as Address, BigInt(payment), BigInt(deadline), descriptionHash],
          parseEther(payment)
        );

        return formatTxResult(result);
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_router_multicall
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_router_multicall",
    {
      title: "Router Multicall",
      description:
        "Execute multiple contract calls in a single transaction via COVENANTRouter. " +
        "Reduces gas costs for batch operations.\n" +
        "USE WHEN: You need to combine 2-10 contract calls (register, create task, approve, etc.) into a single atomic transaction.\n" +
        "REQUIRES: Each call's target must be a valid contract address. Encoded calldata for each call. Wallet must cover total ETH value + gas.\n" +
        "RETURNS: Single transaction result containing all batched calls.\n" +
        "COMES BEFORE: Any operation that depends on multiple onchain state changes completing atomically.\n" +
        "COMES AFTER: Nothing — this is the batch entry point. Use corven_register_and_create_task if you only need registration + task creation.\n" +
        "NOTE: Max 10 calls per batch. Each call object needs target (address), data (hex calldata), and optional value (ETH string).",
      inputSchema: {
        calls: z.array(z.object({
          target: ethAddress.describe("Contract address"),
          data: z.string().describe("Encoded calldata"),
          value: ethAmount.optional().describe("ETH value to send"),
        })).min(1).max(10).describe("Calls to batch"),
      },
    },
    async (params) => {
      try {
        const account = getAccount();
        if (!account) return formatError(new Error("No wallet configured."));

        const calls = params.calls as { target: string; data: string; value?: string }[];
        const totalValue = calls.reduce((sum, c) => sum + parseFloat(c.value || "0"), 0);

        const result = await executeOrPrepare(
          CONTRACTS.COVENANTRouter as Address,
          ROUTER_ABI,
          "multicall",
          [calls.map(c => ({
            target: c.target as Address,
            data: c.data as `0x${string}`,
            value: BigInt(c.value || "0"),
          }))],
          totalValue > 0 ? parseEther(String(totalValue)) : undefined
        );

        return formatTxResult(result);
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
