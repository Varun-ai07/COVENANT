import type { Address, PublicClient, WalletClient } from "viem";

// ============================================================================
// Re-export canonical types from @covenant/shared-types
// ============================================================================

export type {
  ContractAddresses,
  AgentData,
  TaskData,
  ReceiptData,
  BidData,
  CollectiveData,
  TaskStatus,
} from "@covenant/shared-types";

export {
  TASK_STATUS,
  PRIORITY_LEVEL,
  RECEIPT_TYPE,
  BASE_SEPOLIA_ADDRESSES,
} from "@covenant/shared-types";

// ============================================================================
// V2 Types
// ============================================================================

/**
 * ERC-8004 Receipt type enum (mirrors on-chain ReceiptVerifier.ReceiptType)
 */
export enum ReceiptType {
  TaskCompleted = 0,
  AgentVerified = 1,
  DisputeResolved = 2,
  InsuranceClaimed = 3,
  MilestoneReached = 4,
  ReputationUpdated = 5,
}

/**
 * V2 Receipt data from ReceiptVerifier v2
 */
export interface ReceiptDataV2 {
  receiptId: `0x${string}`;
  issuer: Address;
  counterparty: Address;
  receiptType: number;
  dataHash: `0x${string}`;
  timestamp: bigint;
  isValid: boolean;
}

/**
 * Insurance claim data
 */
export interface InsuranceClaimData {
  claimant: Address;
  taskId: bigint;
  amount: bigint;
  paid: boolean;
  timestamp: bigint;
}

/**
 * Insurance pool member info
 */
export interface MemberInfo {
  active: boolean;
  contributed: bigint;
}

/**
 * Dispute data from DisputeResolution
 */
export interface DisputeData {
  taskId: bigint;
  filedBy: Address;
  bondAmount: bigint;
  votingEndsAt: bigint;
  resolved: boolean;
  workerWins: boolean;
  workerShare: bigint;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * V2 contract addresses
 */
export interface V2ContractAddresses {
  AgentRegistry: Address;
  TaskEscrow: Address;
  ReceiptVerifier: Address;
  InsurancePool: Address;
  DisputeResolution: Address;
}

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
 * V2 SDK configuration — extends base config with version selection
 */
export interface CovenantConfigV2 extends CovenantConfig {
  /** SDK version — "v2" enables v2 contract methods */
  version: "v2";
  /** Custom v2 contract addresses (optional - uses defaults if not provided) */
  v2ContractAddresses?: Partial<V2ContractAddresses>;
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

  // Router & Integration
  COVENANTRouter?: Address;
  LitProtocolIntegration?: Address;
  // Wallet
  AgentWallet?: Address;
}

// ============================================================================
// V4 Types
// ============================================================================

export type { V4ContractAddresses } from "@covenant/shared-types";

/**
 * V4 SDK configuration — extends base config with version selection
 */
export interface V4Config extends CovenantConfig {
  /** SDK version — "v4" enables v4 contract methods */
  version: "v4";
  /** Custom v4 contract addresses (optional - uses defaults if not provided) */
  v4ContractAddresses?: Partial<import("@covenant/shared-types").V4ContractAddresses>;
}

// ============================================================================
// Viem Type Re-exports
// ============================================================================

// Re-export viem types that SDK consumers need
export type { Address, PublicClient, WalletClient } from "viem";
export type { Hash, Log, TransactionReceipt } from "viem";
