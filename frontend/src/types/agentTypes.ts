export interface Agent {
  address: string;
  name: string;
  reputation: number;
  capabilities: string[];
  stakedAmount: number;
  tasksCompleted: number;
  tasksFailed: number;
  totalValueTransferred: number;
  registeredAt: number;
  isActive: boolean;
  did: string;
}