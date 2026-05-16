import type { Address, Hash, Abi } from "viem";

// ============================================================
// Wallet & Transaction Types
// ============================================================

export type WalletMode = "autonomous" | "prepare-only";

export interface TxSuccess {
  status: "success";
  txHash: Hash;
  blockNumber: bigint;
  gasUsed: bigint;
}

export interface TxPrepared {
  status: "prepared";
  to: Address;
  data: `0x${string}`;
  value: bigint;
  chainId: number;
  nonce: number;
  expiresAt: number;
}

export interface TxError {
  status: "error";
  error: string;
  reason?: string;
}

export type TxResult = TxSuccess | TxPrepared | TxError;

// ============================================================
// Agent Types
// ============================================================

export interface AgentInfo {
  address: Address;
  name: string;
  did: string;
  reputation: number;
  stakedAmount: string;
  capabilities: string[];
  isRegistered: boolean;
  tasksCompleted: number;
  tasksFailed: number;
  registeredAt: number;
}

// ============================================================
// Task Types
// ============================================================

export interface TaskInfo {
  taskId: number;
  client: Address;
  worker: Address;
  payment: string;
  deadline: number;
  status: number;
  descriptionHash: string;
  deliverableHash: string;
  createdAt: number;
  completedAt: number;
  isFunded: boolean;
  priorityLevel: number;
}

export const TASK_STATUS: Record<number, string> = {
  0: "Created",
  1: "Funded",
  2: "InProgress",
  3: "Submitted",
  4: "Completed",
  5: "Failed",
  6: "Disputed",
  7: "Cancelled",
};

export const PRIORITY_LEVEL: Record<number, string> = {
  0: "Low (0.5% fee)",
  1: "Medium (1% fee)",
  2: "High (2% fee)",
  3: "Urgent (5% fee)",
};

// ============================================================
// Receipt Types
// ============================================================

export interface ReceiptInfo {
  receiptId: number;
  issuer: Address;
  counterparty: Address;
  interactionType: number;
  taskId: number;
  dataHash: string;
  timestamp: number;
  isValid: boolean;
}

export const RECEIPT_TYPE: Record<number, string> = {
  0: "TaskCompletion",
  1: "PaymentReceived",
  2: "DisputeResolved",
  3: "ReputationUpdate",
  4: "CapabilityVerified",
};

// ============================================================
// Protocol Stats
// ============================================================

export interface ProtocolStats {
  totalAgents: number;
  totalTasks: number;
  completedTasks: number;
  totalVolume: string;
  totalFees: string;
  activeAgents: number;
}

// ============================================================
// Contract Config
// ============================================================

export interface ContractConfig {
  // Core Protocol
  AgentRegistry: Address;
  TaskEscrow: Address;
  ReceiptVerifier: Address;
  // Market & Batching
  OpenTaskMarket: Address;
  ParallelTaskBatch: Address;
  // Collective & Insurance
  AgentCollective: Address;
  AgentInsurance: Address;
  // Dispute Resolution
  DisputeArbitration: Address;
  // ZK Verifiers
  Groth16VerifierCapability: Address;
  CapabilityVerifier: Address;
  Groth16VerifierReputation: Address;
  ReputationVerifier: Address;
  // Router & Integration
  COVENANTRouter: Address;
  LitProtocolIntegration: Address;
  // Wallet (sample)
  AgentWallet: Address;
}

// ============================================================
// MCP Tool Result (re-export for convenience)
// ============================================================

export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}
