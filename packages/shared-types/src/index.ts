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
  // V1 names (backward compat)
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
  TrainingMarketplace: Address;
  GrantProgram: Address;
  AutoVerifier: Address;
  MultiPartyReview: Address;
  ClientReputation: Address;
  StakeSlashing: Address;
  MilestoneVerification: Address;
  RevisionManager: Address;
  AgentWallet: Address;
  // V5 contracts
  CovenantIdentity: Address;
  CovenantEscrow: Address;
  CovenantSettlement: Address;
  CovenantArbitration: Address;
  CovenantAttestation: Address;
  CovenantGovernance: Address;
  InsurancePool: Address;
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
  AgentRegistry: "0x0003072b15d2c299d46bC5FfE7785E803895E614",
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
  TrainingMarketplace: "0x284651b6506A542530d74502e0C35704f977D4F3",
  GrantProgram: "0x92C356302038c8844503A5730888Ca0E96d73CcC",
  AutoVerifier: "0xad7A6453447d720b715E106F2e331fAcfb4B21d1",
  MultiPartyReview: "0x8B1D433D1f744004c7E375e07143869FeA4482F1",
  ClientReputation: "0x4de4694b5a509081949BA599e8AB9Fa9784188d9",
  StakeSlashing: "0x3b56AB51e2D34d403aaB3D3F89c3Cee57DFFD946",
  MilestoneVerification: "0x2aC422503988556645e7923E9CBCb2DB68d35CD7",
  RevisionManager: "0x2484636Dd3bF529C33B2C12D2D4d7b6942F85357",
  AgentWallet: "0x0000000000000000000000000000000000000000",
  CovenantIdentity: "0x623ff6F56754fb4CB4d60e46FF1F4AA3f34A5aAA",
  CovenantEscrow: "0x259338371e67cA712F22A95cb8b616f3926b0E4D",
  CovenantSettlement: "0xF8deBc17DE3B5D501307166EA40FC2C460997B2D",
  CovenantArbitration: "0x5b8CcBd735DA802e6B81a49b78BdA5A29159926f",
  CovenantAttestation: "0x9B314674cb8C3123a6e80832b8A56C28C2e58490",
  CovenantGovernance: "0x6e7Be799ba629289eC675f19bbB8f0029E719E73",
  InsurancePool: "0x5e4A41CA094a68d69b84F0Bb9Fa454ba3e1df00a",
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
  TrainingMarketplace: ZERO_ADDRESS,
  GrantProgram: ZERO_ADDRESS,
  AutoVerifier: ZERO_ADDRESS,
  MultiPartyReview: ZERO_ADDRESS,
  ClientReputation: ZERO_ADDRESS,
  StakeSlashing: ZERO_ADDRESS,
  MilestoneVerification: ZERO_ADDRESS,
  RevisionManager: ZERO_ADDRESS,
  AgentWallet: ZERO_ADDRESS,
  CovenantIdentity: ZERO_ADDRESS,
  CovenantEscrow: ZERO_ADDRESS,
  CovenantSettlement: ZERO_ADDRESS,
  CovenantArbitration: ZERO_ADDRESS,
  CovenantAttestation: ZERO_ADDRESS,
  CovenantGovernance: ZERO_ADDRESS,
  InsurancePool: ZERO_ADDRESS,
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
  TrainingMarketplace: ZERO_ADDRESS,
  GrantProgram: ZERO_ADDRESS,
  AutoVerifier: ZERO_ADDRESS,
  MultiPartyReview: ZERO_ADDRESS,
  ClientReputation: ZERO_ADDRESS,
  StakeSlashing: ZERO_ADDRESS,
  MilestoneVerification: ZERO_ADDRESS,
  RevisionManager: ZERO_ADDRESS,
  AgentWallet: ZERO_ADDRESS,
  CovenantIdentity: ZERO_ADDRESS,
  CovenantEscrow: ZERO_ADDRESS,
  CovenantSettlement: ZERO_ADDRESS,
  CovenantArbitration: ZERO_ADDRESS,
  CovenantAttestation: ZERO_ADDRESS,
  CovenantGovernance: ZERO_ADDRESS,
  InsurancePool: ZERO_ADDRESS,
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
  TrainingMarketplace: ZERO_ADDRESS,
  GrantProgram: ZERO_ADDRESS,
  AutoVerifier: ZERO_ADDRESS,
  MultiPartyReview: ZERO_ADDRESS,
  ClientReputation: ZERO_ADDRESS,
  StakeSlashing: ZERO_ADDRESS,
  MilestoneVerification: ZERO_ADDRESS,
  RevisionManager: ZERO_ADDRESS,
  AgentWallet: ZERO_ADDRESS,
  CovenantIdentity: ZERO_ADDRESS,
  CovenantEscrow: ZERO_ADDRESS,
  CovenantSettlement: ZERO_ADDRESS,
  CovenantArbitration: ZERO_ADDRESS,
  CovenantAttestation: ZERO_ADDRESS,
  CovenantGovernance: ZERO_ADDRESS,
  InsurancePool: ZERO_ADDRESS,
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
