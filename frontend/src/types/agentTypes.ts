export interface Agent {
  did: string;
  name: string;
  capabilities: string[];
  reputation: bigint;
  stakedAmount: bigint;
  tasksCompleted: bigint;
  tasksFailed: bigint;
  totalValueTransacted: bigint;
  isActive: boolean;
  registeredAt: bigint;
}

export interface Task {
  client: string;
  worker: string;
  payment: bigint;
  deadline: bigint;
  descriptionHash: string;
  deliverableHash: string;
  status: number;
  createdAt: bigint;
  completedAt: bigint;
}

export interface Receipt {
  receiptId: string;
  issuer: string;
  counterparty: string;
  interactionType: string;
  dataHash: string;
  timestamp: bigint;
  blockNumber: bigint;
  isValid: boolean;
}
