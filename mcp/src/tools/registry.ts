/**
 * AgentRegistry MCP Tools
 *
 * register_agent  — Register a new agent on-chain
 * get_agent       — Look up an agent's profile by address
 * find_workers    — Find agents by capability string
 */
import { z } from "zod";
import { parseEther, type Address, isAddress } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult, formatError } from "../handlers/transactions.js";
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
        "Register a new AI agent on the AgentRegistry contract. " +
        "Requires a name, array of capabilities, and a minimum stake of 0.001 ETH.",
      inputSchema: {
        name: z.string().describe("Agent display name"),
        capabilities: z
          .array(z.string())
          .describe('Capability tags, e.g. ["data-analysis", "code-review"]'),
        stake: z
          .string()
          .optional()
          .describe("Stake amount in ETH (default 0.001)"),
      },
    },
    async ({ name, capabilities, stake }) => {
      try {
        // Validate input
        const validationResult = registerAgentSchema.safeParse({ name, capabilities, stake });
        if (!validationResult.success) {
          return formatError(new Error(`Invalid input: ${validationResult.error.issues.map((e: any) => e.message).join(", ")}`));
        }

        // Use validated values
        const validatedName = validationResult.data.name;
        const validatedCapabilities = validationResult.data.capabilities;
        const validatedStake = validationResult.data.stake;
        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured — cannot send transactions"));
        }

        const stakeAmount = parseEther(validatedStake);
        const result = await executeOrPrepare(
          CONTRACTS.AgentRegistry,
          ABI,
          "register",
          [validatedName, validatedCapabilities],
          stakeAmount
        );
        return formatTxResult(result);
      } catch (e) {
        return formatError(e);
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
        "Retrieve the full on-chain profile for a registered agent by address. " +
        "Returns name, DID, reputation, staked amount, capabilities, task counts.",
      inputSchema: {
        address: z.string().describe("Agent's Ethereum address (0x...)"),
      },
    },
    async ({ address }) => {
      try {
        // Validate input
        const validationResult = getAgentSchema.safeParse({ address });
        if (!validationResult.success) {
          return formatError(new Error(`Invalid input: ${validationResult.error.issues.map((e: any) => e.message).join(", ")}`));
        }

        // Use validated address
        const validatedAddress = validationResult.data.address;
        const data = await readContract(
          CONTRACTS.AgentRegistry,
          ABI,
          "getAgent",
          [validatedAddress as Address]
        );
        return formatReadResult(data, `Agent profile for ${address}`);
      } catch (e) {
        return formatError(e);
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
        "Discover agents that have a specific capability tag. " +
        "Returns addresses and profiles sorted by reputation (highest first).",
      inputSchema: {
        capability: z
          .string()
          .describe('Capability to search for, e.g. "data-analysis"'),
      },
    },
    async ({ capability }) => {
      try {
        // Validate input
        const validationResult = findWorkersSchema.safeParse({ capability });
        if (!validationResult.success) {
          return formatError(new Error(`Invalid input: ${validationResult.error.issues.map((e: any) => e.message).join(", ")}`));
        }

        // Use validated capability
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

        // Fetch full profiles
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

        // Sort by reputation descending
        workers.sort(
          (a: any, b: any) => Number(b.reputation ?? 0) - Number(a.reputation ?? 0)
        );

        return formatReadResult(
          { capability, count: workers.length, workers },
          `Workers with capability "${capability}"`
        );
      } catch (e) {
        return formatError(e);
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
        "Add additional ETH stake to an existing agent registration. " +
        "Higher stake increases trust and priority in the network.",
      inputSchema: {
        amount: z.string().describe("Amount of ETH to add as stake, e.g. '0.01'"),
      },
    },
    async ({ amount }) => {
      try {
        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured — cannot send transactions"));
        }
        const stakeAmount = parseEther(amount);
        const result = await executeOrPrepare(
          CONTRACTS.AgentRegistry,
          ABI,
          "addStake",
          [],
          stakeAmount
        );
        return formatTxResult(result);
      } catch (e) {
        return formatError(e);
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
        "Deactivate your agent registration and withdraw staked ETH. " +
        "This action is irreversible — your agent will no longer be discoverable.",
      inputSchema: {},
    },
    async () => {
      try {
        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured — cannot send transactions"));
        }
        const result = await executeOrPrepare(
          CONTRACTS.AgentRegistry,
          ABI,
          "deactivate",
          []
        );
        return formatTxResult(result);
      } catch (e) {
        return formatError(e);
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
        "Retrieve the addresses of all registered agents on the protocol. " +
        "Use corven_get_agent to get full profiles for each address.",
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
        return formatError(e);
      }
    }
  );
}
