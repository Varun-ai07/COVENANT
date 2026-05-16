import type { Address } from "viem";
import type { ContractAddresses } from "./types.js";

/**
 * Default contract addresses by chain ID
 */
export const DEFAULT_ADDRESSES: Record<number, ContractAddresses> = {
  // Base Sepolia Testnet
  84532: {
    // Core Protocol
    AgentRegistry: "0xB215589dA259A98eEE8BF39739F6255131ac33A1",
    TaskEscrow: "0xFD081B5cB8bAE37DC878078bE3165932b0bC0BB3",
    ReceiptVerifier: "0xa47D15099be6aC516B53a6859D468E9004eEf76b",
    // Market & Batching
    OpenTaskMarket: "0x5ccF09469222E5046b0830c6d71ed6B912bE70e6",
    ParallelTaskBatch: "0xaf23D40668f0e33426824Bf2027A0E9cD26c11Bc",
    // Collective & Insurance
    AgentCollective: "0x0CDE9560D2E95338922c40A52A2c81cdd20613d1",
    AgentInsurance: "0x1798d370e3C566001A84F38EbDc0F6F1Db6bdd55",
    // Dispute Resolution
    DisputeArbitration: "0x37A62C6eDd18461CCe00B6772Da8640C75DE740e",
    // ZK Verifiers
    Groth16VerifierCapability: "0xd7108ed5C8577B30f6FC024319ebE8B380DaAb85",
    CapabilityVerifier: "0x628CB2cA13f6FeAc48e0f24f45C3AF2Dbb1c02Fb",
    Groth16VerifierReputation: "0xbe6AfBa53E06099410d78d56A75b689dfCa6532F",
    ReputationVerifier: "0x1ac2532e39591cdb5E00Fb9d7C0f47E082d0F149",
    // Router & Integration
    COVENANTRouter: "0x565C48FEFc39c9D98a37cCE30583913C7d0d5e09",
    LitProtocolIntegration: "0x9322B12111699Dd05DD3d0c5D8D08b764051A89f",
  },
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
