/**
 * Cross-Chain Bridge MCP Tools
 *
 * corven_bridge_estimate       — Estimate cross-chain bridge cost and time
 * corven_bridge_status         — Check status of a cross-chain bridge transaction
 * corven_get_bridge_chains     — List chains available for bridging
 */
import { z } from "zod";
import { formatReadResult, formatError } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ─── Chain Registry ────────────────────────────────────────────────

interface BridgeChain {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  bridgeUrl: string;
  estimatedTime: string;
  nativeToken: string;
}

const BRIDGE_CHAINS: BridgeChain[] = [
  {
    chainId: 84532,
    name: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    explorerUrl: "https://sepolia.basescan.org",
    bridgeUrl: "https://sepolia-bridge.base.org",
    estimatedTime: "~2 minutes",
    nativeToken: "ETH",
  },
  {
    chainId: 8453,
    name: "Base Mainnet",
    rpcUrl: "https://mainnet.base.org",
    explorerUrl: "https://basescan.org",
    bridgeUrl: "https://bridge.base.org",
    estimatedTime: "~2 minutes",
    nativeToken: "ETH",
  },
  {
    chainId: 137,
    name: "Polygon",
    rpcUrl: "https://polygon-rpc.com",
    explorerUrl: "https://polygonscan.com",
    bridgeUrl: "https://portal.polygon.technology/bridge",
    estimatedTime: "~7 minutes",
    nativeToken: "MATIC",
  },
  {
    chainId: 42161,
    name: "Arbitrum One",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    explorerUrl: "https://arbiscan.io",
    bridgeUrl: "https://bridge.arbitrum.io",
    estimatedTime: "~10 minutes",
    nativeToken: "ETH",
  },
];

function findChain(chainId: number): BridgeChain | undefined {
  return BRIDGE_CHAINS.find((c) => c.chainId === chainId);
}

// ─── Tool Registration ─────────────────────────────────────────────

export function registerBridgeTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // corven_bridge_estimate
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_bridge_estimate",
    {
      title: "Estimate Cross-Chain Bridge",
      description:
        "Estimate the cost and time for bridging assets between supported chains.\n" +
        "USE WHEN: Planning a cross-chain transfer, comparing bridge options, or budgeting for gas fees.\n" +
        "REQUIRES: Source chain ID, destination chain ID, and the amount to bridge.\n" +
        "RETURNS: Estimated bridge time, bridge URL, gas estimates, and route notes.\n" +
        "NOTE: Estimates are approximations. For production, integrate with LiFi or Socket API for real quotes.",
      inputSchema: {
        fromChain: z.number().describe("Source chain ID (e.g., 84532 for Base Sepolia, 8453 for Base Mainnet)"),
        toChain: z.number().describe("Destination chain ID (e.g., 137 for Polygon, 42161 for Arbitrum One)"),
        amount: z.string().describe("Amount to bridge in native token (e.g., '0.1' for 0.1 ETH)"),
      },
    },
    async (params) => {
      try {
        const { fromChain, toChain, amount } = params as { fromChain: number; toChain: number; amount: string };

        const from = findChain(fromChain);
        const to = findChain(toChain);

        const errors: string[] = [];
        if (!from) errors.push(`Source chain ${fromChain} is not supported.`);
        if (!to) errors.push(`Destination chain ${toChain} is not supported.`);
        if (fromChain === toChain) errors.push("Source and destination chains must be different.");
        if (errors.length > 0) {
          return formatReadResult(
            {
              error: errors.join(" "),
              supportedChains: BRIDGE_CHAINS.map((c) => ({ chainId: c.chainId, name: c.name })),
            },
            "Bridge Estimate Error"
          );
        }

        const estimatedMinutes = from!.chainId === 84532 || from!.chainId === 8453 ? 2 : from!.chainId === 137 ? 7 : 10;
        const destMinutes = to!.chainId === 84532 || to!.chainId === 8453 ? 2 : to!.chainId === 137 ? 7 : 10;
        const totalTime = `${Math.max(estimatedMinutes, destMinutes)}-${Math.max(estimatedMinutes, destMinutes) + 3} minutes`;

        const queryParams = new URLSearchParams({
          from_chain: String(fromChain),
          to_chain: String(toChain),
          amount,
          token: from!.nativeToken,
        });

        const bridgeUrl = `${from!.bridgeUrl}?${queryParams.toString()}`;

        return formatReadResult(
          {
            from: { chainId: fromChain, name: from!.name, nativeToken: from!.nativeToken },
            to: { chainId: toChain, name: to!.name, nativeToken: to!.nativeToken },
            amount,
            estimated_time: totalTime,
            bridge_url: bridgeUrl,
            explorer_from: from!.explorerUrl,
            explorer_to: to!.explorerUrl,
            notes: [
              "Estimates based on typical bridge latency for each route.",
              "Actual fees depend on network congestion and bridge provider fees.",
              "For production quotes, integrate LiFi or Socket API.",
            ],
          },
          `Bridge Estimate: ${from!.name} -> ${to!.name}`
        );
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_bridge_status
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_bridge_status",
    {
      title: "Check Bridge Transaction Status",
      description:
        "Check the status of a cross-chain bridge transaction by its source chain tx hash.\n" +
        "USE WHEN: Monitoring a pending bridge, verifying arrival on destination chain, or debugging a stuck bridge.\n" +
        "REQUIRES: The transaction hash on the source chain and the source chain ID.\n" +
        "RETURNS: Transaction status, explorer links for source and destination chains, and estimated completion.\n" +
        "NOTE: For production, query LayerZero or CCIP relayer APIs. Status here is informational.",
      inputSchema: {
        txHash: z.string().describe("Transaction hash of the bridge on the source chain"),
        fromChain: z.number().describe("Chain ID where the bridge transaction was initiated"),
      },
    },
    async (params) => {
      try {
        const { txHash, fromChain } = params as { txHash: string; fromChain: number };

        const from = findChain(fromChain);
        if (!from) {
          return formatReadResult(
            {
              error: `Chain ID ${fromChain} is not supported.`,
              supportedChains: BRIDGE_CHAINS.map((c) => ({ chainId: c.chainId, name: c.name })),
            },
            "Bridge Status Error"
          );
        }

        return formatReadResult(
          {
            tx_hash: txHash,
            source_chain: { chainId: fromChain, name: from.name },
            status: "pending_review",
            source_explorer: `${from.explorerUrl}/tx/${txHash}`,
            notes: [
              "Status tracking is informational in this version.",
              "Check the source explorer link above for on-chain confirmation.",
              "For production, integrate with LayerZero relayer API or Chainlink CCIP.",
              `Bridge from ${from.name} typically completes in ${from.estimatedTime}.`,
            ],
          },
          `Bridge Status: ${txHash.slice(0, 10)}...`
        );
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_bridge_chains
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_bridge_chains",
    {
      title: "List Bridge-Supported Chains",
      description:
        "List all chains available for cross-chain bridging in the COVENANT protocol.\n" +
        "USE WHEN: Discovering which chains support bridging, planning cross-chain routes, or checking bridge URLs.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Chain ID, name, native token, estimated bridge time, RPC URL, explorer URL, and bridge URL for each chain.",
      inputSchema: {},
    },
    async () => {
      try {
        return formatReadResult(
          {
            totalChains: BRIDGE_CHAINS.length,
            chains: BRIDGE_CHAINS.map((c) => ({
              chainId: c.chainId,
              name: c.name,
              nativeToken: c.nativeToken,
              estimatedTime: c.estimatedTime,
              rpcUrl: c.rpcUrl,
              explorerUrl: c.explorerUrl,
              bridgeUrl: c.bridgeUrl,
            })),
          },
          "Bridge-Supported Chains"
        );
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
