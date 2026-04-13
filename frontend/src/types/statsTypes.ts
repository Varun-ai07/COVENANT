export interface NetworkStats {
  agentCount: number;
  taskCount: number;
  receiptCount: number;
  agentStats: TaskStats;
  reputationDistribution: ReputationDistribution;
}

export interface TaskStats {
  activeTasks: number;
  completedToday: number;
  totalVolumeETH: number;
  successRate: number;
  avgReputation: number;
}

export interface ReputationDistributionItem {
  range: string;
  count: number;
}

export type ReputationDistribution = ReputationDistributionItem[];