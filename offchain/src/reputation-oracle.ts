import { type Address, type PublicClient, keccak256, toBytes, Hex } from "viem";

export interface AgentReputation {
  address: Address;
  score: number;
  completedTasks: number;
  successfulTasks: number;
  disputedTasks: number;
  lostDisputes: number;
  approvalRate: number;
  lastActivity: number;
  tier: "new" | "established" | "enterprise";
}

export interface CoordinatorConfig {
  escrowAddress: Address;
  identityAddress: Address;
  settlementAddress: Address;
  escrowAbi: any;
  identityAbi: any;
  settlementAbi: any;
  publicClient: PublicClient;
  walletClient: any;
}

export class ReputationOracle {
  public identityAddress: Address;
  public identityAbi: any;

  private agentData: Map<Address, AgentReputation> = new Map();
  private publicClient: PublicClient;

  static BAYESIAN_PRIOR = 500;
  static MAX_REPUTATION = 1000;
  static MIN_INTERACTIONS = 5;
  static DECAY_FACTOR = 0.95;

  constructor(config: CoordinatorConfig) {
    this.identityAddress = config.identityAddress;
    this.identityAbi = config.identityAbi;
    this.publicClient = config.publicClient;
  }

  recordTaskCompletion(agent: Address, successful: boolean): void {
    const data = this.getOrCreate(agent);
    data.completedTasks++;
    if (successful) {
      data.successfulTasks++;
    }
    data.lastActivity = Math.floor(Date.now() / 1000);
    data.score = this.computeScore(data);
    data.tier = this.computeTier(data.score);
  }

  recordDispute(agent: Address, won: boolean): void {
    const data = this.getOrCreate(agent);
    data.disputedTasks++;
    if (!won) {
      data.lostDisputes++;
    }
    data.lastActivity = Math.floor(Date.now() / 1000);
    data.score = this.computeScore(data);
    data.tier = this.computeTier(data.score);
  }

  getStats(agent: Address): AgentReputation | undefined {
    return this.agentData.get(agent);
  }

  computeMerkleRoot(): string {
    const agents = Array.from(this.agentData.entries())
      .sort(([a], [b]) => a.localeCompare(b));

    if (agents.length === 0) {
      return keccak256(toBytes("empty"));
    }

    const leaves = agents.map(([addr, data]) =>
      keccak256(
        Buffer.from(
          addr.slice(2) + data.score.toString(16).padStart(4, "0"),
          "hex"
        )
      )
    );

    return this.buildMerkleRoot(leaves);
  }

  private computeScore(data: AgentReputation): number {
    const approvalRate = data.completedTasks > 0
      ? (data.successfulTasks / data.completedTasks) * 100
      : 50;

    const disputePenalty = data.lostDisputes * 20;

    let score = Math.round(approvalRate * ReputationOracle.MAX_REPUTATION / 100);
    score -= disputePenalty;

    if (data.completedTasks < ReputationOracle.MIN_INTERACTIONS) {
      const weight = data.completedTasks / ReputationOracle.MIN_INTERACTIONS;
      score = Math.round(
        weight * score + (1 - weight) * ReputationOracle.BAYESIAN_PRIOR
      );
    }

    return Math.max(0, Math.min(ReputationOracle.MAX_REPUTATION, score));
  }

  private computeTier(score: number): "new" | "established" | "enterprise" {
    if (score >= 701) return "enterprise";
    if (score >= 301) return "established";
    return "new";
  }

  private getOrCreate(agent: Address): AgentReputation {
    if (!this.agentData.has(agent)) {
      this.agentData.set(agent, {
        address: agent,
        score: ReputationOracle.BAYESIAN_PRIOR,
        completedTasks: 0,
        successfulTasks: 0,
        disputedTasks: 0,
        lostDisputes: 0,
        approvalRate: 0,
        lastActivity: 0,
        tier: "new",
      });
    }
    return this.agentData.get(agent)!;
  }

  private buildMerkleRoot(leaves: `0x${string}`[]): string {
    if (leaves.length === 0) return keccak256(toBytes("empty"));
    if (leaves.length === 1) return leaves[0];

    const nextLevel: `0x${string}`[] = [];
    for (let i = 0; i < leaves.length; i += 2) {
      if (i + 1 < leaves.length) {
        const sorted = [leaves[i], leaves[i + 1]].sort();
        nextLevel.push(keccak256(Buffer.from(sorted[0].slice(2) + sorted[1].slice(2), "hex")));
      } else {
        nextLevel.push(leaves[i]);
      }
    }

    return this.buildMerkleRoot(nextLevel);
  }
}
