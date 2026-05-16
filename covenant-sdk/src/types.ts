import type { Address, PublicClient, WalletClient } from "viem";

// ============================================================================
// Core Types
// ============================================================================

/**
 * Agent data returned from the registry
 */
export interface AgentData {
  did: `0x${string}`;
  name: string;
  capabilities: string[];
  reputation: bigint;
  stakedAmount: bigint;
  tasksCompleted: bigint;
  tasksFailed: bigint;
  totalValueTransferred: bigint;
  isActive: boolean;
  registeredAt: bigint;
  walletAddress: Address;
}

/**
 * Task status enum
 */
export type TaskStatus =
  | "Open"
  | "Funded"
  | "InProgress"
  | "Submitted"
  | "Completed"
  | "Disputed"
  | "Failed"
  | "Cancelled";

/**
 * Task data structure
 */
export interface TaskData {
  taskId: bigint;
  client: Address;
  worker: Address;
  payment: bigint;
  deadline: bigint;
  descriptionHash: string;
  deliverableHash: string;
  status: TaskStatus;
  createdAt: bigint;
  completedAt: bigint;
  protocolFee: bigint;
  totalValue: bigint;
}

/**
 * Receipt data from ReceiptVerifier
 */
export interface ReceiptData {
  receiptId: bigint;
  issuer: Address;
  counterparty: Address;
  interactionType: string;
  dataHash: `0x${string}`;
  timestamp: bigint;
  verified: boolean;
}

/**
 * Bid data from OpenTaskMarket
 */
export interface BidData {
  taskId: bigint;
  bidder: Address;
  price: bigint;
  timeEstimate: bigint;
  proposalHash: string;
  bidAt: bigint;
  isSelected: boolean;
}

/**
 * Collective funding pool data
 */
export interface CollectiveData {
  collectiveId: bigint;
  creator: Address;
  members: Address[];
  contributions: bigint[];
  totalFunded: bigint;
  selectedWorker: Address;
  taskId: bigint;
  status: "Open" | "Funded" | "InProgress" | "Completed";
  createdAt: bigint;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * SDK configuration
 */
export interface CovenantConfig {
  /** Chain ID (84532 for Base Sepolia, 8453 for Base Mainnet) */
  chainId: number;
  /** Viem public client for reading */
  publicClient: PublicClient;
  /** Optional wallet client for writing */
  walletClient?: WalletClient;
  /** Custom contract addresses (optional - uses defaults if not provided) */
  contractAddresses?: PartialContractAddresses;
}

/**
 * Partial contract addresses - only specify what you want to override
 */
export interface PartialContractAddresses {
  // Core Protocol
  AgentRegistry?: Address;
  TaskEscrow?: Address;
  ReceiptVerifier?: Address;
  // Market & Batching
  OpenTaskMarket?: Address;
  ParallelTaskBatch?: Address;
  // Collective & Insurance
  AgentCollective?: Address;
  AgentInsurance?: Address;
  // Dispute Resolution
  DisputeArbitration?: Address;
  // ZK Verifiers
  Groth16VerifierCapability?: Address;
  CapabilityVerifier?: Address;
  Groth16VerifierReputation?: Address;
  ReputationVerifier?: Address;
  // Router & Integration
  COVENANTRouter?: Address;
  LitProtocolIntegration?: Address;
}

/**
 * Full contract addresses
 */
export interface ContractAddresses {
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
}

// ============================================================================
// Viem Type Re-exports
// ============================================================================

// Re-export viem types that SDK consumers need
export type { Address, PublicClient, WalletClient } from "viem";
export type { Hash, Log, TransactionReceipt } from "viem";
