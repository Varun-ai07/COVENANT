/** Safely convert a value to bigint. Returns 0n for invalid/non-numeric input. */
export function safeBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value))
    return BigInt(Math.trunc(value));
  if (typeof value === "string") {
    const trimmed = value.trim();
    // Only accept decimal digits (optionally negative) or 0x-prefixed hex
    if (/^-?\d+$/.test(trimmed)) return BigInt(trimmed);
    if (/^0x[0-9a-fA-F]+$/.test(trimmed)) return BigInt(trimmed);
  }
  return 0n;
}

export function formatEth(wei: bigint | string | number | undefined | null): string {
  if (!wei) return "0.0";
  const value = safeBigInt(wei);
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
  [TaskStatus.Created]: "text-muted",
  [TaskStatus.Funded]: "text-info",
  [TaskStatus.InProgress]: "text-accent",
  [TaskStatus.Submitted]: "text-warning",
  [TaskStatus.Completed]: "text-success",
  [TaskStatus.Failed]: "text-danger",
  [TaskStatus.Disputed]: "text-warning",
};
