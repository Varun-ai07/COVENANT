/**
 * MultiTokenEscrow MCP Tools
 *
 * create_task_erc20   — Create and fund a task with ERC-20 token
 * get_accepted_tokens — List accepted ERC-20 tokens
 * set_accepted_token  — Add/remove accepted token (owner only)
 * get_multi_task      — Get task details from MultiTokenEscrow
 */
import { z } from "zod";
import { parseUnits, formatUnits, isAddress, type Address } from "viem";
import { loadAbi, CONTRACTS } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult, formatError } from "../handlers/transactions.js";
import { TASK_STATUS } from "../types.js";
import { ethAddress, ipfsCid, unixDeadline, taskId as taskIdSchema } from "../lib/schemaHelpers.js";
import { parseContractError, formatStructuredError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("MultiTokenEscrow");

// ---- Input schemas ----

const createTaskERC20Schema = z.object({
  worker: ethAddress,
  payment: z.string().regex(/^\d+(\.\d{1,18})?$/, "Invalid token amount format"),
  deadline: unixDeadline
    .refine(val => {
      const ms = val * 1000;
      const now = Date.now();
      return ms > now && ms < now + 365 * 24 * 60 * 60 * 1000;
    }, { message: "Deadline must be a future timestamp within 1 year" }),
  descriptionHash: ipfsCid,
  tokenAddress: ethAddress,
  decimals: z.number().int().min(0).max(18).default(18),
});

const setAcceptedTokenSchema = z.object({
  tokenAddress: ethAddress,
  accepted: z.boolean(),
});

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

// ---- Registration ----

export function registerMultiTokenTools(server: McpServer): void {
  // 1. Create ERC20 task
  server.tool(
    "corven_create_task_erc20",
    "Create and fund a task using ERC-20 tokens (USDC, DAI, USDT). Requires prior approval.\n" +
    "USE WHEN: You want to pay for a task with an ERC-20 stablecoin instead of ETH.\n" +
    "REQUIRES: MultiTokenEscrow contract deployed (MULTI_TOKEN_ESCROW env var). Worker must be a registered agent. You must have approved the MultiTokenEscrow contract to spend your tokens (ERC-20 approve). Sufficient token balance.\n" +
    "RETURNS: Transaction result with tx hash and Basescan link.\n" +
    "COMES BEFORE: corven_submit_work (worker submits deliverables), corven_verify_task (you verify and release payment).\n" +
    "COMES AFTER: ERC-20 approve() call on the token contract granting MultiTokenEscrow spending rights.\n" +
    "NOTE: Token amount is human-readable (e.g. '100.50' not wei). Decimals default to 18; USDC uses 6.",
    {
      worker: ethAddress,
      payment: z.string().describe("Token amount (human-readable, e.g. '100.50')"),
      deadline: unixDeadline,
      descriptionHash: ipfsCid,
      tokenAddress: ethAddress,
      decimals: z.number().optional().default(18).describe("Token decimals (default 18, USDC=6)"),
    },
    async ({ worker, payment, deadline, descriptionHash, tokenAddress, decimals }) => {
      try {
        const parsed = createTaskERC20Schema.parse({
          worker, payment, deadline, descriptionHash, tokenAddress, decimals,
        });
        const contractAddress = getMultiTokenAddress();
        const paymentWei = parseUnits(parsed.payment, parsed.decimals);

        const result = await executeOrPrepare(
          contractAddress,
          ABI,
          "createAndFundTaskERC20",
          [
            parsed.worker as Address,
            paymentWei,
            BigInt(parsed.deadline),
            parsed.descriptionHash,
            parsed.tokenAddress as Address,
          ],
        );
        return formatTxResult(result);
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    },
  );

  // 2. Get accepted tokens
  server.tool(
    "corven_get_accepted_tokens",
    "Check which ERC-20 tokens are accepted by MultiTokenEscrow. Pass a token address to check if it's accepted, or omit to check common tokens.\n" +
    "USE WHEN: You want to know which ERC-20 tokens can be used for task payments, or verify a specific token is whitelisted.\n" +
    "REQUIRES: MultiTokenEscrow contract deployed.\n" +
    "RETURNS: If tokenAddress given: {tokenAddress, symbol, isAccepted}. If omitted: array of common tokens (USDC, DAI, USDT) with their acceptance status.\n" +
    "COMES BEFORE: corven_create_task_erc20 (confirm token is accepted before creating a task).\n" +
    "COMES AFTER: Nothing — standalone read.",
    {
      tokenAddress: ethAddress.optional().describe("Specific token address to check (optional)"),
    },
    async ({ tokenAddress }) => {
      try {
        const contractAddress = getMultiTokenAddress();

        if (tokenAddress) {
          if (!isAddress(tokenAddress as Address)) {
            return { content: [{ type: "text" as const, text: "Invalid token address" }], isError: true };
          }
          const accepted = await readContract(
            contractAddress,
            ABI,
            "acceptedTokens",
            [tokenAddress as Address],
          );
          const known = KNOWN_TOKENS[tokenAddress];
          return formatReadResult({
            tokenAddress,
            symbol: known?.symbol || "Unknown",
            isAccepted: accepted,
          });
        }

        // Check all common tokens
        const results: Record<string, { symbol: string; isAccepted: boolean }> = {};
        for (const [addr, info] of Object.entries(KNOWN_TOKENS)) {
          const accepted = await readContract(
            contractAddress,
            ABI,
            "acceptedTokens",
            [addr as Address],
          );
          results[addr] = { symbol: info.symbol, isAccepted: !!accepted };
        }
        return formatReadResult(results);
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    },
  );

  // 3. Set accepted token (owner only)
  server.tool(
    "corven_set_accepted_token",
    "Add or remove an ERC-20 token from the accepted tokens list. Owner-only operation.\n" +
    "USE WHEN: You are the contract owner and need to whitelist or blacklist an ERC-20 token for task payments.\n" +
    "REQUIRES: Caller must be the MultiTokenEscrow contract owner. MultiTokenEscrow must be deployed.\n" +
    "RETURNS: Transaction result with tx hash and Basescan link.\n" +
    "COMES BEFORE: corven_create_task_erc20 (token must be accepted before tasks can use it).\n" +
    "COMES AFTER: MultiTokenEscrow deployment.\n" +
    "NOTE: Owner-only operation. Passing accepted=false removes the token from the whitelist.",
    {
      tokenAddress: ethAddress,
      accepted: z.boolean().describe("true to accept, false to remove"),
    },
    async ({ tokenAddress, accepted }) => {
      try {
        const parsed = setAcceptedTokenSchema.parse({ tokenAddress, accepted });
        const contractAddress = getMultiTokenAddress();

        const result = await executeOrPrepare(
          contractAddress,
          ABI,
          "setAcceptedToken",
          [parsed.tokenAddress as Address, parsed.accepted],
        );
        return formatTxResult(result);
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    },
  );

  // 4. Get multi-token task
  server.tool(
    "corven_get_multi_task",
    "Get task details from MultiTokenEscrow by task ID.\n" +
    "USE WHEN: You need to inspect the state of a task funded with ERC-20 tokens.\n" +
    "REQUIRES: MultiTokenEscrow deployed. Valid task ID (returned by corven_create_task_erc20).\n" +
    "RETURNS: Task details from the MultiTokenEscrow contract.\n" +
    "COMES BEFORE: corven_verify_task or corven_dispute_task (check task state before acting).\n" +
    "COMES AFTER: corven_create_task_erc20.",
    {
      taskId: taskIdSchema,
    },
    async ({ taskId }) => {
      try {
        const contractAddress = getMultiTokenAddress();
        const task = await readContract(
          contractAddress,
          ABI,
          "getTask",
          [BigInt(taskId)],
        );

        if (!task) {
          return { content: [{ type: "text" as const, text: `Task ${taskId} not found` }], isError: true };
        }

        const [client, worker, payment, deadline, descriptionHash, deliverableHash, status, createdAt, completedAt, token] = task as [Address, Address, bigint, bigint, string, string, number, bigint, bigint, Address];

        const isEth = token === "0x0000000000000000000000000000000000000000";
        const decimals = isEth ? 18 : (KNOWN_TOKENS[token]?.decimals ?? 18);
        const symbol = isEth ? "ETH" : (KNOWN_TOKENS[token]?.symbol ?? "Unknown");

        return formatReadResult({
          taskId,
          client,
          worker,
          payment: formatUnits(payment, decimals),
          symbol,
          deadline: Number(deadline),
          descriptionHash,
          deliverableHash,
          status: TASK_STATUS[status as keyof typeof TASK_STATUS] || `Unknown(${status})`,
          statusCode: status,
          createdAt: Number(createdAt),
          completedAt: Number(completedAt),
          token,
          isNativeETH: isEth,
        });
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    },
  );

  // 5. Get task count
  server.tool(
    "corven_get_multi_task_count",
    "Get total number of tasks in MultiTokenEscrow.\n" +
    "USE WHEN: You need to know how many ERC-20 funded tasks exist, or determine the next task ID.\n" +
    "REQUIRES: MultiTokenEscrow deployed.\n" +
    "RETURNS: {taskCount} with the total number of tasks.\n" +
    "COMES BEFORE: corven_get_multi_task (use count-1 as the latest task ID).\n" +
    "COMES AFTER: Nothing — standalone read.",
    {},
    async () => {
      try {
        const contractAddress = getMultiTokenAddress();
        const count = await readContract(contractAddress, ABI, "taskCounter", []);
        return formatReadResult({ taskCount: Number(count) });
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    },
  );

  // 6. Submit work on multi-token task
  server.tool(
    "corven_submit_multi_work",
    "Submit deliverable hash for a MultiTokenEscrow task. Only assigned worker can call.\n" +
    "USE WHEN: You are the assigned worker and have completed work on an ERC-20 funded task.\n" +
    "REQUIRES: Task must be in InProgress status. Caller must be the assigned worker. MultiTokenEscrow deployed.\n" +
    "RETURNS: Transaction result with tx hash and Basescan link.\n" +
    "COMES BEFORE: corven_verify_multi_task (client verifies your deliverable and releases payment).\n" +
    "COMES AFTER: corven_create_task_erc20 (task must exist and be assigned to you).\n" +
    "NOTE: deliverableHash is typically an IPFS CID of your completed work.",
    {
      taskId: taskIdSchema,
      deliverableHash: ipfsCid,
    },
    async ({ taskId, deliverableHash }) => {
      try {
        const contractAddress = getMultiTokenAddress();
        const result = await executeOrPrepare(
          contractAddress,
          ABI,
          "submitWork",
          [BigInt(taskId), deliverableHash],
        );
        return formatTxResult(result);
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    },
  );

  // 7. Verify multi-token task
  server.tool(
    "corven_verify_multi_task",
    "Verify a submitted MultiTokenEscrow task. Only the task client can call. Releases payment on success.\n" +
    "USE WHEN: You are the task client and the worker has submitted a deliverable for an ERC-20 funded task.\n" +
    "REQUIRES: Task must be in Submitted status. Caller must be the task client. MultiTokenEscrow deployed.\n" +
    "RETURNS: Transaction result with tx hash and Basescan link. On success, tokens transfer to worker. On rejection, tokens refund to client.\n" +
    "COMES BEFORE: Nothing — this is the final step of the task lifecycle.\n" +
    "COMES AFTER: corven_submit_multi_work (worker must submit deliverable before you can verify).\n" +
    "NOTE: success=true releases payment to worker. success=false refunds client and marks task as Rejected.",
    {
      taskId: taskIdSchema,
      success: z.boolean().describe("true = approve and pay worker, false = reject and refund client"),
    },
    async ({ taskId, success }) => {
      try {
        const contractAddress = getMultiTokenAddress();
        const result = await executeOrPrepare(
          contractAddress,
          ABI,
          "verifyTask",
          [BigInt(taskId), success],
        );
        return formatTxResult(result);
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    },
  );

  // 8. Get escrowed token balance
  server.tool(
    "corven_get_escrowed_balance",
    "Get total escrowed balance for a specific ERC-20 token in MultiTokenEscrow.\n" +
    "USE WHEN: You want to check how much of a specific ERC-20 token is currently held in escrow across all tasks.\n" +
    "REQUIRES: MultiTokenEscrow deployed. Valid token address.\n" +
    "RETURNS: {tokenAddress, symbol, balance, balanceHuman} with the total escrowed amount.\n" +
    "COMES BEFORE: Financial reporting or liquidity checks.\n" +
    "COMES AFTER: Nothing — standalone read.",
    {
      tokenAddress: ethAddress,
    },
    async ({ tokenAddress }) => {
      try {
        if (!isAddress(tokenAddress as Address)) {
          return { content: [{ type: "text" as const, text: "Invalid token address" }], isError: true };
        }
        const contractAddress = getMultiTokenAddress();
        const balance = await readContract(
          contractAddress,
          ABI,
          "escrowedTokenBalances",
          [tokenAddress as Address],
        );
        const known = KNOWN_TOKENS[tokenAddress];
        const decimals = known?.decimals ?? 18;
        return formatReadResult({
          tokenAddress,
          symbol: known?.symbol || "Unknown",
          balance: formatUnits(balance as bigint, decimals),
          balanceWei: (balance as bigint).toString(),
        });
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    },
  );
}
