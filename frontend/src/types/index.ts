// Agent type matching AgentRegistry.Agent struct
export interface Agent {
  did: string;
  name: string;
  capabilities: string[];
  reputation: bigint;
  stakedAmount: bigint;
  tasksCompleted: bigint;
  tasksFailed: bigint;
  totalValueTransferred: bigint;
  isActive: boolean;
  registeredAt: bigint;
}

// Task status enum
export enum TaskStatus {
  Created = 0,
  Funded = 1,
  InProgress = 2,
  Submitted = 3,
  Completed = 4,
  Failed = 5,
  Disputed = 6,
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.Created]: "Created",
  [TaskStatus.Funded]: "Funded",
  [TaskStatus.InProgress]: "In Progress",
  [TaskStatus.Submitted]: "Submitted",
  [TaskStatus.Completed]: "Completed",
  [TaskStatus.Failed]: "Failed",
  [TaskStatus.Disputed]: "Disputed",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  [TaskStatus.Created]: "bg-gray-500",
  [TaskStatus.Funded]: "bg-blue-500",
  [TaskStatus.InProgress]: "bg-amber-500",
  [TaskStatus.Submitted]: "bg-purple-500",
  [TaskStatus.Completed]: "bg-emerald-500",
  [TaskStatus.Failed]: "bg-red-500",
  [TaskStatus.Disputed]: "bg-orange-500",
};

// Task type matching TaskEscrow.Task struct
export interface Task {
  client: string;
  worker: string;
  payment: bigint;
  deadline: bigint;
  descriptionHash: string;
  deliverableHash: string;
  status: TaskStatus;
  createdAt: bigint;
  completedAt: bigint;
}

// Receipt type matching ReceiptVerifier.Receipt struct
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

// IPFS data types
export interface TaskDescription {
  title: string;
  description: string;
  instructions?: string;
  encrypted: boolean;
  clientPublicKey?: string;
  ciphertext?: string;
  iv?: string;
}

export interface Deliverable {
  task: string;
  report: string;
  completedAt: string;
  workerAddress: string;
}

// Reputation level helper
export function getReputationLevel(reputation: number): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (reputation >= 800) return { label: "Excellent", color: "text-emerald-400", bgColor: "bg-emerald-500" };
  if (reputation >= 600) return { label: "Good", color: "text-green-400", bgColor: "bg-green-500" };
  if (reputation >= 400) return { label: "Average", color: "text-amber-400", bgColor: "bg-amber-500" };
  if (reputation >= 200) return { label: "Poor", color: "text-orange-400", bgColor: "bg-orange-500" };
  return { label: "Critical", color: "text-red-400", bgColor: "bg-red-500" };
}

// Format address helper
export function formatAddress(address: string, chars = 4): string {
  return `${address.slice(0, 2 + chars)}...${address.slice(-chars)}`;
}

// Format ETH helper
export function formatEth(value: bigint, decimals = 4): string {
  const eth = Number(value) / 1e18;
  return eth.toFixed(decimals);
}
