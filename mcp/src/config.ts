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
  AgentRegistry: (process.env.REGISTRY_ADDRESS || "0x3e4a9013Ec6315eF0e13B4f768e07cf43c6c3369") as Address,
  TaskEscrow: (process.env.ESCROW_ADDRESS || "0xb2a2b7f046fa82A020B3008A71E61d16603BAa05") as Address,
  ReceiptVerifier: (process.env.VERIFIER_ADDRESS || "0xabd07d380FBC7807bF25e8d969E7FF5192117Ec5") as Address,
  OpenTaskMarket: (process.env.MARKET_ADDRESS || "0xf930b3060020a931dccabC9BfA1e6C2a8EB6D5d5") as Address,
  ParallelTaskBatch: (process.env.BATCH_ADDRESS || "0xfD9314cA51374aDc879AB794844f6be3CA85a645") as Address,
  AgentCollective: (process.env.COLLECTIVE_ADDRESS || "0x378B0Fb03d8B2CE34Da90D1e587CEBb7b22dA856") as Address,
  AgentInsurance: (process.env.INSURANCE_ADDRESS || "0x87933103cA13e1969b24d40eFe2C7c9C008Fc1Dc") as Address,
  DisputeArbitration: (process.env.DISPUTE_ADDRESS || "0xC98ebfAE496e297a84a960085418C8240891E6CD") as Address,
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
// Contract ABIs (loaded lazily from agents/abis/)
// ============================================================

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Look for abis in ../agents/abis/ relative to mcp/
const ABIS_DIR = resolve(__dirname, "../../agents/abis");

// Allowlist of known contracts to prevent path traversal
const ALLOWED_CONTRACTS = [
  "AgentRegistry",
  "TaskEscrow",
  "ReceiptVerifier",
  "OpenTaskMarket",
  "ParallelTaskBatch",
  "AgentCollective",
  "AgentInsurance",
  "DisputeArbitration",
];

const abiCache: Record<string, any> = {};

export function loadAbi(contractName: string): any {
  if (abiCache[contractName]) return abiCache[contractName];

  // Security: validate against allowlist
  if (!ALLOWED_CONTRACTS.includes(contractName)) {
    throw new Error(`Unknown contract: ${contractName}`);
  }

  // Security: prevent path traversal characters
  if (
    contractName.includes("/") ||
    contractName.includes("\\") ||
    contractName.includes("..")
  ) {
    throw new Error(`Invalid contract name: ${contractName}`);
  }

  const abiPath = resolve(ABIS_DIR, `${contractName}.json`);
  if (!existsSync(abiPath)) {
    throw new Error(
      `ABI not found for ${contractName}. Run 'npx hardhat compile' in contracts/ first.`
    );
  }

  const artifact = JSON.parse(readFileSync(abiPath, "utf-8"));
  abiCache[contractName] = artifact.abi;
  return artifact.abi;
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
