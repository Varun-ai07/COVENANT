/**
 * AgentRegistry MCP Tools (V4 CovenantIdentity)
 *
 * register_agent  — Register a new agent on-chain
 * get_agent       — Look up an agent's profile by address
 * add_stake       — Increase agent stake
 * deactivate_agent — Deactivate and withdraw stake
 * grant_capability — Grant a capability to an agent
 * revoke_capability — Revoke a capability from an agent
 */
import { z } from "zod";
import { parseEther, keccak256, toBytes, type Address, isAddress } from "viem";
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

const grantCapabilitySchema = z.object({
  agent: z.string().refine(isAddress, { message: "Invalid agent address" }),
  capabilityHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid capability hash"),
  expiry: z.number().int().nonnegative(),
  valueLimit: z.string().regex(/^\d+$/, "Invalid value limit")
});

const revokeCapabilitySchema = z.object({
  agent: z.string().refine(isAddress, { message: "Invalid agent address" }),
  capabilityHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid capability hash")
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
        const metadataRoot = keccak256(toBytes(validatedName + validatedCapabilities.join(",")));

        const result = await executeOrPrepare(
          CONTRACTS.AgentRegistry,
          ABI,
          "register",
          [stakeAmount, metadataRoot],
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
          "increaseStake",
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
  // corven_grant_capability
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_grant_capability",
    {
      title: "Grant Capability",
      description:
        "Grants a specific capability to an agent with an expiry and value limit.\n" +
        "USE WHEN: Authorizing an agent to perform specific actions or access certain resources.\n" +
        "REQUIRES: You must have permission to grant capabilities (typically the agent owner or admin).\n" +
        "RETURNS: Confirmation of capability grant, txHash.\n" +
        "COMES AFTER: corven_register_agent (agent must be registered).\n" +
        "NOTE: Capabilities can be revoked with corven_revoke_capability.",
      inputSchema: {
        agent: ethAddress,
        capabilityHash: z.string().describe("Keccak256 hash of the capability string (bytes32 hex)"),
        expiry: z.number().int().nonnegative().describe("Expiry timestamp (unix seconds)"),
        valueLimit: z.string().describe("Maximum value limit for this capability (in wei)")
      },
    },
    async ({ agent, capabilityHash, expiry, valueLimit }) => {
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

        const validationResult = grantCapabilitySchema.safeParse({ agent, capabilityHash, expiry, valueLimit });
        if (!validationResult.success) {
          return formatStructuredError(
            "Invalid input parameters.",
            validationResult.error.issues.map((e: any) => e.message).join(", "),
            "Check agent address (valid 0x...), capabilityHash (0x...64hex), expiry (non-negative integer), and valueLimit (numeric string).",
            true
          );
        }

        const result = await executeOrPrepare(
          CONTRACTS.AgentRegistry,
          ABI,
          "grantCapability",
          [
            validationResult.data.agent as Address,
            validationResult.data.capabilityHash as `0x${string}`,
            validationResult.data.expiry,
            BigInt(validationResult.data.valueLimit)
          ]
        );

        if (result.status === "success") {
          return formatSuccess(
            `Capability granted to ${agent}.`,
            { agent, capabilityHash, expiry, valueLimit },
            result.txHash,
            ["Capability is now active. Use corven_has_capability to verify."]
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
  // corven_revoke_capability
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_revoke_capability",
    {
      title: "Revoke Capability",
      description:
        "Revokes a previously granted capability from an agent.\n" +
        "USE WHEN: Removing a capability from an agent that is no longer needed or authorized.\n" +
        "REQUIRES: You must have permission to revoke capabilities (typically the agent owner or admin).\n" +
        "RETURNS: Confirmation of capability revocation, txHash.\n" +
        "COMES AFTER: corven_grant_capability (capability must have been granted).\n" +
        "NOTE: The agent will immediately lose access to the revoked capability.",
      inputSchema: {
        agent: ethAddress,
        capabilityHash: z.string().describe("Keccak256 hash of the capability string (bytes32 hex)")
      },
    },
    async ({ agent, capabilityHash }) => {
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

        const validationResult = revokeCapabilitySchema.safeParse({ agent, capabilityHash });
        if (!validationResult.success) {
          return formatStructuredError(
            "Invalid input parameters.",
            validationResult.error.issues.map((e: any) => e.message).join(", "),
            "Check agent address (valid 0x...) and capabilityHash (0x...64hex).",
            true
          );
        }

        const result = await executeOrPrepare(
          CONTRACTS.AgentRegistry,
          ABI,
          "revokeCapability",
          [
            validationResult.data.agent as Address,
            validationResult.data.capabilityHash as `0x${string}`
          ]
        );

        if (result.status === "success") {
          return formatSuccess(
            `Capability revoked from ${agent}.`,
            { agent, capabilityHash },
            result.txHash,
            ["Capability has been removed. The agent no longer has access."]
          );
        }

        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
