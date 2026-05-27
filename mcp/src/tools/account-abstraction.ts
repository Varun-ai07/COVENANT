/**
 * Account Abstraction MCP Tools
 *
 * corven_create_smart_wallet   — Deploy a new AgentSmartWallet
 * corven_get_smart_wallet      — Get wallet details (limits, pause, balance)
 * corven_set_spending_limit    — Controller sets daily/tx limits
 * corven_set_recipient         — Controller manages whitelist
 * corven_emergency_pause       — Controller pauses/unpauses
 */
import { z } from "zod";
import { parseEther, formatEther, type Address } from "viem";
import { getAccount, getWalletClient, getPublicClient, getExplorerTxUrl } from "../config.js";
import { formatReadResult } from "../handlers/transactions.js";
import { formatSuccess, formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import { ethAddress, ethAmount } from "../lib/schemaHelpers.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TxResult } from "../types.js";
import fs from "node:fs";
import path from "node:path";

// ─── Inline ABI for AgentSmartWallet ──────────────────────────
// Matches the Solidity contract at contracts/v2/core/AgentSmartWallet.sol

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
  { type: "function", name: "setController", inputs: [{ name: "_controller", type: "address" }], outputs: [], stateMutability: "nonpayable" },
] as const;

// ─── Bytecode loader ──────────────────────────────────────────

function loadSmartWalletBytecode(): `0x${string}` {
  // Resolve from the MCP package root
  const candidates = [
    // Relative to this source file (mcp/src/tools -> mcp -> contracts)
    path.resolve(process.cwd(), "../contracts/artifacts/contracts/v2/core/AgentSmartWallet.sol/AgentSmartWallet.json"),
    // Absolute project layout
    path.resolve(process.cwd(), "contracts/artifacts/contracts/v2/core/AgentSmartWallet.sol/AgentSmartWallet.json"),
  ];

  for (const artifactPath of candidates) {
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
      return artifact.bytecode;
    }
  }

  throw new Error(
    "AgentSmartWallet artifact not found. Run: cd /home/vxrun/Projects/varun/contracts && npx hardhat compile"
  );
}

// ─── Deploy helper ────────────────────────────────────────────

async function deploySmartWallet(
  controller: Address,
  dailyLimitWei: bigint,
  perTxLimitWei: bigint
): Promise<TxResult> {
  const wallet = getWalletClient();
  const publicClient = getPublicClient();
  const account = getAccount();

  if (!wallet || !account) {
    return { status: "error", error: "No wallet client available. Set PRIVATE_KEY and COVENANT_WALLET_MODE=autonomous." };
  }

  try {
    const bytecode = loadSmartWalletBytecode();

    const hash = await wallet.deployContract({
      abi: AgentSmartWalletAbi as any,
      bytecode,
      args: [controller, dailyLimitWei, perTxLimitWei],
      account,
    });

    console.error(`[TX] Deploy AgentSmartWallet: ${hash}`);
    console.error(`[TX] Explorer: ${getExplorerTxUrl(hash)}`);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      timeout: 60_000,
    });

    return {
      status: "success",
      txHash: hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
    };
  } catch (error: any) {
    const msg = error?.message || String(error);
    return { status: "error", error: msg.slice(0, 500) };
  }
}

// ─── Write helper (for existing contracts) ────────────────────

async function executeWalletWrite(
  walletAddress: Address,
  functionName: string,
  args: readonly unknown[]
): Promise<TxResult> {
  const wallet = getWalletClient();
  const publicClient = getPublicClient();
  const account = getAccount();

  if (!wallet || !account) {
    return { status: "error", error: "No wallet client available. Set PRIVATE_KEY and COVENANT_WALLET_MODE=autonomous." };
  }

  try {
    const { request } = await publicClient.simulateContract({
      address: walletAddress,
      abi: AgentSmartWalletAbi as any,
      functionName,
      args: args as any,
      account,
    });

    const hash = await wallet.writeContract(request);

    console.error(`[TX] ${functionName}: ${hash}`);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      timeout: 60_000,
    });

    return {
      status: "success",
      txHash: hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
    };
  } catch (error: any) {
    const msg = error?.message || String(error);
    const revertMatch = msg.match(/revert(?:ed| reason)?\s*:?\s*"?([^"\n]+)"?/i);
    return {
      status: "error",
      error: revertMatch ? `Transaction reverted: ${revertMatch[1]}` : msg.slice(0, 500),
      reason: msg,
    };
  }
}

// ─── Error helper ─────────────────────────────────────────────

function txErrorMessage(result: TxResult): string {
  if (result.status === "error") return result.error;
  if (result.status === "prepared") return "Transaction prepared but not sent (prepare-only mode).";
  return "Unknown error.";
}

// ─── Register tools ───────────────────────────────────────────

export function registerAATools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // corven_create_smart_wallet
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_create_smart_wallet",
    {
      title: "Deploy Smart Wallet",
      description:
        "Deploy a new AgentSmartWallet for the caller. Creates an ERC-4337 compatible smart account with spending limits, recipient whitelist, and emergency pause.\n" +
        "USE WHEN: An agent needs a dedicated smart wallet with safety guardrails. The deployer becomes the owner (agent EOA) and controller (human guardian).\n" +
        "REQUIRES: PRIVATE_KEY set in .env. Wallet needs ~0.001 ETH for gas.\n" +
        "RETURNS: Wallet address, controller, daily limit, per-tx limit, Basescan link.\n" +
        "COMES BEFORE: corven_set_recipient to whitelist payment targets. corven_set_spending_limit to adjust limits.\n" +
        "NOTE: The controller can pause the wallet, change limits, and manage the whitelist. The agent can only execute transactions within the set limits.",
      inputSchema: {
        controller: ethAddress.describe("Human controller address (can pause, set limits, manage whitelist)"),
        dailyLimit: ethAmount.describe("Daily spending limit in ETH (e.g. '1.0')"),
        perTxLimit: ethAmount.describe("Per-transaction cap in ETH (e.g. '0.1')"),
      },
    },
    async ({ controller, dailyLimit, perTxLimit }) => {
      try {
        const account = getAccount();
        if (!account) {
          return formatStructuredError(
            "No private key configured.",
            "PRIVATE_KEY environment variable is not set.",
            "Set PRIVATE_KEY in your .env file.",
            false
          );
        }

        const dailyLimitWei = parseEther(dailyLimit);
        const perTxLimitWei = parseEther(perTxLimit);

        const result = await deploySmartWallet(
          controller as Address,
          dailyLimitWei,
          perTxLimitWei
        );

        if (result.status === "success") {
          const publicClient = getPublicClient();
          const receipt = await publicClient.getTransactionReceipt({ hash: result.txHash });
          const walletAddr = receipt.contractAddress;

          return formatSuccess(
            `AgentSmartWallet deployed. Agent = owner, human = controller.`,
            {
              walletAddress: walletAddr || "Check Basescan for contract address",
              owner: account.address,
              controller,
              dailyLimit: `${dailyLimit} ETH`,
              perTxLimit: `${perTxLimit} ETH`,
            },
            result.txHash,
            [
              "Call corven_set_recipient to whitelist addresses the wallet can send to.",
              "Call corven_set_spending_limit to adjust daily/tx limits.",
              "The controller can call corven_emergency_pause to freeze the wallet.",
            ]
          );
        }

        return {
          content: [{ type: "text" as const, text: `Deployment failed: ${txErrorMessage(result)}` }],
          isError: true,
        };
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_smart_wallet
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_smart_wallet",
    {
      title: "Get Smart Wallet Details",
      description:
        "Read all details of an AgentSmartWallet: owner, controller, limits, daily spend, pause status, balance.\n" +
        "USE WHEN: Checking current spending limits. Verifying pause status. Checking remaining daily allowance.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Owner, controller, daily limit, per-tx limit, daily spent, remaining allowance, pause status, balance.\n" +
        "NOTE: Daily counter resets at midnight UTC automatically.",
      inputSchema: {
        walletAddress: ethAddress.describe("The AgentSmartWallet contract address"),
      },
    },
    async ({ walletAddress }) => {
      try {
        const publicClient = getPublicClient();
        const addr = walletAddress as Address;

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

        return formatReadResult(
          {
            walletAddress: walletAddress,
            owner,
            controller,
            dailyLimit: formatEther(dailyLimit as bigint) + " ETH",
            perTxLimit: formatEther(perTxLimit as bigint) + " ETH",
            dailySpent: formatEther(dailySpent as bigint) + " ETH",
            remainingDailyAllowance: formatEther(remainingAllowance as bigint) + " ETH",
            lastResetDay: Number(lastResetDay),
            paused: paused ? "YES" : "NO",
            balance: formatEther(balance as bigint) + " ETH",
          },
          `Smart Wallet ${walletAddress}`
        );
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_set_spending_limit
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_set_spending_limit",
    {
      title: "Set Spending Limits",
      description:
        "Controller sets the daily and/or per-transaction spending limits on an AgentSmartWallet.\n" +
        "USE WHEN: The agent needs higher/lower limits. Adjusting guardrails for a specific workload.\n" +
        "REQUIRES: PRIVATE_KEY must be the controller address. Only the human controller can call this.\n" +
        "RETURNS: Updated limits, transaction confirmation.\n" +
        "NOTE: The agent (owner) CANNOT call this -- only the controller can adjust limits.",
      inputSchema: {
        walletAddress: ethAddress.describe("The AgentSmartWallet contract address"),
        dailyLimit: ethAmount.optional().describe("New daily spending limit in ETH (omit to keep current)"),
        perTxLimit: ethAmount.optional().describe("New per-transaction cap in ETH (omit to keep current)"),
      },
    },
    async ({ walletAddress, dailyLimit, perTxLimit }) => {
      try {
        if (!dailyLimit && !perTxLimit) {
          return formatStructuredError(
            "No limits provided.",
            "At least one of dailyLimit or perTxLimit must be specified.",
            "Provide dailyLimit and/or perTxLimit in ETH.",
            false
          );
        }

        const results: string[] = [];

        if (dailyLimit) {
          const result = await executeWalletWrite(
            walletAddress as Address,
            "setDailyLimit",
            [parseEther(dailyLimit)]
          );
          if (result.status === "success") {
            results.push(`Daily limit set to ${dailyLimit} ETH`);
          } else {
            return { content: [{ type: "text" as const, text: `Failed: ${result.status === "error" ? result.error : "unknown error"}` }], isError: true };
          }
        }

        if (perTxLimit) {
          const result = await executeWalletWrite(
            walletAddress as Address,
            "setPerTxLimit",
            [parseEther(perTxLimit)]
          );
          if (result.status === "success") {
            results.push(`Per-tx limit set to ${perTxLimit} ETH`);
          } else {
            return { content: [{ type: "text" as const, text: `Failed: ${result.status === "error" ? result.error : "unknown error"}` }], isError: true };
          }
        }

        return formatSuccess(
          `Spending limits updated.`,
          {
            walletAddress,
            ...(dailyLimit && { dailyLimit: `${dailyLimit} ETH` }),
            ...(perTxLimit && { perTxLimit: `${perTxLimit} ETH` }),
            changes: results,
          }
        );
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_set_recipient
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_set_recipient",
    {
      title: "Manage Recipient Whitelist",
      description:
        "Controller adds or removes an address from the wallet's recipient whitelist. The agent can only send ETH to whitelisted addresses.\n" +
        "USE WHEN: Whitelisting a new payment target (e.g., a worker agent, a contract). Removing a compromised address.\n" +
        "REQUIRES: PRIVATE_KEY must be the controller address. Only the human controller can call this.\n" +
        "RETURNS: Recipient address, allowed status, transaction confirmation.\n" +
        "NOTE: Without whitelisting, the agent's execute() calls will revert with 'Recipient not whitelisted'.",
      inputSchema: {
        walletAddress: ethAddress.describe("The AgentSmartWallet contract address"),
        recipient: ethAddress.describe("Address to add/remove from whitelist"),
        allowed: z.boolean().describe("true = add to whitelist, false = remove from whitelist"),
      },
    },
    async ({ walletAddress, recipient, allowed }) => {
      try {
        const result = await executeWalletWrite(
          walletAddress as Address,
          "setRecipient",
          [recipient as Address, allowed]
        );

        if (result.status === "success") {
          return formatSuccess(
            `Recipient ${allowed ? "whitelisted" : "removed"}.`,
            {
              walletAddress,
              recipient,
              allowed: allowed ? "WHITELISTED" : "REMOVED",
            },
            result.txHash
          );
        }
        return { content: [{ type: "text" as const, text: `Failed: ${result.status === "error" ? result.error : "unknown error"}` }], isError: true };
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_emergency_pause
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_emergency_pause",
    {
      title: "Emergency Pause/Unpause",
      description:
        "Controller pauses or unpauses the AgentSmartWallet. When paused, all execute() calls revert -- the agent cannot send any ETH.\n" +
        "USE WHEN: Suspecting the agent is compromised. Pre-maintenance freeze. Unpausing after resolving an incident.\n" +
        "REQUIRES: PRIVATE_KEY must be the controller address. Only the human controller can call this.\n" +
        "RETURNS: Pause status, transaction confirmation.\n" +
        "NOTE: This is an emergency safety mechanism. The agent cannot unpause itself.",
      inputSchema: {
        walletAddress: ethAddress.describe("The AgentSmartWallet contract address"),
        paused: z.boolean().describe("true = pause (freeze), false = unpause (resume)"),
      },
    },
    async ({ walletAddress, paused }) => {
      try {
        const result = await executeWalletWrite(
          walletAddress as Address,
          "setPaused",
          [paused]
        );

        if (result.status === "success") {
          return formatSuccess(
            paused
              ? "Wallet PAUSED. All outbound transfers are frozen."
              : "Wallet UNPAUSED. Agent can resume transactions.",
            {
              walletAddress,
              status: paused ? "PAUSED" : "ACTIVE",
            },
            result.txHash
          );
        }
        return { content: [{ type: "text" as const, text: `Failed: ${result.status === "error" ? result.error : "unknown error"}` }], isError: true };
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
