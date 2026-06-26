/**
 * Inlined shared types from @covenant/shared-types.
 * Kept local so the MCP package is self-contained when published to npm.
 */
import type { Address, PublicClient, WalletClient } from "viem";

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

export const PRIORITY_LEVEL = {
  0: "Low",
  1: "Medium",
  2: "High",
  3: "Urgent",
} as const;

export const RECEIPT_TYPE = {
  0: "TaskCompleted",
  1: "AgentVerified",
  2: "DisputeResolved",
  3: "InsuranceClaimed",
  4: "MilestoneReached",
  5: "ReputationUpdated",
} as const;

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

export interface ContractAddresses {
  // V5 Core
  CovenantIdentity: Address;
  CovenantEscrow: Address;
  CovenantSettlement: Address;
  CovenantArbitration: Address;
  CovenantAttestation: Address;
  CovenantGovernance: Address;
  // V5 Extensions
  ParallelTaskBatch: Address;
  AgentCollective: Address;
  MultiTokenEscrow: Address;
  COVENANTRouter: Address;
  TrainingMarketplace: Address;
  GrantProgram: Address;
  InsurancePool: Address;
  RevisionManager: Address;
  // Legacy V1 (still deployed, MCP tools may reference)
  AgentRegistry: Address;
  TaskEscrow: Address;
  ReceiptVerifier: Address;
  DisputeArbitration: Address;
  AgentInsurance: Address;
  AgentWallet: Address;
  CapabilityVerifier: Address;
  ReputationVerifier: Address;
  LitProtocolIntegration: Address;
  Groth16VerifierCapability: Address;
  Groth16VerifierReputation: Address;
  OpenTaskMarket: Address;
  AgentSmartWallet: Address;
  CovenantPaymaster: Address;
  AutoVerifier: Address;
  MultiPartyReview: Address;
  ClientReputation: Address;
  StakeSlashing: Address;
  MilestoneVerification: Address;
}

export const BASE_SEPOLIA_ADDRESSES: ContractAddresses = {
  // V5 Core (NEW)
  CovenantIdentity: "0xFa1bFd34290bf12A2F09Ea24Cda05E71cc79c1fF",
  CovenantEscrow: "0x130e2027eB57C427Bf63E2B06d35B10CB20C4b77",
  CovenantSettlement: "0x61124E9aDAd3167ED1DB644a901a5838c8725251",
  CovenantArbitration: "0x4e7abC16c7f8bB65501bb451073a969345611D1d",
  CovenantAttestation: "0x945d1576B71fA332e16B5a5fBD6Ca661B4DD1b8D",
  CovenantGovernance: "0x128A14cf46D3a34c963AcF85a6EdEf6aF7A25342",
  // V5 Extensions (NEW)
  ParallelTaskBatch: "0xaE8C7897ED19A38B416b7B32E58F820d8D5Cd5D8",
  AgentCollective: "0xfc5E4f36e7477F744D1d99dEf13caC02e1C0f9cE",
  MultiTokenEscrow: "0x1930240Ab0c6D6a2d42733a4715067F355761DC1",
  COVENANTRouter: "0xD139a54CcE4d34ebD893E47d8bFA4fcA14f6d022",
  TrainingMarketplace: "0x9A34ea8a30eD68c18b4Eb51B80916B90a7118f3D",
  GrantProgram: "0xE6ce269829E6c33A9038e055De026A804C5c464A",
  InsurancePool: "0x7855E3BDf7d5FdCa33fF911E8B4B034263214371",
  RevisionManager: "0xAEB709652712307092FE10Ffa0a58a0850b82Ad8",
  // Legacy V1 (still deployed)
  AgentRegistry: "0x0003072b15d2c299d46bC5FfE7785E803895E614",
  TaskEscrow: "0x787a26f68536A53D9DB5De63a79Ef21ACA24F71C",
  ReceiptVerifier: "0xEb81ba101a4AE738F8a7eB1d8E636DaD8A96832a",
  DisputeArbitration: "0x3e3Eaf5309E1cf952EB92a4d4285880EB5f7480c",
  AgentInsurance: "0x5Cf2268d2b199bB55171F9191e2b9138e60a4EF8",
  AgentWallet: "0xE3c1188c0FaABCcFbce0895d3137eBa15193348f",
  CapabilityVerifier: "0x628CB2cA13f6FeAc48e0f24f45C3AF2Dbb1c02Fb",
  ReputationVerifier: "0x3a5141b2dD161d7791B681AE10330F30959300ee",
  LitProtocolIntegration: "0x9322B12111699Dd05DD3d0c5D8D08b764051A89f",
  Groth16VerifierCapability: "0xd7108ed5C8577B30f6FC024319ebE8B380DaAb85",
  Groth16VerifierReputation: "0xbe6AfBa53E06099410d78d56A75b689dfCa6532F",
  OpenTaskMarket: "0xF163007a42f00dB4D1296186A9BD07B28fe2a4a7",
  AgentSmartWallet: "0x3c857aADAcFb62F94F121813000E072E788f4d21",
  CovenantPaymaster: "0xd1C5265eF0Cb20c2bBE697d296bAF924754A5fd1",
  AutoVerifier: "0x23f135467fBe0F9f869F0Bf0B30eaaB87a9ec3A7",
  MultiPartyReview: "0x482c435b4Ae3687089A49F9b1FE532FA019e3304",
  ClientReputation: "0x32f84FE07466DdE497b941a02C18E3571f5570f8",
  StakeSlashing: "0xC9BfA9FDcd0b6f1A8B99a29Fc72C0423D6015Be1",
  MilestoneVerification: "0x3Ab1d5f3317e28fFBa607019b4E0AC9243851DF6",
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
    addresses: {
      ...Object.fromEntries(
        Object.keys(BASE_SEPOLIA_ADDRESSES).map((k) => [k, ZERO_ADDRESS])
      ),
    } as unknown as ContractAddresses,
    rpcUrl: "https://mainnet.base.org",
    explorerUrl: "https://basescan.org",
  },
  137: {
    name: "Polygon",
    addresses: {
      ...Object.fromEntries(
        Object.keys(BASE_SEPOLIA_ADDRESSES).map((k) => [k, ZERO_ADDRESS])
      ),
    } as unknown as ContractAddresses,
    rpcUrl: "https://polygon-rpc.com",
    explorerUrl: "https://polygonscan.com",
  },
  42161: {
    name: "Arbitrum One",
    addresses: {
      ...Object.fromEntries(
        Object.keys(BASE_SEPOLIA_ADDRESSES).map((k) => [k, ZERO_ADDRESS])
      ),
    } as unknown as ContractAddresses,
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    explorerUrl: "https://arbiscan.io",
  },
};

// ============================================================================
// SDK Types (inlined for self-containment)
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

export interface TaskData {
  taskId: bigint;
  client: Address;
  worker: Address;
  payment: bigint;
  deadline: bigint;
  descriptionHash: string;
  deliverableHash: string;
  status: string;
  createdAt: bigint;
  completedAt: bigint;
  protocolFee: bigint;
  totalValue: bigint;
}

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
  TrainingMarketplace: Address;
  GrantProgram: Address;
  AutoVerifier: Address;
  MultiPartyReview: Address;
  ClientReputation: Address;
  StakeSlashing: Address;
  MilestoneVerification: Address;
  RevisionManager: Address;
  AgentWallet: Address;
  CovenantIdentity: Address;
  CovenantEscrow: Address;
  CovenantSettlement: Address;
  CovenantArbitration: Address;
  CovenantAttestation: Address;
  CovenantGovernance: Address;
  InsurancePool: Address;
}

export interface CovenantConfig {
  chainId: number;
  publicClient: PublicClient;
  walletClient?: WalletClient;
  contractAddresses?: Partial<ContractAddresses>;
}

export interface ReceiptData {
  receiptId: string;
  issuer: string;
  counterparty: string;
  interactionType: string;
  dataHash: string;
  timestamp: bigint;
  blockNumber: bigint;
  isValid: boolean;
}

export interface BidData {
  taskId: bigint;
  bidder: Address;
  price: bigint;
  timeEstimate: bigint;
  proposalHash: string;
  bidAt: bigint;
  isSelected: boolean;
}

export interface CollectiveData {
  collectiveId: bigint;
  creator: Address;
  members: Address[];
  contributions: bigint[];
  totalFunded: bigint;
  selectedWorker: Address;
  taskId: bigint;
  status: string;
  createdAt: bigint;
}

export type TaskStatus = "Open" | "Created" | "Funded" | "InProgress" | "Submitted" | "Completed" | "Disputed" | "Failed" | "Cancelled";

export type WalletMode = "autonomous" | "prepare-only";
