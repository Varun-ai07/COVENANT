/**
 * corven_wallet — Smart wallet (ERC-4337)
 *
 * Consolidates: corven_create_smart_wallet, corven_get_smart_wallet,
 *               corven_set_spending_limit, corven_set_recipient,
 *               corven_emergency_pause
 */
import { z } from "zod";
import { parseEther, formatEther, type Address } from "viem";
import { getAccount, getWalletClient, getPublicClient, getExplorerTxUrl } from "../config.js";
import { formatReadResult } from "../handlers/transactions.js";
import { formatSuccess, formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TxResult } from "../types.js";
import fs from "node:fs";
import path from "node:path";

const AgentSmartWalletAbi = [
  { type: "constructor", inputs: [
    { name: "_controller", type: "address" },
    { name: "_dailyLimit", type: "uint256" },
    { name: "_perTxLimit", type: "uint256" },
  ], stateMutability: "nonpayable" },
  { type: "receive", stateMutability: "payable" },
  { type: "function", name: "controller", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "dailyLimit", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "perTxLimit", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "dailySpent", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "lastResetDay", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "paused", inputs: [], outputs: [{ type: "bool" }], stateMutability: "view" },
  { type: "function", name: "allowedRecipients", inputs: [{ name: "", type: "address" }], outputs: [{ type: "bool" }], stateMutability: "view" },
  { type: "function", name: "owner", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "getRemainingDailyAllowance", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getBalance", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "execute", inputs: [
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "data", type: "bytes" },
  ], outputs: [{ name: "result", type: "bytes" }], stateMutability: "nonpayable" },
  { type: "function", name: "setDailyLimit", inputs: [{ name: "_limit", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "setPerTxLimit", inputs: [{ name: "_limit", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "setRecipient", inputs: [
    { name: "_recipient", type: "address" },
    { name: "_allowed", type: "bool" },
  ], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "setPaused", inputs: [{ name: "_paused", type: "bool" }], outputs: [], stateMutability: "nonpayable" },
] as const;

function loadSmartWalletBytecode(): `0x${string}` {
  const candidates = [
    path.resolve(process.cwd(), "../contracts/artifacts/contracts/v2/core/AgentSmartWallet.sol/AgentSmartWallet.json"),
    path.resolve(process.cwd(), "contracts/artifacts/contracts/v2/core/AgentSmartWallet.sol/AgentSmartWallet.json"),
  ];
  for (const artifactPath of candidates) {
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
      return artifact.bytecode;
    }
  }
  throw new Error("AgentSmartWallet artifact not found. Run: cd contracts && npx hardhat compile");
}

async function deploySmartWallet(controller: Address, dailyLimitWei: bigint, perTxLimitWei: bigint): Promise<TxResult> {
  const wallet = getWalletClient();
  const publicClient = getPublicClient();
  const account = getAccount();
  if (!wallet || !account) {
    return { status: "error", error: "No wallet client available. Set up a wallet in autonomous mode." };
  }
  try {
    const bytecode = loadSmartWalletBytecode();
    const hash = await wallet.deployContract({
      abi: AgentSmartWalletAbi as any, bytecode, args: [controller, dailyLimitWei, perTxLimitWei], account,
    });
    console.error(`[TX] Deploy AgentSmartWallet: ${hash}`);
    console.error(`[TX] Explorer: ${getExplorerTxUrl(hash)}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
    return { status: "success", txHash: hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed };
  } catch (error: any) {
    return { status: "error", error: (error?.message || String(error)).slice(0, 500) };
  }
}

async function executeWalletWrite(walletAddress: Address, functionName: string, args: readonly unknown[]): Promise<TxResult> {
  const wallet = getWalletClient();
  const publicClient = getPublicClient();
  const account = getAccount();
  if (!wallet || !account) {
    return { status: "error", error: "No wallet client available. Set up a wallet in autonomous mode." };
  }
  try {
    const { request } = await publicClient.simulateContract({
      address: walletAddress, abi: AgentSmartWalletAbi as any, functionName, args: args as any, account,
    });
    const hash = await wallet.writeContract(request);
    console.error(`[TX] ${functionName}: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
    return { status: "success", txHash: hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed };
  } catch (error: any) {
    const msg = error?.message || String(error);
    const revertMatch = msg.match(/revert(?:ed| reason)?\s*:?\s*"?([^"\n]+)"?/i);
    return { status: "error", error: revertMatch ? `Transaction reverted: ${revertMatch[1]}` : msg.slice(0, 500), reason: msg };
  }
}

function txErrorMessage(result: TxResult): string {
  if (result.status === "error") return result.error;
  if (result.status === "prepared") return "Transaction prepared but not sent (prepare-only mode).";
  return "Unknown error.";
}

const actionSchema = z.enum([
  "create", "get", "limit", "recipient", "pause",
]);

const schema = z.object({
  action: actionSchema,
  walletAddress: z.string().optional(),
  controller: z.string().optional(),
  dailyLimit: z.string().optional(),
  perTxLimit: z.string().optional(),
  recipient: z.string().optional(),
  allowed: z.boolean().optional(),
  paused: z.boolean().optional(),
  confirm: z.boolean().optional().default(false).describe('Set to true to execute. Without this, shows what will happen.'),
});

export function registerWalletTools(server: McpServer): void {
  server.registerTool(
    "corven_wallet",
    {
      title: "Smart Wallet Manager",
      description:
        "Programmable ERC-4337 smart wallet with spending limits and whitelists on COVENANT.\n\n" +
        "ACTIONS:\n" +
        "  create — Deploy a new smart wallet (requires controller, dailyLimit, perTxLimit)\n" +
        "  get — Get wallet details and limits (requires walletAddress)\n" +
        "  limit — Set spending limits (requires walletAddress, dailyLimit and/or perTxLimit)\n" +
        "  recipient — Manage recipient whitelist (requires walletAddress, recipient, allowed)\n" +
        "  pause — Emergency pause/unpause (requires walletAddress, paused)\n\n" +
        "WORKFLOW: create → limit (set guardrails) → recipient (whitelist targets) → agent executes within limits\n" +
        "NOTE: Only the controller (human) can set limits, manage whitelist, and pause. The agent (owner) executes within constraints.\n\n" +
        "WHEN TO USE: When you need guardrails on agent spending — daily limits, per-tx caps, and whitelisted recipients.\n\n" +
        "NEXT STEP: Set spending limits with corven_wallet({ action: 'limit' })\n\n" +
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

        if (action === "create") {
          if (!args.controller || !args.dailyLimit || !args.perTxLimit) {
            return formatStructuredError("Missing required fields.", "create requires controller, dailyLimit, and perTxLimit.", "Provide all three parameters.", false);
          }
          const account = getAccount();
          if (!account) {
            return formatStructuredError("No private key configured.", "Wallet not configured.", "Set up a wallet to perform write operations.", false);
          }
          const dailyLimitWei = parseEther(args.dailyLimit);
          const perTxLimitWei = parseEther(args.perTxLimit);
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Deploy new AgentSmartWallet",
              cost: "Gas only (contract deployment)",
              reason: "Creates a new smart wallet with spending limits",
              toProceed: "Call corven_wallet again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }

          const result = await deploySmartWallet(args.controller as Address, dailyLimitWei, perTxLimitWei);
          if (result.status === "success") {
            const publicClient = getPublicClient();
            const receipt = await publicClient.getTransactionReceipt({ hash: result.txHash });
            return formatSuccess(
              "AgentSmartWallet deployed. Agent = owner, human = controller.",
              { walletAddress: receipt.contractAddress || "Check Basescan", owner: account.address, controller: args.controller, dailyLimit: `${args.dailyLimit} ETH`, perTxLimit: `${args.perTxLimit} ETH` },
              result.txHash,
              ["Call corven_wallet({ action: 'recipient', walletAddress, recipient, allowed: true }) to whitelist payment targets.", "Call corven_wallet({ action: 'limit', walletAddress, dailyLimit, perTxLimit }) to adjust limits."]
            );
          }
          return { content: [{ type: "text" as const, text: `Deployment failed: ${txErrorMessage(result)}` }], isError: true };
        }

        if (action === "get") {
          if (!args.walletAddress) {
            return formatStructuredError("Missing required field.", "get requires walletAddress.", "Provide the wallet address.", false);
          }
          const publicClient = getPublicClient();
          const addr = args.walletAddress as Address;
          const [owner, controller, dailyLimit, perTxLimit, dailySpent, lastResetDay, paused, balance, remainingAllowance] =
            await Promise.all([
              publicClient.readContract({ address: addr, abi: AgentSmartWalletAbi as any, functionName: "owner" }),
              publicClient.readContract({ address: addr, abi: AgentSmartWalletAbi as any, functionName: "controller" }),
              publicClient.readContract({ address: addr, abi: AgentSmartWalletAbi as any, functionName: "dailyLimit" }),
              publicClient.readContract({ address: addr, abi: AgentSmartWalletAbi as any, functionName: "perTxLimit" }),
              publicClient.readContract({ address: addr, abi: AgentSmartWalletAbi as any, functionName: "dailySpent" }),
              publicClient.readContract({ address: addr, abi: AgentSmartWalletAbi as any, functionName: "lastResetDay" }),
              publicClient.readContract({ address: addr, abi: AgentSmartWalletAbi as any, functionName: "paused" }),
              publicClient.readContract({ address: addr, abi: AgentSmartWalletAbi as any, functionName: "getBalance" }),
              publicClient.readContract({ address: addr, abi: AgentSmartWalletAbi as any, functionName: "getRemainingDailyAllowance" }),
            ]);
          return formatReadResult({
            walletAddress: args.walletAddress, owner, controller,
            dailyLimit: formatEther(dailyLimit as bigint) + " ETH",
            perTxLimit: formatEther(perTxLimit as bigint) + " ETH",
            dailySpent: formatEther(dailySpent as bigint) + " ETH",
            remainingDailyAllowance: formatEther(remainingAllowance as bigint) + " ETH",
            lastResetDay: Number(lastResetDay),
            paused: paused ? "YES" : "NO",
            balance: formatEther(balance as bigint) + " ETH",
          }, `Smart Wallet`);
        }

        if (action === "limit") {
          if (!args.walletAddress) {
            return formatStructuredError("Missing required field.", "limit requires walletAddress.", "Provide the wallet address.", false);
          }
          if (!args.dailyLimit && !args.perTxLimit) {
            return formatStructuredError("No limits provided.", "At least one of dailyLimit or perTxLimit must be specified.", "Provide at least one limit.", false);
          }
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Update spending limits on wallet",
              cost: "Gas only",
              reason: "Changes daily and/or per-transaction spending caps",
              toProceed: "Call corven_wallet again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const results: string[] = [];
          if (args.dailyLimit) {
            const result = await executeWalletWrite(args.walletAddress as Address, "setDailyLimit", [parseEther(args.dailyLimit)]);
            if (result.status === "success") results.push(`Daily limit set to ${args.dailyLimit} ETH`);
            else return { content: [{ type: "text" as const, text: `Failed: ${result.status === "error" ? result.error : "unknown"}` }], isError: true };
          }
          if (args.perTxLimit) {
            const result = await executeWalletWrite(args.walletAddress as Address, "setPerTxLimit", [parseEther(args.perTxLimit)]);
            if (result.status === "success") results.push(`Per-tx limit set to ${args.perTxLimit} ETH`);
            else return { content: [{ type: "text" as const, text: `Failed: ${result.status === "error" ? result.error : "unknown"}` }], isError: true };
          }
          return formatSuccess("Spending limits updated.", { walletAddress: args.walletAddress, ...(args.dailyLimit && { dailyLimit: `${args.dailyLimit} ETH` }), ...(args.perTxLimit && { perTxLimit: `${args.perTxLimit} ETH` }), changes: results });
        }

        if (action === "recipient") {
          if (!args.walletAddress || !args.recipient || args.allowed === undefined) {
            return formatStructuredError("Missing required fields.", "recipient requires walletAddress, recipient, and allowed.", "Provide all three parameters.", false);
          }
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: args.allowed ? "Whitelist " + args.recipient : "Remove " + args.recipient + " from whitelist",
              cost: "Gas only",
              reason: args.allowed ? "Allows wallet to send funds to this address" : "Revokes wallet permission to send to this address",
              toProceed: "Call corven_wallet again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const result = await executeWalletWrite(args.walletAddress as Address, "setRecipient", [args.recipient as Address, args.allowed]);
          if (result.status === "success") {
            return formatSuccess(
              `Recipient ${args.allowed ? "whitelisted" : "removed"}.`,
              { walletAddress: args.walletAddress, recipient: args.recipient, allowed: args.allowed ? "WHITELISTED" : "REMOVED" },
              result.txHash
            );
          }
          return { content: [{ type: "text" as const, text: `Failed: ${result.status === "error" ? result.error : "unknown"}` }], isError: true };
        }

        if (action === "pause") {
          if (!args.walletAddress || args.paused === undefined) {
            return formatStructuredError("Missing required fields.", "pause requires walletAddress and paused.", "Provide both parameters.", false);
          }
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: args.paused ? "PAUSE wallet" : "UNPAUSE wallet",
              cost: "Gas only",
              reason: args.paused ? "Freezes ALL outbound transfers" : "Allows agent to resume transactions",
              toProceed: "Call corven_wallet again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const result = await executeWalletWrite(args.walletAddress as Address, "setPaused", [args.paused]);
          if (result.status === "success") {
            return formatSuccess(
              args.paused ? "Wallet PAUSED. All outbound transfers frozen." : "Wallet UNPAUSED. Agent can resume transactions.",
              { walletAddress: args.walletAddress, status: args.paused ? "PAUSED" : "ACTIVE" },
              result.txHash
            );
          }
          return { content: [{ type: "text" as const, text: `Failed: ${result.status === "error" ? result.error : "unknown"}` }], isError: true };
        }

        return formatReadResult({ error: "Unknown action" }, "Error");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
