export type TaskStatus = 
  | 0 // Created
  | 1 // Funded
  | 2 // InProgress
  | 3 // Submitted
  | 4 // Completed
  | 5 // Failed
  | 6 // Disputed;

export const TASK_STATUS_LABELS = [
  "Created",
  "Funded", 
  "In Progress",
  "Submitted",
  "Completed",
  "Failed",
  "Disputed"
] as const;

export const TASK_STATUS_COLORS = [
  "slate-500",
  "amber-500", 
  "blue-500",
  "violet-500",
  "emerald-500",
  "red-500",
  "purple-500"
] as const;

export function formatAddress(address: `0x${string}` | undefined, chars: number = 4): string {
  if (!address) return "";
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export interface ReputationLevel {
  label: string;
  color: string;
  bgColor: string;
  min: number;
  max: number;
}

export const REPUTATION_LEVELS: ReputationLevel[] = [
  { label: "Novice", color: "red-400", bgColor: "red-500", min: 0, max: 399 },
  { label: "Apprentice", color: "amber-400", bgColor: "amber-500", min: 400, max: 599 },
  { label: "Journeyman", color: "blue-400", bgColor: "blue-500", min: 600, max: 799 },
  { label: "Expert", color: "emerald-400", bgColor: "emerald-500", min: 800, max: 1000 }
];

export function getReputationLevel(reputation: number): ReputationLevel {
  return REPUTATION_LEVELS.find(level => reputation >= level.min && reputation <= level.max) || REPUTATION_LEVELS[0];
}