import { type Address } from "viem";

export type HexHash = `0x${string}`;

// ─── Agent Insurance ────────────────────────────────────────────

export interface InsurancePolicy {
  agent: Address;
  premiumPaid: bigint;
  enrolledAt: number;
  expiresAt: number;
  active: boolean;
}

export interface InsuranceClaim {
  id: string;
  taskId: string;
  agent: Address;
  amountRequested: bigint;
  evidence: string[];
  status: "submitted" | "under-review" | "approved" | "rejected" | "paid";
  createdAt: number;
  reviewedBy: Address | null;
  reviewNotes: string;
  paidAt: number | null;
}

export interface InsurancePoolStats {
  totalPremiums: bigint;
  totalClaimsPaid: bigint;
  activePolicies: number;
  pendingClaims: number;
  poolBalance: bigint;
  claimSuccessRate: number;
}

// ─── Agent Collective ───────────────────────────────────────────

export interface Collective {
  id: string;
  name: string;
  description: string;
  creator: Address;
  members: Address[];
  treasury: bigint;
  createdAt: number;
  active: boolean;
  metadata: CollectiveMetadata;
}

export interface CollectiveMetadata {
  purpose: string;
  minStake: string;
  maxMembers: number;
  profitSplit: Record<Address, number>;
  tags: string[];
}

export interface CollectiveProposal {
  id: string;
  collectiveId: string;
  title: string;
  description: string;
  proposedBy: Address;
  targetAction: string;
  callData: string;
  votesFor: Address[];
  votesAgainst: Address[];
  status: "pending" | "active" | "passed" | "rejected" | "executed";
  createdAt: number;
  votingEnd: number;
  quorum: number;
}

export interface CollectiveTask {
  id: string;
  collectiveId: string;
  title: string;
  description: string;
  budget: bigint;
  deadline: number;
  assignedTo: Address | null;
  status: "open" | "assigned" | "in-progress" | "completed" | "cancelled";
  createdAt: number;
}

// ─── Open Task Market ───────────────────────────────────────────

export interface TaskListing {
  id: string;
  title: string;
  description: string;
  category: string;
  budget: bigint;
  deadline: number;
  requiredCapabilities: string[];
  client: Address;
  status: "open" | "in-progress" | "completed" | "cancelled";
  selectedWorker: Address | null;
  createdAt: number;
  escrowTaskId: number | null;
  metadata: TaskMetadata;
}

export interface TaskMetadata {
  difficulty: "easy" | "medium" | "hard";
  estimatedHours: number;
  tags: string[];
  attachments: string[];
  maxBids: number;
}

export interface Bid {
  id: string;
  taskId: string;
  worker: Address;
  price: bigint;
  proposal: string;
  estimatedDuration: number;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  createdAt: number;
}

export interface TaskMatch {
  taskId: string;
  worker: Address;
  score: number;
  reasons: string[];
}

// ─── Coordinator Config ─────────────────────────────────────────

export interface CoordinatorConfig {
  identityAddress: Address;
  escrowAddress: Address;
  settlementAddress: Address;
  identityAbi: any;
  escrowAbi: any;
  settlementAbi: any;
  publicClient: any;
  walletClient: any;
}
