/**
 * @covenant/shared-types — Canonical type definitions for COVENANT protocol.
 *
 * Both covenant-sdk and @covenant/mcp import from this package to avoid
 * type duplication. SDK consumers get bigint types; MCP consumers get
 * JSON-serializable types via the adapter functions below.
 */
import type { Address } from "viem";

// ============================================================================
// Contract Addresses (canonical)
// ============================================================================

export interface ContractAddresses {
  AgentRegistry: Address;
  TaskEscrow: Address;
  ReceiptVerifier: Address;
  OpenTaskMarket: Address;
  ParallelTaskBatch: Address;
  AgentCollective: Address;
  AgentInsurance: Address;
  DisputeArbitration: Address;
  Groth16VerifierCapability: Address;
  CapabilityVerifier: Address;
  Groth16VerifierReputation: Address;
  ReputationVerifier: Address;
  COVENANTRouter: Address;
  LitProtocolIntegration: Address;
  MultiTokenEscrow: Address;
  AgentSmartWallet: Address;
  CovenantPaymaster: Address;
  AgentWallet: Address;
}

export type PartialContractAddresses = Partial<ContractAddresses>;

// ============================================================================
// Task Status (canonical)
// ============================================================================

export const TASK_STATUS = {
  0: "Created",
  1: "Funded",
  2: "InProgress",
  3: "Submitted",
  4: "Completed",
  5: "Failed",
  6: "Disputed",
  7: "Cancelled",
} as const;

export type TaskStatusName = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

export type TaskStatus =
  | "Open"
  | "Created"
  | "Funded"
  | "InProgress"
  | "Submitted"
  | "Completed"
  | "Disputed"
  | "Failed"
  | "Cancelled";

// ============================================================================
// Priority Levels
// ============================================================================

export const PRIORITY_LEVEL = {
  0: "Low",
  1: "Medium",
  2: "High",
  3: "Urgent",
} as const;

export type PriorityLevel = keyof typeof PRIORITY_LEVEL;

// ============================================================================
// Receipt Types (ERC-8004)
// ============================================================================

export const RECEIPT_TYPE = {
  0: "TaskCompleted",
  1: "AgentVerified",
  2: "DisputeResolved",
  3: "InsuranceClaimed",
  4: "MilestoneReached",
  5: "ReputationUpdated",
} as const;

export type ReceiptTypeName = (typeof RECEIPT_TYPE)[keyof typeof RECEIPT_TYPE];

// ============================================================================
// Agent Data (SDK-native, bigint)
// ============================================================================

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

// ============================================================================
// Task Data (SDK-native, bigint)
// ============================================================================

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

// ============================================================================
// Receipt Data (SDK-native, bigint)
// ============================================================================

export interface ReceiptData {
  receiptId: bigint;
  issuer: Address;
  counterparty: Address;
  interactionType: string;
  dataHash: `0x${string}`;
  timestamp: bigint;
  verified: boolean;
}

// ============================================================================
// Bid Data
// ============================================================================

export interface BidData {
  taskId: bigint;
  bidder: Address;
  price: bigint;
  timeEstimate: bigint;
  proposalHash: string;
  bidAt: bigint;
  isSelected: boolean;
}

// ============================================================================
// Collective Data
// ============================================================================

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
// Protocol Stats
// ============================================================================

export interface ProtocolStats {
  totalAgents: number;
  totalTasks: number;
  completedTasks: number;
  totalVolume: string;
  totalFees: string;
  activeAgents: number;
}

// ============================================================================
// MCP-Specific Types (JSON-serializable for JSON-RPC)
// ============================================================================

export type WalletMode = "autonomous" | "prepare-only";

export interface TxSuccess {
  status: "success";
  txHash: `0x${string}`;
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

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

// ============================================================================
// Base Sepolia Addresses (default)
// ============================================================================

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

export const BASE_SEPOLIA_ADDRESSES: ContractAddresses = {
  AgentRegistry: "0xB215589dA259A98eEE8BF39739F6255131ac33A1",
  TaskEscrow: "0xFD081B5cB8bAE37DC878078bE3165932b0bC0BB3",
  ReceiptVerifier: "0xa47D15099be6aC516B53a6859D468E9004eEf76b",
  OpenTaskMarket: "0x5ccF09469222E5046b0830c6d71ed6B912bE70e6",
  ParallelTaskBatch: "0xaf23D40668f0e33426824Bf2027A0E9cD26c11Bc",
  AgentCollective: "0x0CDE9560D2E95338922c40A52A2c81cdd20613d1",
  AgentInsurance: "0x1798d370e3C566001A84F38EbDc0F6F1Db6bdd55",
  DisputeArbitration: "0x37A62C6eDd18461CCe00B6772Da8640C75DE740e",
  Groth16VerifierCapability: "0xd7108ed5C8577B30f6FC024319ebE8B380DaAb85",
  CapabilityVerifier: "0x628CB2cA13f6FeAc48e0f24f45C3AF2Dbb1c02Fb",
  Groth16VerifierReputation: "0xbe6AfBa53E06099410d78d56A75b689dfCa6532F",
  ReputationVerifier: "0x1ac2532e39591cdb5E00Fb9d7C0f47E082d0F149",
  COVENANTRouter: "0x565C48FEFc39c9D98a37cCE30583913C7d0d5e09",
  LitProtocolIntegration: "0x9322B12111699Dd05DD3d0c5D8D08b764051A89f",
  MultiTokenEscrow: "0x0bd7E7E75AA828957AfE7445E17E58A278Bf256e",
  AgentSmartWallet: "0x3c857aADAcFb62F94F121813000E072E788f4d21",
  CovenantPaymaster: "0xd1C5265eF0Cb20c2bBE697d296bAF924754A5fd1",
  AgentWallet: "0x0000000000000000000000000000000000000000",
};

export const POLYGON_ADDRESSES: ContractAddresses = {
  AgentRegistry: ZERO_ADDRESS,
  TaskEscrow: ZERO_ADDRESS,
  ReceiptVerifier: ZERO_ADDRESS,
  OpenTaskMarket: ZERO_ADDRESS,
  ParallelTaskBatch: ZERO_ADDRESS,
  AgentCollective: ZERO_ADDRESS,
  AgentInsurance: ZERO_ADDRESS,
  DisputeArbitration: ZERO_ADDRESS,
  Groth16VerifierCapability: ZERO_ADDRESS,
  CapabilityVerifier: ZERO_ADDRESS,
  Groth16VerifierReputation: ZERO_ADDRESS,
  ReputationVerifier: ZERO_ADDRESS,
  COVENANTRouter: ZERO_ADDRESS,
  LitProtocolIntegration: ZERO_ADDRESS,
  MultiTokenEscrow: ZERO_ADDRESS,
  AgentSmartWallet: ZERO_ADDRESS,
  CovenantPaymaster: ZERO_ADDRESS,
  AgentWallet: ZERO_ADDRESS,
};

export const ARBITRUM_ADDRESSES: ContractAddresses = {
  AgentRegistry: ZERO_ADDRESS,
  TaskEscrow: ZERO_ADDRESS,
  ReceiptVerifier: ZERO_ADDRESS,
  OpenTaskMarket: ZERO_ADDRESS,
  ParallelTaskBatch: ZERO_ADDRESS,
  AgentCollective: ZERO_ADDRESS,
  AgentInsurance: ZERO_ADDRESS,
  DisputeArbitration: ZERO_ADDRESS,
  Groth16VerifierCapability: ZERO_ADDRESS,
  CapabilityVerifier: ZERO_ADDRESS,
  Groth16VerifierReputation: ZERO_ADDRESS,
  ReputationVerifier: ZERO_ADDRESS,
  COVENANTRouter: ZERO_ADDRESS,
  LitProtocolIntegration: ZERO_ADDRESS,
  MultiTokenEscrow: ZERO_ADDRESS,
  AgentSmartWallet: ZERO_ADDRESS,
  CovenantPaymaster: ZERO_ADDRESS,
  AgentWallet: ZERO_ADDRESS,
};

export const BASE_MAINNET_ADDRESSES: ContractAddresses = {
  AgentRegistry: ZERO_ADDRESS,
  TaskEscrow: ZERO_ADDRESS,
  ReceiptVerifier: ZERO_ADDRESS,
  OpenTaskMarket: ZERO_ADDRESS,
  ParallelTaskBatch: ZERO_ADDRESS,
  AgentCollective: ZERO_ADDRESS,
  AgentInsurance: ZERO_ADDRESS,
  DisputeArbitration: ZERO_ADDRESS,
  Groth16VerifierCapability: ZERO_ADDRESS,
  CapabilityVerifier: ZERO_ADDRESS,
  Groth16VerifierReputation: ZERO_ADDRESS,
  ReputationVerifier: ZERO_ADDRESS,
  COVENANTRouter: ZERO_ADDRESS,
  LitProtocolIntegration: ZERO_ADDRESS,
  MultiTokenEscrow: ZERO_ADDRESS,
  AgentSmartWallet: ZERO_ADDRESS,
  CovenantPaymaster: ZERO_ADDRESS,
  AgentWallet: ZERO_ADDRESS,
};

export interface ChainConfig {
  name: string;
  addresses: ContractAddresses;
  rpcUrl: string;
  explorerUrl: string;
}

export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  84532: {
    name: "Base Sepolia",
    addresses: BASE_SEPOLIA_ADDRESSES,
    rpcUrl: "https://sepolia.base.org",
    explorerUrl: "https://sepolia.basescan.org",
  },
  8453: {
    name: "Base Mainnet",
    addresses: BASE_MAINNET_ADDRESSES,
    rpcUrl: "https://mainnet.base.org",
    explorerUrl: "https://basescan.org",
  },
  137: {
    name: "Polygon",
    addresses: POLYGON_ADDRESSES,
    rpcUrl: "https://polygon-rpc.com",
    explorerUrl: "https://polygonscan.com",
  },
  42161: {
    name: "Arbitrum One",
    addresses: ARBITRUM_ADDRESSES,
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    explorerUrl: "https://arbiscan.io",
  },
};
