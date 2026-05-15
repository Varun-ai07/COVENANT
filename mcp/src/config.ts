/**
 * COVENANT MCP Server Configuration
 * Reuses agents/lib/config.ts patterns but standalone for MCP context.
 */
import * as dotenv from "dotenv";
import {
  createWalletClient,
  createPublicClient,
  http,
  type Address,
  defineChain,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import type { WalletMode, ContractConfig } from "./types.js";

dotenv.config();

// ============================================================
// Network
// ============================================================

export const RPC_URL =
  process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

const hardhatLocal = defineChain({
  id: 31337,
  name: "Hardhat Local",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});

export const CHAIN =
  RPC_URL.includes("127.0.0.1") || RPC_URL.includes("localhost")
    ? hardhatLocal
    : baseSepolia;

// ============================================================
// Contract Addresses
// ============================================================

export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as Address;

export const CONTRACTS: ContractConfig = {
  AgentRegistry: (process.env.REGISTRY_ADDRESS || "0xB215589dA259A98eEE8BF39739F6255131ac33A1") as Address,
  TaskEscrow: (process.env.ESCROW_ADDRESS || "0xFD081B5cB8bAE37DC878078bE3165932b0bC0BB3") as Address,
  ReceiptVerifier: (process.env.VERIFIER_ADDRESS || "0xa47D15099be6aC516B53a6859D468E9004eEf76b") as Address,
  OpenTaskMarket: (process.env.MARKET_ADDRESS || "0x5ccF09469222E5046b0830c6d71ed6B912bE70e6") as Address,
  ParallelTaskBatch: (process.env.BATCH_ADDRESS || "0xaf23D40668f0e33426824Bf2027A0E9cD26c11Bc") as Address,
  AgentCollective: (process.env.COLLECTIVE_ADDRESS || "0x0CDE9560D2E95338922c40A52A2c81cdd20613d1") as Address,
  AgentInsurance: (process.env.INSURANCE_ADDRESS || "0x1798d370e3C566001A84F38EbDc0F6F1Db6bdd55") as Address,
  DisputeArbitration: (process.env.DISPUTE_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
};

// ============================================================
// Wallet Mode
// ============================================================

export const WALLET_MODE: WalletMode =
  (process.env.COVENANT_WALLET_MODE as WalletMode) || "autonomous";

export const HTTP_PORT = parseInt(process.env.MCP_HTTP_PORT || "3001", 10);

// ============================================================
// Configuration Validation
// ============================================================

/**
 * Validates configuration on startup.
 * Throws error if critical configuration is invalid.
 */
export function validateConfig(): void {
  const errors: string[] = [];

  // Validate PRIVATE_KEY format if present
  const key = process.env.PRIVATE_KEY;
  if (key) {
    const normalized = key.startsWith("0x") ? key : `0x${key}`;
    const keyRegex = /^0x[0-9a-fA-F]{64}$/;
    if (!keyRegex.test(normalized)) {
      errors.push(
        `PRIVATE_KEY must be a 64-character hex string (got ${normalized.length} characters)`
      );
    }
  }

  // Warn about missing MCP_API_KEY in HTTP mode
  if (process.env.MCP_API_KEY === undefined) {
    console.error("[WARN] MCP_API_KEY not set - HTTP requests will be rejected");
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  }
}

// ============================================================
// Wallet Setup
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
let _publicClient: any = null;
let _walletClient: any = null;
let _account: any = null;

function getPrivateKey(): string | null {
  const key = process.env.PRIVATE_KEY;
  if (!key) return null;

  const normalized = key.startsWith("0x") ? key : `0x${key}`;

  // Validate key format (64 hex chars after 0x)
  const keyRegex = /^0x[0-9a-fA-F]{64}$/;
  if (!keyRegex.test(normalized)) {
    throw new Error(
      `PRIVATE_KEY must be a 64-character hex string (with or without 0x prefix). ` +
        `Got ${normalized.length} characters.`
    );
  }

  return normalized;
}

export function getPublicClient(): any {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: CHAIN,
      transport: http(RPC_URL),
    });
  }
  return _publicClient;
}

export function getWalletClient(): any {
  if (WALLET_MODE !== "autonomous") return null;
  const key = getPrivateKey();
  if (!key) return null;

  if (!_walletClient) {
    _account = privateKeyToAccount(key as `0x${string}`);
    _walletClient = createWalletClient({
      account: _account,
      chain: CHAIN,
      transport: http(RPC_URL),
    });
  }
  return _walletClient;
}

export function getAccount(): any {
  if (!_account) {
    const key = getPrivateKey();
    if (!key) return null;
    _account = privateKeyToAccount(key as `0x${string}`);
  }
  return _account;
}

// ============================================================
// Contract ABIs (embedded for npm distribution)
// ============================================================

import AgentRegistryAbi from "./abis/AgentRegistry.json" with { type: "json" };
import TaskEscrowAbi from "./abis/TaskEscrow.json" with { type: "json" };
import ReceiptVerifierAbi from "./abis/ReceiptVerifier.json" with { type: "json" };
import OpenTaskMarketAbi from "./abis/OpenTaskMarket.json" with { type: "json" };
import ParallelTaskBatchAbi from "./abis/ParallelTaskBatch.json" with { type: "json" };
import AgentCollectiveAbi from "./abis/AgentCollective.json" with { type: "json" };
import AgentInsuranceAbi from "./abis/AgentInsurance.json" with { type: "json" };
import DisputeArbitrationAbi from "./abis/DisputeArbitration.json" with { type: "json" };

const ABIS: Record<string, any> = {
  AgentRegistry: AgentRegistryAbi.abi,
  TaskEscrow: TaskEscrowAbi.abi,
  ReceiptVerifier: ReceiptVerifierAbi.abi,
  OpenTaskMarket: OpenTaskMarketAbi.abi,
  ParallelTaskBatch: ParallelTaskBatchAbi.abi,
  AgentCollective: AgentCollectiveAbi.abi,
  AgentInsurance: AgentInsuranceAbi.abi,
  DisputeArbitration: DisputeArbitrationAbi.abi,
};

const ALLOWED_CONTRACTS = Object.keys(ABIS);

export function loadAbi(contractName: string): any {
  if (!ALLOWED_CONTRACTS.includes(contractName)) {
    throw new Error(`Unknown contract: ${contractName}. Allowed: ${ALLOWED_CONTRACTS.join(", ")}`);
  }
  return ABIS[contractName];
}

// ============================================================
// Chain helpers
// ============================================================

export function getExplorerTxUrl(hash: string): string {
  const chainId = CHAIN.id as number;
  if (chainId === 84532) {
    return `https://sepolia.basescan.org/tx/${hash}`;
  }
  if (chainId === 8453) {
    return `https://basescan.org/tx/${hash}`;
  }
  if (chainId === 31337) {
    return `localhost tx: ${hash}`;
  }
  return `https://sepolia.basescan.org/tx/${hash}`;
}

export function getExplorerAddressUrl(address: string): string {
  const chainId = CHAIN.id as number;
  if (chainId === 84532) {
    return `https://sepolia.basescan.org/address/${address}`;
  }
  if (chainId === 8453) {
    return `https://basescan.org/address/${address}`;
  }
  return address;
}
