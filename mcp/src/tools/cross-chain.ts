/**
 * Cross-Chain MCP Tools
 *
 * corven_get_supported_chains — List all supported chains with deployment status
 * corven_get_chain_config    — Get contract addresses and config for a specific chain
 */
import { z } from "zod";
import { CHAIN_CONFIGS, ZERO_ADDRESS } from "@covenant/shared-types";
import { formatReadResult } from "../handlers/transactions.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerCrossChainTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // corven_get_supported_chains
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_supported_chains",
    {
      title: "Get Supported Chains",
      description:
        "Lists all chains where COVENANT can operate, with deployment status for each.\n" +
        "USE WHEN: Checking which chains are available before deploying or bridging. Planning multi-chain rollout.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Chain ID, name, deployment status (deployed/not deployed), block explorer URL for each chain.\n" +
        "NOTE: Only Base Sepolia has live contracts. Other chains show placeholder addresses until deployment.",
      inputSchema: {},
    },
    async () => {
      const chains = Object.entries(CHAIN_CONFIGS).map(([chainId, config]) => {
        const isDeployed = Object.values(config.addresses).some(
          (addr) => addr !== ZERO_ADDRESS
        );
        return {
          chainId: Number(chainId),
          name: config.name,
          deployed: isDeployed,
          explorerUrl: config.explorerUrl,
          contractCount: Object.values(config.addresses).filter(
            (addr) => addr !== ZERO_ADDRESS
          ).length,
        };
      });

      return formatReadResult(
        { totalChains: chains.length, chains },
        "Supported Chains"
      );
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_chain_config
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_chain_config",
    {
      title: "Get Chain Config",
      description:
        "Returns the full contract address set and RPC details for a specific chain.\n" +
        "USE WHEN: Configuring a client/SDK to connect to a specific chain. Looking up deployed contract addresses.\n" +
        "REQUIRES: A valid chain ID (84532, 8453, 137, or 42161).\n" +
        "RETURNS: Chain name, all contract addresses, RPC URL, and block explorer URL.\n" +
        "NOTE: Addresses are all zero for chains where COVENANT is not yet deployed.",
      inputSchema: {
        chainId: z
          .number()
          .describe(
            "The chain ID to query. Supported: 84532 (Base Sepolia), 8453 (Base Mainnet), 137 (Polygon), 42161 (Arbitrum One)."
          ),
      },
    },
    async ({ chainId }) => {
      const config = CHAIN_CONFIGS[chainId];
      if (!config) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error: `Chain ID ${chainId} is not supported.`,
                  supportedChainIds: Object.keys(CHAIN_CONFIGS).map(Number),
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      const isDeployed = Object.values(config.addresses).some(
        (addr) => addr !== ZERO_ADDRESS
      );

      return formatReadResult(
        {
          chainId,
          name: config.name,
          deployed: isDeployed,
          rpcUrl: config.rpcUrl,
          explorerUrl: config.explorerUrl,
          addresses: config.addresses,
        },
        `Chain Config: ${config.name}`
      );
    }
  );
}
