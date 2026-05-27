import type { Address, Hash, Abi } from "viem";

// ============================================================
// Re-export canonical types from @covenant/shared-types
// ============================================================

export { TASK_STATUS, PRIORITY_LEVEL, RECEIPT_TYPE, BASE_SEPOLIA_ADDRESSES } from "@covenant/shared-types";

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
  // V2 Extensions (populated when CONTRACT_VERSION=v2)
  InsurancePool?: Address;
  RevisionManager?: Address;
  MultiTokenEscrow?: Address;
}

export interface ContractConfigV2 {
  // Core Protocol (v2)
  AgentRegistry: Address;
  TaskEscrow: Address;
  ReceiptVerifier: Address;
  // Extensions (v2)
  InsurancePool: Address;
  DisputeResolution: Address;
  MultiTokenEscrow: Address;
  RevisionManager: Address;
}

export type ContractVersion = "v1" | "v2";

/** Merged contract config: v1 base + v2 overrides for core contracts */
export type ContractConfigMerged = ContractConfig & Partial<ContractConfigV2>;

// ============================================================
// MCP Tool Result (re-export for convenience)
// ============================================================

export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}
