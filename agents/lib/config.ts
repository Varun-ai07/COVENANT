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

// Contract addresses (update after deployment)
export const CONTRACTS = {
  AgentRegistry: (process.env.REGISTRY_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
  TaskEscrow: (process.env.ESCROW_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
  ReceiptVerifier: (process.env.VERIFIER_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
  OpenTaskMarket: (process.env.MARKET_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
  ParallelTaskBatch: (process.env.BATCH_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
  AgentCollective: (process.env.COLLECTIVE_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
  AgentInsurance: (process.env.INSURANCE_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
  DisputeArbitration: (process.env.DISPUTE_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
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
