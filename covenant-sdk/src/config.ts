import type { Address } from "viem";
import type { ContractAddresses } from "./types.js";

/**
 * Default contract addresses by chain ID
 */
export const DEFAULT_ADDRESSES: Record<number, ContractAddresses> = {
  // Base Sepolia Testnet
  84532: {
    AgentRegistry: "0x86E5982aA12f9b0AB48d536BA78B4E2fCc9b1103",
    TaskEscrow: "0xbb2933f2Bc773AB518dAe4Ae5340B5A325F1a504",
    ReceiptVerifier: "0x3BE6849F40230b1433D4FA166E23B1789a5469Fa",
    OpenTaskMarket: "0xf930b3060020a931dccabC9BfA1e6C2a8EB6D5d5",
    ParallelTaskBatch: "0xfD9314cA51374aDc879AB794844f6be3CA85a645",
    AgentCollective: "0x378B0Fb03d8B2CE34Da90D1e587CEBb7b22dA856",
    AgentInsurance: "0x87933103cA13e1969b24d40eFe2C7c9C008Fc1Dc",
    DisputeArbitration: "0xC98ebfAE496e297a84a960085418C8240891E6CD",
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
