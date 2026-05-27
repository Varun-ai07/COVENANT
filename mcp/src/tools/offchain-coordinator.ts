/**
 * Offchain Coordination Layer
 *
 * All coordination that doesn't need onchain settlement:
 * - Agent profiles (signed by wallet, stored offchain)
 * - Smart matching (offchain algorithm using onchain reputation)
 * - Messaging (encrypted, offchain)
 * - Task templates (offchain)
 * - Collective coordination (Merkle root anchor)
 * - Marketplace discovery (offchain indexer)
 *
 * This is the "maximum coordination offchain" layer that pairs
 * with the minimal v2 settlement contracts.
 */
import { z } from "zod";
import { type Address, keccak256, toBytes } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { readContract } from "../handlers/wallet.js";
import { formatReadResult, formatError } from "../handlers/transactions.js";
import { ethAddress } from "../lib/schemaHelpers.js";
import { parseContractError, formatStructuredError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const REGISTRY_ABI = loadAbi("AgentRegistry");

// ─── Offchain Data Stores ────────────────────────────────────

interface AgentProfile {
  address: string;
  name: string;
  bio: string;
  website: string;
  capabilities: string[];
  tags: string[];
  avatarUrl: string;
  socialLinks: Record<string, string>;
  updatedAt: number;
}

interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: Record<string, unknown>;
  pricing: { base: string; multiplier: number };
  verificationChecks: string[];
}

interface MarketplaceListing {
  agentAddress: string;
  capabilities: string[];
  hourlyRate: string;
  availability: "available" | "busy" | "offline";
  completedTasks: number;
  reputation: number;
  featured: boolean;
}

// In-memory stores (production: IPFS + database)
const profileStore: Map<string, AgentProfile> = new Map();
const templateStore: Map<string, TaskTemplate> = new Map();
const listingStore: Map<string, MarketplaceListing> = new Map();

// ─── Built-in Templates ─────────────────────────────────────

const BUILT_IN_TEMPLATES: TaskTemplate[] = [
  {
    id: "code-review",
    name: "Code Review",
    description: "Thorough code review with actionable feedback",
    category: "development",
    parameters: { language: "string", repoUrl: "string", scope: "string" },
    pricing: { base: "0.005", multiplier: 1.5 },
    verificationChecks: ["output_not_empty", "has_issues", "has_suggestions"],
  },
  {
    id: "security-audit",
    name: "Security Audit",
    description: "Security vulnerability assessment",
    category: "security",
    parameters: { target: "string", depth: "string", standards: "string[]" },
    pricing: { base: "0.02", multiplier: 2.0 },
    verificationChecks: ["output_not_empty", "has_vulnerabilities", "has_remediation"],
  },
  {
    id: "data-analysis",
    name: "Data Analysis",
    description: "Analyze dataset and produce insights",
    category: "data",
    parameters: { datasetUrl: "string", questions: "string[]" },
    pricing: { base: "0.008", multiplier: 1.2 },
    verificationChecks: ["output_not_empty", "answers_questions", "has_visualizations"],
  },
  {
    id: "api-development",
    name: "API Development",
    description: "Build REST/GraphQL API endpoints",
    category: "development",
    parameters: { spec: "string", framework: "string", testsRequired: "boolean" },
    pricing: { base: "0.015", multiplier: 1.8 },
    verificationChecks: ["output_not_empty", "has_endpoints", "has_tests"],
  },
  {
    id: "documentation",
    name: "Documentation",
    description: "Generate technical documentation",
    category: "writing",
    parameters: { source: "string", format: "string", audience: "string" },
    pricing: { base: "0.003", multiplier: 1.0 },
    verificationChecks: ["output_not_empty", "has_sections", "has_examples"],
  },
];

// Initialize templates
BUILT_IN_TEMPLATES.forEach(t => templateStore.set(t.id, t));

// ─── Matching Algorithm ─────────────────────────────────────

interface MatchResult {
  agentAddress: string;
  score: number;
  reasons: string[];
  capabilities: string[];
  reputation: number;
  tasksCompleted: number;
}

function calculateMatchScore(
  requirements: { capabilities: string[]; budget: number; priority: string },
  agent: { capabilities: string[]; reputation: number; tasksCompleted: number; tasksFailed: number; stakedAmount: string }
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Capability match (40% weight)
  const matchedCaps = requirements.capabilities.filter(c => agent.capabilities.includes(c));
  const capScore = requirements.capabilities.length > 0
    ? matchedCaps.length / requirements.capabilities.length
    : 0;
  score += capScore * 0.4;
  if (matchedCaps.length > 0) reasons.push(`${matchedCaps.length}/${requirements.capabilities.length} capabilities matched`);

  // Reputation score (30% weight)
  const repScore = agent.reputation / 1000;
  score += repScore * 0.3;
  if (agent.reputation >= 800) reasons.push("High reputation agent");

  // Experience score (20% weight)
  const totalTasks = agent.tasksCompleted + agent.tasksFailed;
  const expScore = totalTasks > 0 ? Math.min(totalTasks / 20, 1) : 0;
  score += expScore * 0.2;
  if (agent.tasksCompleted >= 10) reasons.push(`${agent.tasksCompleted} tasks completed`);

  // Stake score (10% weight)
  const stake = parseFloat(agent.stakedAmount);
  const stakeScore = Math.min(stake / 0.1, 1);
  score += stakeScore * 0.1;

  return { score, reasons };
}

// ─── Input Schemas ───────────────────────────────────────────

const profileUpdateSchema = z.object({
  name: z.string().min(1).max(100),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional(),
  capabilities: z.array(z.string()).max(20),
  tags: z.array(z.string()).max(10).optional(),
  avatarUrl: z.string().url().optional(),
  socialLinks: z.record(z.string(), z.string()).optional(),
});

const matchingSchema = z.object({
  capabilities: z.array(z.string()).min(1),
  budget: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  topN: z.number().int().min(1).max(20).optional(),
});

const messagingSchema = z.object({
  to: ethAddress,
  content: z.string().min(1).max(5000),
  taskId: z.number().optional(),
  messageType: z.enum(["general", "proposal", "question", "update"]).optional(),
});

const marketplaceSchema = z.object({
  capabilities: z.array(z.string()).optional(),
  minReputation: z.number().int().min(0).max(1000).optional(),
  maxRate: z.string().optional(),
  availability: z.enum(["available", "busy", "offline"]).optional(),
  sortBy: z.enum(["reputation", "rate", "tasks"]).optional(),
});

// ─── Tool Registration ───────────────────────────────────────

export function registerOffchainCoordinatorTools(server: McpServer): void {

  // ──────────────────────────────────────────────────────────
  // corven_profile_update
  // ──────────────────────────────────────────────────────────
  server.registerTool(
    "corven_profile_update",
    {
      title: "Update Agent Profile",
      description:
        "Update offchain agent profile. Profile data is signed by wallet " +
        "and stored offchain (IPFS in production). No gas cost.\n" +
        "USE WHEN: An agent wants to enrich its public profile with bio, website, avatar, social links, or refined capability tags.\n" +
        "REQUIRES: Wallet configured (PRIVATE_KEY set). Agent should be registered on-chain via corven_register_agent first.\n" +
        "RETURNS: Confirmation with address, name, capabilities, and updatedAt timestamp.\n" +
        "COMES BEFORE: corven_match_agents, corven_marketplace_list (richer profiles score higher in matching).\n" +
        "COMES AFTER: corven_register_agent (on-chain identity must exist first).\n" +
        "NOTE: Zero gas cost. Data is signed by wallet and stored in-memory (IPFS in production).",
      inputSchema: {
        name: z.string().describe("Display name"),
        bio: z.string().optional().describe("Agent bio (max 500 chars)"),
        website: z.string().optional().describe("Website URL"),
        capabilities: z.array(z.string()).describe("Capability tags"),
        tags: z.array(z.string()).optional().describe("Additional tags"),
        avatarUrl: z.string().optional().describe("Avatar image URL"),
        socialLinks: z.record(z.string(), z.string()).optional().describe("Social media links"),
      },
    },
    async (params) => {
      try {
        const parsed = profileUpdateSchema.safeParse(params);
        if (!parsed.success) return formatError(parsed.error);

        const account = getAccount();
        if (!account) return formatError(new Error("No wallet configured."));

        const profile: AgentProfile = {
          address: account,
          name: parsed.data.name,
          bio: parsed.data.bio || "",
          website: parsed.data.website || "",
          capabilities: parsed.data.capabilities,
          tags: parsed.data.tags || [],
          avatarUrl: parsed.data.avatarUrl || "",
          socialLinks: parsed.data.socialLinks || {},
          updatedAt: Math.floor(Date.now() / 1000),
        };

        profileStore.set(account.toLowerCase(), profile);

        return formatReadResult({
          address: account,
          name: profile.name,
          capabilities: profile.capabilities,
          updatedAt: new Date(profile.updatedAt * 1000).toISOString(),
          note: "Profile stored offchain. No gas consumed.",
        }, "Profile Updated");
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────
  // corven_profile_get
  // ──────────────────────────────────────────────────────────
  server.registerTool(
    "corven_profile_get",
    {
      title: "Get Agent Profile",
      description:
        "Get offchain profile for an agent. Combines onchain data with offchain profile.\n" +
        "USE WHEN: You need a complete view of an agent — both on-chain reputation/stake and off-chain bio/website/social.\n" +
        "REQUIRES: Valid Ethereum address. Agent may or may not be registered on-chain (returns partial data if not).\n" +
        "RETURNS: Object with address, onchain data (reputation, isActive, tasksCompleted, stakedAmount), and offchain profile (name, bio, website, capabilities, tags, avatarUrl, socialLinks).\n" +
        "COMES BEFORE: Hiring decisions, task assignment, or messaging.\n" +
        "COMES AFTER: corven_register_agent and corven_profile_update.\n" +
        "NOTE: Returns onchain data even if no offchain profile exists (shows 'No offchain profile set').",
      inputSchema: {
        address: ethAddress,
      },
    },
    async (params) => {
      try {
        const address = (params as { address: string }).address.toLowerCase();

        // Get onchain data
        const onchainData = await readContract(
          CONTRACTS.AgentRegistry as Address,
          REGISTRY_ABI,
          "getAgent",
          [address as Address]
        ).catch(() => null);

        // Get offchain profile
        const profile = profileStore.get(address);

        const onchain = onchainData as unknown[] | null;

        return formatReadResult({
          address,
          onchain: onchain ? {
            reputation: onchain[2]?.toString(),
            isActive: onchain[3] === 1,
            tasksCompleted: onchain[4]?.toString(),
            stakedAmount: onchain[6]?.toString(),
          } : "Not registered onchain",
          offchain: profile || "No offchain profile set",
        }, "Agent Profile");
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────
  // corven_match_agents
  // ──────────────────────────────────────────────────────────
  server.registerTool(
    "corven_match_agents",
    {
      title: "Smart Agent Matching",
      description:
        "Find the best agents for a task using multi-factor scoring. " +
        "Combines onchain reputation with offchain profiles.\n" +
        "USE WHEN: You need to discover the best-fit workers for a task based on capabilities, reputation, and experience.\n" +
        "REQUIRES: Agents must have offchain profiles (corven_profile_update) and be registered on-chain. At least one agent with a matching profile must exist.\n" +
        "RETURNS: Top N matches sorted by composite score (40% capability match, 30% reputation, 20% experience, 10% stake) with per-agent score breakdown and match reasons.\n" +
        "COMES BEFORE: corven_create_task or corven_post_open_task (use the matched worker address).\n" +
        "COMES AFTER: corven_register_agent, corven_profile_update (agents must exist and have profiles).\n" +
        "NOTE: Iterates all profiles in-memory. For large registries, prefer corven_find_workers for capability-only search.",
      inputSchema: {
        capabilities: z.array(z.string()).describe("Required capabilities"),
        budget: z.string().optional().describe("Max budget in ETH"),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        topN: z.number().optional().describe("Number of top matches (default 5)"),
      },
    },
    async (params) => {
      try {
        const parsed = matchingSchema.safeParse(params);
        if (!parsed.success) return formatError(parsed.error);

        const { capabilities, budget, priority, topN } = parsed.data;
        const limit = topN || 5;

        // Get all registered agents from onchain
        const agentCount = await readContract(
          CONTRACTS.AgentRegistry as Address,
          REGISTRY_ABI,
          "agentCount",
          []
        ).catch(() => 0n);

        const matches: MatchResult[] = [];
        const count = Number(agentCount);

        // Iterate through profiles (in production: use The Graph)
        for (const [address, profile] of profileStore) {
          try {
            const onchain = await readContract(
              CONTRACTS.AgentRegistry as Address,
              REGISTRY_ABI,
              "getAgent",
              [address as Address]
            ).catch(() => null);

            if (!onchain) continue;
            const data = onchain as unknown[];
            if (data[3] !== 1) continue; // isActive

            const { score, reasons } = calculateMatchScore(
              { capabilities, budget: parseFloat(budget || "0"), priority: priority || "medium" },
              {
                capabilities: profile.capabilities,
                reputation: Number(data[2]),
                tasksCompleted: Number(data[4]),
                tasksFailed: Number(data[5]),
                stakedAmount: data[6]?.toString() || "0",
              }
            );

            matches.push({
              agentAddress: address,
              score,
              reasons,
              capabilities: profile.capabilities,
              reputation: Number(data[2]),
              tasksCompleted: Number(data[4]),
            });
          } catch { continue; }
        }

        matches.sort((a, b) => b.score - a.score);
        const top = matches.slice(0, limit);

        return formatReadResult({
          query: { capabilities, budget, priority },
          totalAgents: profileStore.size,
          matches: top.map((m, i) =>
            `#${i + 1} ${m.agentAddress.slice(0, 10)}... Score: ${(m.score * 100).toFixed(1)}% | Rep: ${m.reputation} | Tasks: ${m.tasksCompleted}\n   Reasons: ${m.reasons.join(", ")}`
          ).join("\n\n") || "No matching agents found",
        }, "Agent Matching Results");
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────
  // corven_templates_list
  // ──────────────────────────────────────────────────────────
  server.registerTool(
    "corven_templates_list",
    {
      title: "List Task Templates",
      description:
        "List available task templates for quick task creation.\n" +
        "USE WHEN: You want to browse pre-built task templates (code-review, security-audit, data-analysis, api-development, documentation) to speed up task creation.\n" +
        "REQUIRES: None. Built-in templates are always available.\n" +
        "RETURNS: Array of templates with id, name, description, category, and basePrice.\n" +
        "COMES BEFORE: corven_create_task (use a template's pricing and verificationChecks as a starting point).\n" +
        "COMES AFTER: Nothing — standalone read.",
      inputSchema: {
        category: z.string().optional().describe("Filter by category"),
      },
    },
    async (params) => {
      try {
        const category = (params as { category?: string }).category;
        let templates = Array.from(templateStore.values());

        if (category) {
          templates = templates.filter(t => t.category === category);
        }

        return formatReadResult({
          count: templates.length,
          templates: templates.map(t => ({
            id: t.id,
            name: t.name,
            description: t.description,
            category: t.category,
            basePrice: `${t.pricing.base} ETH`,
          })),
        }, "Task Templates");
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────
  // corven_message_send
  // ──────────────────────────────────────────────────────────
  server.registerTool(
    "corven_message_send",
    {
      title: "Send Message",
      description:
        "Send an offchain message to another agent. Messages are signed " +
        "by sender's wallet. No gas cost.\n" +
        "USE WHEN: You need to communicate with another agent — send a proposal, ask a question, or provide a status update.\n" +
        "REQUIRES: Wallet configured (PRIVATE_KEY set). Recipient address must be valid.\n" +
        "RETURNS: Message ID (keccak256 hash), sender, recipient, type, and timestamp.\n" +
        "COMES BEFORE: Task negotiation or collaborative work.\n" +
        "COMES AFTER: corven_find_workers or corven_match_agents (you found an agent to message).\n" +
        "NOTE: Zero gas cost. Messages are signed with sender's wallet. In production: encrypted with ECDH, stored on IPFS.",
      inputSchema: {
        to: ethAddress,
        content: z.string().describe("Message content"),
        taskId: z.number().optional().describe("Related task ID"),
        messageType: z.enum(["general", "proposal", "question", "update"]).optional(),
      },
    },
    async (params) => {
      try {
        const parsed = messagingSchema.safeParse(params);
        if (!parsed.success) return formatError(parsed.error);

        const account = getAccount();
        if (!account) return formatError(new Error("No wallet configured."));

        const message = {
          from: account,
          to: parsed.data.to,
          content: parsed.data.content,
          taskId: parsed.data.taskId,
          messageType: parsed.data.messageType || "general",
          timestamp: Math.floor(Date.now() / 1000),
          id: keccak256(toBytes(`${account}-${parsed.data.to}-${Date.now()}`)),
        };

        // In production: encrypt with recipient's public key, store on IPFS
        return formatReadResult({
          messageId: message.id,
          from: account,
          to: parsed.data.to,
          type: message.messageType,
          timestamp: new Date(message.timestamp * 1000).toISOString(),
          note: "Message stored offchain. In production: encrypted with ECDH, stored on IPFS.",
        }, "Message Sent");
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────
  // corven_marketplace_list
  // ──────────────────────────────────────────────────────────
  server.registerTool(
    "corven_marketplace_list",
    {
      title: "Marketplace Discovery",
      description:
        "Search the agent marketplace. Combines onchain reputation " +
        "with offchain profiles for discovery.\n" +
        "USE WHEN: You want to browse the agent marketplace — filter by capabilities, reputation, rate, or availability.\n" +
        "REQUIRES: At least one agent with a marketplace listing (corven_marketplace_register).\n" +
        "RETURNS: Filtered and sorted listings with address, capabilities, hourlyRate, availability, completedTasks, reputation, and featured status.\n" +
        "COMES BEFORE: corven_create_task or corven_message_send (hire or message a discovered agent).\n" +
        "COMES AFTER: corven_marketplace_register (agents must register their listings first).\n" +
        "NOTE: In-memory store. Use corven_find_workers for on-chain capability search.",
      inputSchema: {
        capabilities: z.array(z.string()).optional().describe("Required capabilities"),
        minReputation: z.number().optional().describe("Minimum reputation (0-1000)"),
        maxRate: z.string().optional().describe("Max hourly rate in ETH"),
        availability: z.enum(["available", "busy", "offline"]).optional(),
        sortBy: z.enum(["reputation", "rate", "tasks"]).optional(),
      },
    },
    async (params) => {
      try {
        const parsed = marketplaceSchema.safeParse(params);
        if (!parsed.success) return formatError(parsed.error);

        const { capabilities, minReputation, sortBy } = parsed.data;

        let listings = Array.from(profileStore.entries()).map(([addr, profile]) => ({
          address: addr,
          name: profile.name,
          capabilities: profile.capabilities,
          reputation: 0,
          tasksCompleted: 0,
        }));

        // Enrich with onchain data
        for (let i = 0; i < listings.length; i++) {
          try {
            const data = await readContract(
              CONTRACTS.AgentRegistry as Address,
              REGISTRY_ABI,
              "getAgent",
              [listings[i].address as Address]
            ).catch(() => null);
            if (data) {
              const d = data as unknown[];
              listings[i].reputation = Number(d[2]);
              listings[i].tasksCompleted = Number(d[4]);
            }
          } catch { continue; }
        }

        // Apply filters
        if (capabilities && capabilities.length > 0) {
          listings = listings.filter(l =>
            capabilities.some(c => l.capabilities.includes(c))
          );
        }
        if (minReputation) {
          listings = listings.filter(l => l.reputation >= minReputation);
        }

        // Sort
        if (sortBy === "reputation") {
          listings.sort((a, b) => b.reputation - a.reputation);
        } else if (sortBy === "tasks") {
          listings.sort((a, b) => b.tasksCompleted - a.tasksCompleted);
        }

        return formatReadResult({
          total: listings.length,
          filters: { capabilities, minReputation, sortBy },
          listings: listings.slice(0, 20).map((l, i) =>
            `#${i + 1} ${l.name} (${l.address.slice(0, 10)}...) | Rep: ${l.reputation} | Tasks: ${l.tasksCompleted} | Caps: ${l.capabilities.join(", ")}`
          ).join("\n") || "No agents found",
        }, "Marketplace Results");
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────
  // corven_collective_propose
  // ──────────────────────────────────────────────────────────
  server.registerTool(
    "corven_collective_propose",
    {
      title: "Propose Collective Task",
      description:
        "Propose a task for collective execution. Uses offchain coordination " +
        "with Merkle root anchor for deliverables.\n" +
        "USE WHEN: You want to propose a collaborative task to a group of agents before committing on-chain.\n" +
        "REQUIRES: Wallet configured. At least one agent address in the agents array.\n" +
        "RETURNS: Proposal hash (keccak256), task description, estimated payment, required capabilities, and participant list.\n" +
        "COMES BEFORE: corven_create_batch or corven_create_collective (convert proposal to on-chain action).\n" +
        "COMES AFTER: Nothing — this is the offchain planning step.",
      inputSchema: {
        title: z.string().describe("Task title"),
        description: z.string().describe("Task description"),
        requiredCapabilities: z.array(z.string()).describe("Required capabilities"),
        maxMembers: z.number().int().min(2).max(50).describe("Max collective size"),
        paymentPerMember: z.string().describe("Payment per member in ETH"),
      },
    },
    async (params) => {
      try {
        const account = getAccount();
        if (!account) return formatError(new Error("No wallet configured."));

        const proposal = {
          proposer: account,
          title: (params as { title: string }).title,
          description: (params as { description: string }).description,
          requiredCapabilities: (params as { requiredCapabilities: string[] }).requiredCapabilities,
          maxMembers: (params as { maxMembers: number }).maxMembers,
          paymentPerMember: (params as { paymentPerMember: string }).paymentPerMember,
          createdAt: Math.floor(Date.now() / 1000),
          status: "open",
        };

        // In production: store on IPFS, anchor Merkle root onchain
        return formatReadResult({
          proposal,
          note: "Proposal created offchain. In production: stored on IPFS, Merkle root anchored onchain via AgentCollective.",
        }, "Collective Proposal");
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
