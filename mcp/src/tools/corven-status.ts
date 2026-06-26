/**
 * corven_status — System status dashboard for COVENANT MCP
 *
 * Shows wallet, network, agent registration, contract addresses, and verifier status.
 */
import { formatEther } from "viem";
import { getAccount, getPublicClient, getSDK, CONTRACTS, CHAIN } from "../config.js";
import { formatReadResult } from "../handlers/transactions.js";
import { formatStructuredError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerStatusTool(server: McpServer): void {
  server.registerTool(
    "corven_status",
    {
      title: "System Status",
      description:
        "Check COVENANT MCP system status — wallet, network, agent registration, contracts, and verifier.\n\n" +
        "ACTIONS:\n" +
        "  (no parameters needed) — Returns full system status\n\n" +
        "SHOWS: Wallet address, network name, agent registration status, reputation, balance, key contract addresses.\n\n" +
        "WHEN TO USE: When you need to verify your setup is correct before performing on-chain operations.\n\n" +
        "NEXT STEP: If not registered, register with corven_agent({ action: 'register' })\n\n" +
        "CONFIGURATION:\n" +
        "All settings are stored in ~/.covenant/config.json (the server reads this automatically).\n\n" +
        "  • PRIVATE_KEY — Wallet private key for signing transactions (required for writes)\n" +
        "    Get from MetaMask: ⋮ → Account Details → Show Private Key\n" +
        "    Set to 0xYOUR_PRIVATE_KEY_HERE for read-only mode (no spending)\n\n" +
        "  • SPENDING_LIMIT — Max ETH per transaction (default: 0.1)\n" +
        "    Lower for safety, raise for large tasks\n\n" +
        "  • PINATA_API_KEY — For IPFS uploads via corven_upload_ipfs (optional)\n" +
        "    Get free key at https://app.pinata.cloud/developers/api-keys\n\n" +
        "  • PINATA_SECRET_KEY — Paired with PINATA_API_KEY (optional)\n\n" +
        "How to update:\n" +
        "  nano ~/.covenant/config.json\n" +
        "  Then restart your AI agent / IDE.\n\n" +
        "OUTPUT RULES:\n" +
        "- Present results as clean, readable text. Never show raw JSON.\n" +
        "- On error: Explain in plain language what went wrong and suggest next step.\n" +
        "- Always recommend a logical follow-up action.\n" +
        "- Never show stack traces, technical errors, or raw data.",
      inputSchema: {},
    },
    async () => {
      try {
        const account = getAccount();
        const walletAddress = account?.address || "Not connected";

        let networkName = "Unknown";
        try {
          const chainId = CHAIN.id as number;
          if (chainId === 84532) networkName = "Base Sepolia";
          else if (chainId === 8453) networkName = "Base Mainnet";
          else if (chainId === 31337) networkName = "Hardhat Local";
          else networkName = `Chain ${chainId}`;
        } catch { /* fallback */ }

        let agentStatus = "Not registered";
        let reputation = 0;
        let balance = "0 ETH";

        if (account?.address) {
          try {
            const sdk = getSDK();
            const agent = await sdk.getAgent(account.address as any);
            if (agent && agent.isActive) {
              agentStatus = "Registered";
              reputation = Number(agent.reputation);
              const stakedEth = formatEther(agent.stakedAmount);
              balance = stakedEth + " ETH staked";
            }
          } catch {
            agentStatus = "Not registered";
          }

          try {
            const client = getPublicClient();
            const bal = await client.getBalance({ address: account.address as any });
            balance = formatEther(bal) + " ETH";
          } catch { /* fallback */ }
        }

        const contracts = {
          AgentRegistry: CONTRACTS.AgentRegistry,
          TaskEscrow: CONTRACTS.TaskEscrow,
          OpenTaskMarket: CONTRACTS.OpenTaskMarket,
          DisputeArbitration: CONTRACTS.DisputeArbitration,
          AgentCollective: CONTRACTS.AgentCollective,
          AgentInsurance: CONTRACTS.AgentInsurance,
        };

        return formatReadResult({
          wallet: walletAddress,
          network: networkName,
          chainId: CHAIN.id,
          agentStatus,
          reputation,
          balance,
          contracts,
          rpcUrl: (CHAIN as any).rpcUrls?.default?.http?.[0] || "configured",
        }, "COVENANT System Status");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return formatStructuredError(
          `Could not complete this action: ${msg || 'unknown error'}`,
          "This usually happens when the wallet or network configuration is missing.",
          "Try: Check your .env file for PRIVATE_KEY and BASE_SEPOLIA_RPC_URL",
          true
        );
      }
    }
  );
}
