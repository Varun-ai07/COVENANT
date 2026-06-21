import type { Address } from "viem";
import { BASE_SEPOLIA_ADDRESSES } from "@covenant/shared-types";
import type { ContractAddresses, V2ContractAddresses } from "./types.js";

/**
 * Default contract addresses by chain ID
 */
export const DEFAULT_ADDRESSES: Record<number, ContractAddresses> = {
  // Base Sepolia Testnet
  84532: BASE_SEPOLIA_ADDRESSES,
  // Hardhat Local (placeholder addresses)
  31337: {
    AgentRegistry: "0x0000000000000000000000000000000000000000",
    TaskEscrow: "0x0000000000000000000000000000000000000000",
    ReceiptVerifier: "0x0000000000000000000000000000000000000000",
    OpenTaskMarket: "0x0000000000000000000000000000000000000000",
    ParallelTaskBatch: "0x0000000000000000000000000000000000000000",
    AgentCollective: "0x0000000000000000000000000000000000000000",
    AgentInsurance: "0x0000000000000000000000000000000000000000",
    DisputeArbitration: "0x0000000000000000000000000000000000000000",
    Groth16VerifierCapability: "0x0000000000000000000000000000000000000000",
    CapabilityVerifier: "0x0000000000000000000000000000000000000000",
    Groth16VerifierReputation: "0x0000000000000000000000000000000000000000",
    ReputationVerifier: "0x0000000000000000000000000000000000000000",
    COVENANTRouter: "0x0000000000000000000000000000000000000000",
    LitProtocolIntegration: "0x0000000000000000000000000000000000000000",
    MultiTokenEscrow: "0x0000000000000000000000000000000000000000",
    AgentSmartWallet: "0x0000000000000000000000000000000000000000",
    CovenantPaymaster: "0x0000000000000000000000000000000000000000",
    TrainingMarketplace: "0x0000000000000000000000000000000000000000",
    GrantProgram: "0x0000000000000000000000000000000000000000",
    AutoVerifier: "0x0000000000000000000000000000000000000000",
    MultiPartyReview: "0x0000000000000000000000000000000000000000",
    ClientReputation: "0x0000000000000000000000000000000000000000",
    StakeSlashing: "0x0000000000000000000000000000000000000000",
    MilestoneVerification: "0x0000000000000000000000000000000000000000",
    RevisionManager: "0x0000000000000000000000000000000000000000",
    AgentWallet: "0x0000000000000000000000000000000000000000",
    CovenantIdentity: "0x0000000000000000000000000000000000000000",
    CovenantEscrow: "0x0000000000000000000000000000000000000000",
    CovenantSettlement: "0x0000000000000000000000000000000000000000",
    CovenantArbitration: "0x0000000000000000000000000000000000000000",
    CovenantAttestation: "0x0000000000000000000000000000000000000000",
    CovenantGovernance: "0x0000000000000000000000000000000000000000",
    InsurancePool: "0x0000000000000000000000000000000000000000",
  },
  // Base Mainnet (placeholder - not deployed yet)
  8453: {
    AgentRegistry: "0x0000000000000000000000000000000000000000",
    TaskEscrow: "0x0000000000000000000000000000000000000000",
    ReceiptVerifier: "0x0000000000000000000000000000000000000000",
    OpenTaskMarket: "0x0000000000000000000000000000000000000000",
    ParallelTaskBatch: "0x0000000000000000000000000000000000000000",
    AgentCollective: "0x0000000000000000000000000000000000000000",
    AgentInsurance: "0x0000000000000000000000000000000000000000",
    DisputeArbitration: "0x0000000000000000000000000000000000000000",
    Groth16VerifierCapability: "0x0000000000000000000000000000000000000000",
    CapabilityVerifier: "0x0000000000000000000000000000000000000000",
    Groth16VerifierReputation: "0x0000000000000000000000000000000000000000",
    ReputationVerifier: "0x0000000000000000000000000000000000000000",
    COVENANTRouter: "0x0000000000000000000000000000000000000000",
    LitProtocolIntegration: "0x0000000000000000000000000000000000000000",
    MultiTokenEscrow: "0x0000000000000000000000000000000000000000",
    AgentSmartWallet: "0x0000000000000000000000000000000000000000",
    CovenantPaymaster: "0x0000000000000000000000000000000000000000",
    TrainingMarketplace: "0x0000000000000000000000000000000000000000",
    GrantProgram: "0x0000000000000000000000000000000000000000",
    AutoVerifier: "0x0000000000000000000000000000000000000000",
    MultiPartyReview: "0x0000000000000000000000000000000000000000",
    ClientReputation: "0x0000000000000000000000000000000000000000",
    StakeSlashing: "0x0000000000000000000000000000000000000000",
    MilestoneVerification: "0x0000000000000000000000000000000000000000",
    RevisionManager: "0x0000000000000000000000000000000000000000",
    AgentWallet: "0x0000000000000000000000000000000000000000",
    CovenantIdentity: "0x0000000000000000000000000000000000000000",
    CovenantEscrow: "0x0000000000000000000000000000000000000000",
    CovenantSettlement: "0x0000000000000000000000000000000000000000",
    CovenantArbitration: "0x0000000000000000000000000000000000000000",
    CovenantAttestation: "0x0000000000000000000000000000000000000000",
    CovenantGovernance: "0x0000000000000000000000000000000000000000",
    InsurancePool: "0x0000000000000000000000000000000000000000",
  },
};

/**
 * Default V2 contract addresses by chain ID
 */
export const V2_ADDRESSES: Record<number, V2ContractAddresses> = {
  // Base Sepolia Testnet
  84532: {
    AgentRegistry: "0x773d1954997b6A91e917e0c2326ABCcAf36e21E1",
    TaskEscrow: "0xf4d0765A935E36F888d899D9A7C9156CeCdEa6F5",
    ReceiptVerifier: "0x05cC13692755015FCb11e95d609187b214197edF",
    InsurancePool: "0x920f3925122B3Ce9380A220AA748e67bD787BE1d",
    DisputeResolution: "0xFA6dd0929a4ACCCC2E083DaDaD89226dd71Ef28F",
  },
  // Hardhat Local (placeholder addresses)
  31337: {
    AgentRegistry: "0x0000000000000000000000000000000000000000",
    TaskEscrow: "0x0000000000000000000000000000000000000000",
    ReceiptVerifier: "0x0000000000000000000000000000000000000000",
    InsurancePool: "0x0000000000000000000000000000000000000000",
    DisputeResolution: "0x0000000000000000000000000000000000000000",
  },
  // Base Mainnet (placeholder - not deployed yet)
  8453: {
    AgentRegistry: "0x0000000000000000000000000000000000000000",
    TaskEscrow: "0x0000000000000000000000000000000000000000",
    ReceiptVerifier: "0x0000000000000000000000000000000000000000",
    InsurancePool: "0x0000000000000000000000000000000000000000",
    DisputeResolution: "0x0000000000000000000000000000000000000000",
  },
};

/**
 * Chain configurations
 */
export const CHAIN_CONFIGS = {
  84532: {
    chain: {
      id: 84532,
      name: "Base Sepolia",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: ["https://sepolia.base.org"] } },
    },
  },
  8453: {
    chain: {
      id: 8453,
      name: "Base",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: ["https://mainnet.base.org"] } },
    },
  },
  31337: {
    chain: {
      id: 31337,
      name: "Hardhat Local",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: ["http://localhost:8545"] } },
    },
  },
} as const;

/**
 * Chain configurations (legacy export)
 */
export const CHAINS = {
  baseSepolia: {
    id: 84532,
    name: "Base Sepolia",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://sepolia.base.org"] },
    },
    blockExplorers: {
      default: { name: "Basescan", url: "https://sepolia.basescan.org" },
    },
    testnet: true,
  },
  base: {
    id: 8453,
    name: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://mainnet.base.org"] },
    },
    blockExplorers: {
      default: { name: "Basescan", url: "https://basescan.org" },
    },
  },
} as const;

/**
 * Get contract addresses for a chain ID with optional overrides
 */
export function getContractAddresses(
  chainId: number,
  overrides?: Partial<ContractAddresses>
): ContractAddresses {
  const defaults = DEFAULT_ADDRESSES[chainId];
  if (!defaults) {
    throw new Error(`Unsupported chain ID: ${chainId}. Supported: ${Object.keys(DEFAULT_ADDRESSES).join(", ")}`);
  }
  return { ...defaults, ...overrides };
}

/**
 * Check if contracts are deployed on a chain
 */
export function isDeployed(chainId: number): boolean {
  const addresses = DEFAULT_ADDRESSES[chainId];
  if (!addresses) return false;
  return addresses.AgentRegistry !== "0x0000000000000000000000000000000000000000";
}

/**
 * Get V2 contract addresses for a chain ID with optional overrides
 */
export function getV2ContractAddresses(
  chainId: number,
  overrides?: Partial<V2ContractAddresses>
): V2ContractAddresses {
  const defaults = V2_ADDRESSES[chainId];
  if (!defaults) {
    throw new Error(`Unsupported chain ID for V2: ${chainId}. Supported: ${Object.keys(V2_ADDRESSES).join(", ")}`);
  }
  return { ...defaults, ...overrides };
}
