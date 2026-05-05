export function formatEth(wei: bigint | string | undefined): string {
  if (!wei) return "0.0";
  const value = typeof wei === "string" ? BigInt(wei) : wei;
  const eth = Number(value) / 1e18;
  return eth.toFixed(4);
}

export function formatAddress(address: string | undefined | null): string {
  if (!address) return "0x...";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

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
  [TaskStatus.Created]: "text-gray-400",
  [TaskStatus.Funded]: "text-biolum-cyan",
  [TaskStatus.InProgress]: "text-synapse-violet",
  [TaskStatus.Submitted]: "text-plasma-pink",
  [TaskStatus.Completed]: "text-neuron-gold",
  [TaskStatus.Failed]: "text-red-400",
  [TaskStatus.Disputed]: "text-orange-400",
};
