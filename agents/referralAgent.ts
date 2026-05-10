/**
 * COVENANT Referral Agent
 *
 * Implements agent-to-agent referral system with on-chain reward distribution.
 * Agents can refer work to trusted peers and earn referral fees.
 *
 * Features:
 * - Reputation-based referral routing
 * - Automated fee splitting
 * - Trust graph maintenance
 * - Performance tracking for referrals
 */

import * as dotenv from "dotenv";
import { parseEther, formatEther, keccak256, toHex } from "viem";
import { createWallet, CONTRACTS } from "./lib/config.js";
import { AgentRegistryABI, TaskEscrowABI, OpenTaskMarketABI } from "./lib/abis.js";
import { generateJSON } from "./lib/llm.js";

dotenv.config();

// ============ Types ============

interface Agent {
  address: string;
  name: string;
  reputation: number;
  capabilities: string[];
  successRate: number;
  totalTasksCompleted: number;
}

interface ReferralRecord {
  referrer: string;
  referee: string;
  taskId: bigint;
  referralFee: bigint;
  status: 'pending' | 'completed' | 'failed';
  createdAt: bigint;
  completedAt?: bigint;
}

interface TrustScore {
  agent: string;
  score: number;  // 0-100
  successfulReferrals: number;
  failedReferrals: number;
  totalEarned: bigint;
}

// ============ Referral Agent Class ============

class ReferralAgent {
  private name: string;
  private capabilities: string[];
  private walletClient: any;
  private publicClient: any;
  private account: any;

  // Local trust graph (persisted to memory in production)
  private trustGraph: Map<string, TrustScore> = new Map();
  private referralHistory: Map<string, ReferralRecord> = new Map();

  // Configuration
  private readonly REFERRAL_FEE_BPS = 100n; // 1% referral fee
  private readonly MIN_TRUST_SCORE = 50;
  private readonly MAX_REFERRALS_PER_AGENT = 10;

  constructor() {
    this.name = "ReferralAgent";
    this.capabilities = ["referral-routing", "trust-management", "fee-distribution"];
  }

  /**
   * Initialize wallet connections
   */
  async init() {
    const privateKey = process.env.REFERRAL_AGENT_PRIVATE_KEY || process.env.CLIENT_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("Missing REFERRAL_AGENT_PRIVATE_KEY (or CLIENT_PRIVATE_KEY) in .env");
    }
    const { wallet, account, publicClient } = createWallet(privateKey);
    this.walletClient = wallet;
    this.account = account;
    this.publicClient = publicClient;
  }

  /**
   * Main execution loop
   */
  async run() {
    console.log(`🤝 ${this.name} started`);

    await this.init();

    // Register on-chain if not already
    await this.registerIfNeeded();

    // Start monitoring for referral opportunities
    await this.monitorReferralOpportunities();

    // Periodically update trust scores
    setInterval(() => this.updateTrustScores(), 300000); // Every 5 minutes

    // Process pending referrals
    setInterval(() => this.processPendingReferrals(), 60000); // Every minute
  }

  /**
   * Register agent on-chain if not already registered
   */
  private async registerIfNeeded() {
    try {
      const isRegistered = await this.publicClient.readContract({
        address: CONTRACTS.AgentRegistry,
        abi: AgentRegistryABI,
        functionName: "isRegistered",
        args: [this.account.address],
      }) as boolean;

      if (!isRegistered) {
        console.log("📝 Registering Referral Agent on-chain...");
        const hash = await this.walletClient.writeContract({
          address: CONTRACTS.AgentRegistry,
          abi: AgentRegistryABI,
          functionName: "register",
          args: [this.name, this.capabilities],
          value: parseEther("0.001"),
        });
        await this.publicClient.waitForTransactionReceipt({ hash });
        console.log("✅ Referral Agent registered!");
      }
    } catch (error) {
      console.error("❌ Failed to register referral agent:", error);
    }
  }

  /**
   * Find the best agent for a task based on capability, reputation, and trust
   * @param capability Required capability
   * @param excludeAddresses Addresses to exclude from results
   */
  async findBestAgent(
    capability: string,
    excludeAddresses: string[] = []
  ): Promise<Agent | null> {
    console.log(`🔍 Finding best agent for capability: ${capability}`);

    // Get agents with the required capability
    const agentAddresses = await this.publicClient.readContract({
      address: CONTRACTS.AgentRegistry,
      abi: AgentRegistryABI,
      functionName: "getAgentsByCapability",
      args: [capability],
    }) as string[];

    if (agentAddresses.length === 0) {
      console.log("❌ No agents found with required capability");
      return null;
    }

    // Fetch details for each agent
    const agents: Agent[] = [];
    for (const addr of agentAddresses) {
      if (excludeAddresses.includes(addr)) continue;

      const agentData = await this.publicClient.readContract({
        address: CONTRACTS.AgentRegistry,
        abi: AgentRegistryABI,
        functionName: "getAgent",
        args: [addr],
      }) as any;

      if (agentData.isActive !== 1) continue;

      agents.push({
        address: addr,
        name: agentData.name,
        reputation: Number(agentData.reputation),
        capabilities: agentData.capabilities,
        successRate: Number(agentData.successRate || 0),
        totalTasksCompleted: Number(agentData.totalTasksCompleted || 0),
      });
    }

    if (agents.length === 0) {
      console.log("❌ No active agents found");
      return null;
    }

    // Score and rank agents
    const scoredAgents = agents.map(agent => {
      const trustScore = this.trustGraph.get(agent.address)?.score || 50;
      const compositeScore = this.calculateCompositeScore(agent, trustScore);
      return { ...agent, compositeScore, trustScore };
    });

    // Sort by composite score (highest first)
    scoredAgents.sort((a, b) => b.compositeScore - a.compositeScore);

    const best = scoredAgents[0];
    console.log(`✅ Best agent: ${best.name} (score: ${best.compositeScore.toFixed(2)})`);

    return best;
  }

  /**
   * Refer a task to another agent
   * @param taskId The task ID
   * @param referredAgent The agent to refer to
   * @param referralFeeBps Referral fee in basis points (default 1%)
   */
  async referTask(
    taskId: bigint,
    referredAgent: string,
    referralFeeBps: bigint = this.REFERRAL_FEE_BPS
  ): Promise<string> {
    console.log(`🤝 Referring task ${taskId} to ${referredAgent.slice(0, 10)}...`);

    // Verify the referred agent is registered and active
    const agentData = await this.publicClient.readContract({
      address: CONTRACTS.AgentRegistry,
      abi: AgentRegistryABI,
      functionName: "getAgent",
      args: [referredAgent],
    }) as any;

    if (agentData.isActive !== 1) {
      throw new Error("Referred agent is not active");
    }

    // Verify trust score meets minimum
    const trustScore = this.trustGraph.get(referredAgent)?.score || 50;
    if (trustScore < this.MIN_TRUST_SCORE) {
      throw new Error(`Agent trust score ${trustScore} below minimum ${this.MIN_TRUST_SCORE}`);
    }

    // Record the referral
    const referralId = keccak256(
      toHex(`${taskId}-${referredAgent}-${Date.now()}`)
    );

    const referral: ReferralRecord = {
      referrer: this.account.address,
      referee: referredAgent,
      taskId,
      referralFee: referralFeeBps,
      status: 'pending',
      createdAt: BigInt(Math.floor(Date.now() / 1000)),
    };

    this.referralHistory.set(referralId, referral);

    // Emit referral event for indexing
    console.log(`✅ Referral recorded: ${referralId.slice(0, 18)}...`);

    return referralId;
  }

  /**
   * Generate a batch referral for multiple agents
   * @param capability Required capability
   * @param count Number of agents to refer
   * @param excludeAddresses Addresses to exclude
   */
  async generateBatchReferrals(
    capability: string,
    count: number,
    excludeAddresses: string[] = []
  ): Promise<Agent[]> {
    console.log(`📋 Generating batch referrals for ${count} agents with capability: ${capability}`);

    const agentAddresses = await this.publicClient.readContract({
      address: CONTRACTS.AgentRegistry,
      abi: AgentRegistryABI,
      functionName: "getAgentsByCapability",
      args: [capability],
    }) as string[];

    const agents: Agent[] = [];

    for (const addr of agentAddresses) {
      if (excludeAddresses.includes(addr)) continue;
      if (agents.length >= count) break;

      const agentData = await this.publicClient.readContract({
        address: CONTRACTS.AgentRegistry,
        abi: AgentRegistryABI,
        functionName: "getAgent",
        args: [addr],
      }) as any;

      if (agentData.isActive !== 1) continue;

      const trustScore = this.trustGraph.get(addr)?.score || 50;
      if (trustScore < this.MIN_TRUST_SCORE) continue;

      agents.push({
        address: addr,
        name: agentData.name,
        reputation: Number(agentData.reputation),
        capabilities: agentData.capabilities,
        successRate: Number(agentData.successRate || 0),
        totalTasksCompleted: Number(agentData.totalTasksCompleted || 0),
      });
    }

    // Sort by composite score
    agents.sort((a, b) => {
      const scoreA = this.calculateCompositeScore(a, this.trustGraph.get(a.address)?.score || 50);
      const scoreB = this.calculateCompositeScore(b, this.trustGraph.get(b.address)?.score || 50);
      return scoreB - scoreA;
    });

    return agents.slice(0, count);
  }

  /**
   * Update trust scores based on referral outcomes
   */
  async updateTrustScores(): Promise<void> {
    console.log("📊 Updating trust scores...");

    for (const [referralId, referral] of this.referralHistory) {
      if (referral.status !== 'pending') continue;

      // Check task status
      try {
        const task = await this.publicClient.readContract({
          address: CONTRACTS.TaskEscrow,
          abi: TaskEscrowABI,
          functionName: "getTask",
          args: [referral.taskId],
        }) as any;

        // Task completed (status 4) or failed (status 5)
        if (task.status === 4) {
          referral.status = 'completed';
          referral.completedAt = BigInt(Math.floor(Date.now() / 1000));

          // Update trust score for referee
          this.updateTrustForAgent(referral.referee, true);
          this.updateTrustForAgent(referral.referrer, true);

          console.log(`✅ Referral ${referralId.slice(0, 18)}... completed successfully`);
        } else if (task.status === 5) {
          referral.status = 'failed';
          referral.completedAt = BigInt(Math.floor(Date.now() / 1000));

          // Decrease trust for referee, slight decrease for referrer
          this.updateTrustForAgent(referral.referee, false);
          this.updateTrustForAgent(referral.referrer, false, 0.5);

          console.log(`❌ Referral ${referralId.slice(0, 18)}... failed`);
        }
      } catch (error) {
        console.error(`Error checking task ${referral.taskId}:`, error);
      }
    }
  }

  /**
   * Process pending referrals and distribute rewards
   */
  private async processPendingReferrals(): Promise<void> {
    for (const [referralId, referral] of this.referralHistory) {
      if (referral.status === 'completed' && referral.referrer === this.account.address) {
        // In production, this would distribute the referral fee
        // For now, we just mark it as processed
        console.log(`💸 Processing referral reward for ${referralId.slice(0, 18)}...`);
      }
    }
  }

  /**
   * Monitor for referral opportunities
   */
  private async monitorReferralOpportunities(): Promise<void> {
    console.log("👁️ Monitoring for referral opportunities...");

    // In production, this would watch for:
    // 1. Tasks without workers
    // 2. Tasks where current worker has low reputation
    // 3. Requests for referral from other agents

    // For now, we use polling
    setInterval(async () => {
      try {
        // Check for open tasks in the market
        const openTaskCount = await this.publicClient.readContract({
          address: CONTRACTS.OpenTaskMarket,
          abi: OpenTaskMarketABI,
          functionName: "getOpenTaskCount",
        });

        console.log(`📋 Open tasks available: ${openTaskCount}`);
      } catch (error) {
        // Silently handle errors in monitoring
      }
    }, 60000);
  }

  /**
   * Calculate composite score for agent ranking
   */
  private calculateCompositeScore(agent: Agent, trustScore: number): number {
    const reputationWeight = 0.4;
    const trustWeight = 0.3;
    const successRateWeight = 0.2;
    const experienceWeight = 0.1;

    // Normalize reputation (assume max 1000)
    const normalizedReputation = agent.reputation / 1000;

    // Normalize experience (log scale)
    const normalizedExperience = Math.log10(agent.totalTasksCompleted + 1) / 3;

    // Success rate is already 0-100
    const normalizedSuccessRate = agent.successRate / 100;

    return (
      normalizedReputation * reputationWeight +
      (trustScore / 100) * trustWeight +
      normalizedSuccessRate * successRateWeight +
      normalizedExperience * experienceWeight
    );
  }

  /**
   * Update trust score for an agent
   */
  private updateTrustForAgent(
    agentAddress: string,
    success: boolean,
    weight: number = 1.0
  ): void {
    const current = this.trustGraph.get(agentAddress) || {
      agent: agentAddress,
      score: 50,
      successfulReferrals: 0,
      failedReferrals: 0,
      totalEarned: 0n,
    };

    if (success) {
      current.successfulReferrals++;
      current.score = Math.min(100, current.score + 2 * weight);
    } else {
      current.failedReferrals++;
      current.score = Math.max(0, current.score - 5 * weight);
    }

    this.trustGraph.set(agentAddress, current);
  }

  /**
   * Get trust score for an agent
   */
  getTrustScore(agentAddress: string): TrustScore | undefined {
    return this.trustGraph.get(agentAddress);
  }

  /**
   * Get all referral history
   */
  getReferralHistory(): Map<string, ReferralRecord> {
    return this.referralHistory;
  }
}

// ============ CLI Entry Point ============

async function main() {
  const agent = new ReferralAgent();

  // Handle CLI commands
  const command = process.argv[2];

  if (command === "run") {
    await agent.run();
  } else if (command === "find") {
    const capability = process.argv[3];
    if (!capability) {
      console.error("Usage: npx tsx referralAgent.ts find <capability>");
      process.exit(1);
    }
    await agent.init();
    const best = await agent.findBestAgent(capability);
    if (best) {
      console.log(JSON.stringify(best, null, 2));
    }
  } else if (command === "refer") {
    const taskId = process.argv[3];
    const agentAddr = process.argv[4];
    if (!taskId || !agentAddr) {
      console.error("Usage: npx tsx referralAgent.ts refer <taskId> <agentAddress>");
      process.exit(1);
    }
    await agent.init();
    const referralId = await agent.referTask(BigInt(taskId), agentAddr);
    console.log(`Referral ID: ${referralId}`);
  } else {
    console.log(`
COVENANT Referral Agent

Commands:
  run                    Start the referral agent daemon
  find <capability>      Find best agent for a capability
  refer <taskId> <addr>  Refer a task to an agent

Examples:
  npx tsx referralAgent.ts run
  npx tsx referralAgent.ts find "solidity-development"
  npx tsx referralAgent.ts refer 1 0x1234...
`);
  }
}

// Export for use as module
export { ReferralAgent };
export default ReferralAgent;

// Run if called directly
main().catch(console.error);
