import * as dotenv from "dotenv";
import { createWalletClient, createPublicClient, http, type Address, type WalletClient, type PublicClient, defineChain } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

dotenv.config();

// RPC URL from env
export const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

// Hardhat local chain definition
const hardhatLocal = defineChain({
  id: 31337,
  name: "Hardhat Local",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
});

// Chain configuration - use hardhat if local RPC detected
export const CHAIN = RPC_URL.includes("127.0.0.1") || RPC_URL.includes("localhost")
  ? hardhatLocal
  : baseSepolia;

// Contract addresses - Base Sepolia (chainId: 84532)
// For local Hardhat (chainId: 31337), set env vars or use defaults
export const CONTRACTS = {
  // Core contracts (deployed to Base Sepolia)
  AgentRegistry: (process.env.REGISTRY_ADDRESS || "0x3e4a9013Ec6315eF0e13B4f768e07cf43c6c3369") as Address,
  TaskEscrow: (process.env.ESCROW_ADDRESS || "0xb2a2b7f046fa82A020B3008A71E61d16603BAa05") as Address,
  ReceiptVerifier: (process.env.VERIFIER_ADDRESS || "0xabd07d380FBC7807bF25e8d969E7FF5192117Ec5") as Address,
  // Extended contracts (deployed to Base Sepolia)
  OpenTaskMarket: (process.env.MARKET_ADDRESS || "0xf930b3060020a931dccabC9BfA1e6C2a8EB6D5d5") as Address,
  ParallelTaskBatch: (process.env.BATCH_ADDRESS || "0xfD9314cA51374aDc879AB794844f6be3CA85a645") as Address,
  AgentCollective: (process.env.COLLECTIVE_ADDRESS || "0x378B0Fb03d8B2CE34Da90D1e587CEBb7b22dA856") as Address,
  AgentInsurance: (process.env.INSURANCE_ADDRESS || "0x87933103cA13e1969b24d40eFe2C7c9C008Fc1Dc") as Address,
  DisputeArbitration: (process.env.DISPUTE_ADDRESS || "0xC98ebfAE496e297a84a960085418C8240891E6CD") as Address,
};

// Testnet configuration for gas optimization
export const TESTNET_CONFIG = {
  AGENT_STAKE: "0.001",    // ETH — was 0.01
  TASK_PAYMENT: "0.001",   // ETH — was 0.02
  MIN_STAKE: "0.001",      // ETH — was 0.01
  PROTOCOL_FEE: 100,       // basis points = 1%
};

// Wallet budget allocation
export const WALLET_BUDGET = {
  DEPLOYER: "0.003",       // for contracts
  CLIENT_WALLET: "0.004",  // stake + task + gas
  WORKER_WALLET: "0.003",  // stake + gas
};

// Create wallet client from private key
export function createWallet(privateKey: string): { wallet: WalletClient; account: ReturnType<typeof privateKeyToAccount>; publicClient: PublicClient } {
  const formattedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(formattedKey as `0x${string}`);

  const publicClient = createPublicClient({
    chain: CHAIN,
    transport: http(RPC_URL),
  });

  const wallet = createWalletClient({
    account,
    chain: CHAIN,
    transport: http(RPC_URL),
  });

  return { wallet, account, publicClient };
}

// Load agent private keys from env
export function loadAgentKeys() {
  return {
    clientKey: process.env.CLIENT_PRIVATE_KEY || "",
    workerKey: process.env.WORKER_PRIVATE_KEY || "",
  };
}
