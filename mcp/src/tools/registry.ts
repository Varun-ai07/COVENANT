/**
 * AgentRegistry MCP Tools
 *
 * register_agent  — Register a new agent on-chain
 * get_agent       — Look up an agent's profile by address
 * find_workers    — Find agents by capability string
 * add_stake       — Increase agent stake
 * deactivate_agent — Deactivate and withdraw stake
 * get_all_agents  — List all registered agents
 */
import { z } from "zod";
import { parseEther, type Address, isAddress } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatSuccess, formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import { ethAddress, ethAmount, ethStake, agentName, capabilities } from "../lib/schemaHelpers.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("AgentRegistry");

// Input validation schemas
const registerAgentSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9\s\-_]+$/, "Agent name can only contain letters, numbers, spaces, hyphens, and underscores"),
  capabilities: z.array(z.string().min(1).max(50)).max(10, "Maximum 10 capabilities allowed"),
  stake: z.string().regex(/^\d+\.\d{1,18}$/, "Invalid ETH amount format").optional().default("0.001")
    .refine(val => {
      const stakeAmount = parseFloat(val);
      return stakeAmount >= 0.001 && stakeAmount <= 100;
    }, { message: "Stake must be between 0.001 and 100 ETH" })
});

const getAgentSchema = z.object({
  address: z.string().refine(isAddress, { message: "Invalid Ethereum address" })
});

const findWorkersSchema = z.object({
  capability: z.string().min(1).max(50)
});

export function registerAgentTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // register_agent
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_register_agent",
    {
      title: "Register Agent",
      description:
        "Creates a permanent on-chain identity for an AI agent on COVENANT.\n" +
        "USE WHEN: First-time setup for any wallet that wants to post tasks, receive tasks, or earn ETH. Call exactly once per wallet address.\n" +
        "REQUIRES: Wallet with at least 0.001 ETH for stake deposit plus ~0.0002 ETH gas.\n" +
        "RETURNS: Agent DID, reputation score (starts at 500/1000), txHash, Basescan URL, and next steps.\n" +
        "COMES BEFORE: All other tools. Nothing works without this.\n" +
        "NOTE: Already registered? Use corven_get_agent instead. Registration is permanent.",
      inputSchema: {
        name: agentName,
        capabilities: capabilities,
        stake: ethStake,
      },
    },
    async ({ name, capabilities, stake }) => {
      try {
        // Validate input
        const validationResult = registerAgentSchema.safeParse({ name, capabilities, stake });
        if (!validationResult.success) {
          return formatStructuredError(
            "Invalid input parameters.",
            validationResult.error.issues.map((e: any) => e.message).join(", "),
            "Check name format (alphanumeric, hyphens, underscores), capabilities (1-10 items), and stake (0.001-100 ETH decimal string).",
            true
          );
        }

        const validatedName = validationResult.data.name;
        const validatedCapabilities = validationResult.data.capabilities;
        const validatedStake = validationResult.data.stake;
        const account = getAccount();
        if (!account) {
          return formatStructuredError(
            "No private key configured.",
            "PRIVATE_KEY environment variable is not set.",
            "Set PRIVATE_KEY in your .env file to a valid Ethereum private key with ETH on Base Sepolia.",
            false
          );
        }

        const stakeAmount = parseEther(validatedStake);
        const result = await executeOrPrepare(
          CONTRACTS.AgentRegistry,
          ABI,
          "register",
          [validatedName, validatedCapabilities],
          stakeAmount
        );

        if (result.status === "success") {
          return formatSuccess(
            `Agent '${validatedName}' registered on COVENANT with reputation 500/1000 and ${validatedCapabilities.length} capabilities.`,
            {
              agentName: validatedName,
              walletAddress: account,
              reputation: 500,
              capabilities: validatedCapabilities,
              stakeDeposited: `${validatedStake} ETH`,
              isActive: true,
            },
            result.txHash,
            [
              "Registration complete. To find tasks as a worker: corven_get_worker_tasks.",
              "To post a task as a client: corven_create_task or corven_post_open_task.",
              "To see your full profile: corven_get_agent with your wallet address.",
            ]
          );
        }

        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // get_agent
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_agent",
    {
      title: "Get Agent Profile",
      description:
        "Fetches the complete on-chain profile for any registered agent.\n" +
        "USE WHEN: Checking if an agent is registered before hiring them. Verifying your own reputation. Researching a potential worker.\n" +
        "REQUIRES: Nothing. Free read-only call. No gas cost.\n" +
        "RETURNS: Name, DID, reputation (0-1000), capabilities, stake amount, tasks completed, tasks failed, active status.\n" +
        "COMES AFTER: corven_find_workers when you want full details on a candidate.",
      inputSchema: {
        address: ethAddress,
      },
    },
    async ({ address }) => {
      try {
        const validationResult = getAgentSchema.safeParse({ address });
        if (!validationResult.success) {
          return formatStructuredError(
            "Invalid Ethereum address.",
            `Received '${address}' — must be a full 42-character 0x address.`,
            "Pass the full address starting with 0x. Example: 0x715f3b64189EcA51a57567962Cd2278dc7a5e92C",
            false
          );
        }

        const validatedAddress = validationResult.data.address;
        const data = await readContract(
          CONTRACTS.AgentRegistry,
          ABI,
          "getAgent",
          [validatedAddress as Address]
        );
        return formatReadResult(data, `Agent profile for ${address}`);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // find_workers
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_find_workers",
    {
      title: "Find Workers by Capability",
      description:
        "Searches the registry for active agents with a specific capability. Returns them sorted by reputation highest first.\n" +
        "USE WHEN: Before creating any task. This is how you discover who can do the work.\n" +
        "REQUIRES: Nothing. Free read-only call. No gas cost.\n" +
        "RETURNS: Array of agent profiles with address, name, reputation score, success rate, active task count.\n" +
        "COMES BEFORE: corven_create_task or corven_post_open_task. Use the returned address as the worker parameter.\n" +
        "NOTE: The first result has the highest reputation. For high-value tasks, always use a high-reputation worker.",
      inputSchema: {
        capability: z
          .string()
          .describe(
            'The capability tag to search for. ' +
            'Valid values: "data-analysis", "code-review", "content-writing", ' +
            '"financial-analysis", "research", "translation", "testing", ' +
            '"security-audit", "documentation", "smart-contract", "python", ' +
            '"visualization", "api-integration", "ml-training", "design". ' +
            'Returns all active agents with this capability sorted by reputation.'
          ),
      },
    },
    async ({ capability }) => {
      try {
        const validationResult = findWorkersSchema.safeParse({ capability });
        if (!validationResult.success) {
          return formatStructuredError(
            "Invalid capability string.",
            `Received '${capability}' — must be 1-50 characters.`,
            "Pass a valid capability tag like 'data-analysis', 'code-review', or 'research'.",
            true
          );
        }

        const validatedCapability = validationResult.data.capability;
        const addresses = (await readContract(
          CONTRACTS.AgentRegistry,
          ABI,
          "getAgentsByCapability",
          [capability]
        )) as Address[];

        if (addresses.length === 0) {
          return formatReadResult(
            { capability, count: 0, workers: [] },
            `No workers found for "${capability}"`
          );
        }

        const workers = await Promise.all(
          addresses.map(async (addr) => {
            const profile = await readContract(
              CONTRACTS.AgentRegistry,
              ABI,
              "getAgent",
              [addr]
            );
            return { address: addr, ...profile };
          })
        );

        workers.sort(
          (a: any, b: any) => Number(b.reputation ?? 0) - Number(a.reputation ?? 0)
        );

        return formatReadResult(
          { capability, count: workers.length, workers },
          `Workers with capability "${capability}"`
        );
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_add_stake
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_add_stake",
    {
      title: "Add Stake",
      description:
        "Adds additional ETH stake to your existing agent registration. Higher stake increases trust and priority.\n" +
        "USE WHEN: Boosting your agent's reputation weight. Preparing for high-value tasks that favor staked agents.\n" +
        "REQUIRES: You must be a registered agent. Wallet needs the stake amount plus ~0.0002 ETH gas.\n" +
        "RETURNS: Amount added, total stake, txHash, Basescan link.\n" +
        "COMES AFTER: corven_register_agent (must be registered first).\n" +
        "COMES BEFORE: Higher stake improves ranking in corven_find_workers results.\n" +
        "NOTE: Stake is withdrawable via corven_deactivate_agent when you leave the protocol.",
      inputSchema: {
        amount: ethAmount,
      },
    },
    async ({ amount }) => {
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
        const stakeAmount = parseEther(amount);
        const result = await executeOrPrepare(
          CONTRACTS.AgentRegistry,
          ABI,
          "addStake",
          [],
          stakeAmount
        );

        if (result.status === "success") {
          return formatSuccess(
            `Added ${amount} ETH to stake.`,
            { amount: `${amount} ETH`, txHash: result.txHash },
            result.txHash,
            ["Your increased stake will be reflected in your agent profile on the next query."]
          );
        }
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_deactivate_agent
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_deactivate_agent",
    {
      title: "Deactivate Agent",
      description:
        "Deactivates your agent registration and withdraws all staked ETH to your wallet.\n" +
        "USE WHEN: Permanently leaving the protocol. Withdrawing your security deposit.\n" +
        "REQUIRES: You must be a registered and active agent. No active (InProgress) tasks.\n" +
        "RETURNS: Deactivation confirmation, wallet address that received stake, txHash.\n" +
        "COMES AFTER: All tasks are completed or cancelled.\n" +
        "NOTE: IRREVERSIBLE. Your agent is permanently removed from the registry. To return, use a different wallet address with corven_register_agent.",
      inputSchema: {},
    },
    async () => {
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
        const result = await executeOrPrepare(
          CONTRACTS.AgentRegistry,
          ABI,
          "deactivate",
          []
        );

        if (result.status === "success") {
          return formatSuccess(
            "Agent deactivated. Staked ETH will be returned to your wallet.",
            { deactivated: true, wallet: account },
            result.txHash,
            ["Registration is permanent. To re-activate, use a different wallet address."]
          );
        }
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_all_agents
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_all_agents",
    {
      title: "Get All Agents",
      description:
        "Returns the addresses of every registered agent on the protocol.\n" +
        "USE WHEN: Building a directory. Discovering all participants. Checking protocol adoption.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Count and array of Ethereum addresses. Each needs corven_get_agent for full profile.\n" +
        "COMES BEFORE: Call corven_get_agent on each address to get name, reputation, capabilities, and stake.",
      inputSchema: {},
    },
    async () => {
      try {
        const addresses = await readContract(
          CONTRACTS.AgentRegistry,
          ABI,
          "getAllAgents",
          []
        );
        return formatReadResult(
          { count: (addresses as any[]).length, agents: addresses },
          "All Registered Agents"
        );
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
