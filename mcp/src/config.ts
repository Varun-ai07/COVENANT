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
import { BASE_SEPOLIA_ADDRESSES } from "@covenant/shared-types";
import type { WalletMode, ContractConfig, ContractConfigV2, ContractVersion, ContractConfigMerged } from "./types.js";

dotenv.config({ quiet: true });

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
// Contract Addresses — Version-Aware
// ============================================================

export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as Address;

// V1 addresses (original deployed contracts — defaults from canonical shared-types)
const _v1: ContractConfig = {
  AgentRegistry: (process.env.REGISTRY_ADDRESS || BASE_SEPOLIA_ADDRESSES.AgentRegistry) as Address,
  TaskEscrow: (process.env.ESCROW_ADDRESS || BASE_SEPOLIA_ADDRESSES.TaskEscrow) as Address,
  ReceiptVerifier: (process.env.VERIFIER_ADDRESS || BASE_SEPOLIA_ADDRESSES.ReceiptVerifier) as Address,
  OpenTaskMarket: (process.env.MARKET_ADDRESS || BASE_SEPOLIA_ADDRESSES.OpenTaskMarket) as Address,
  ParallelTaskBatch: (process.env.BATCH_ADDRESS || BASE_SEPOLIA_ADDRESSES.ParallelTaskBatch) as Address,
  AgentCollective: (process.env.COLLECTIVE_ADDRESS || BASE_SEPOLIA_ADDRESSES.AgentCollective) as Address,
  AgentInsurance: (process.env.INSURANCE_ADDRESS || BASE_SEPOLIA_ADDRESSES.AgentInsurance) as Address,
  DisputeArbitration: (process.env.DISPUTE_ADDRESS || BASE_SEPOLIA_ADDRESSES.DisputeArbitration) as Address,
  COVENANTRouter: (process.env.ROUTER_ADDRESS || BASE_SEPOLIA_ADDRESSES.COVENANTRouter) as Address,
  LitProtocolIntegration: (process.env.LIT_ADDRESS || BASE_SEPOLIA_ADDRESSES.LitProtocolIntegration) as Address,
  AgentWallet: (process.env.WALLET_ADDRESS || BASE_SEPOLIA_ADDRESSES.AgentWallet) as Address,
};

// V2 addresses (minimal settlement contracts)
const _v2: ContractConfigV2 = {
  AgentRegistry: (process.env.AGENT_REGISTRY_V2 || ZERO_ADDRESS) as Address,
  TaskEscrow: (process.env.TASK_ESCROW_V2 || ZERO_ADDRESS) as Address,
  ReceiptVerifier: (process.env.RECEIPT_VERIFIER_V2 || ZERO_ADDRESS) as Address,
  InsurancePool: (process.env.INSURANCE_POOL || ZERO_ADDRESS) as Address,
  DisputeResolution: (process.env.DISPUTE_RESOLUTION || ZERO_ADDRESS) as Address,
  MultiTokenEscrow: (process.env.MULTI_TOKEN_ESCROW || ZERO_ADDRESS) as Address,
  RevisionManager: (process.env.REVISION_MANAGER_V2 || ZERO_ADDRESS) as Address,
};

export const CONTRACT_VERSION: ContractVersion =
  (process.env.CONTRACT_VERSION as ContractVersion) || "v1";

/**
 * Active contract addresses. When CONTRACT_VERSION=v2:
 * - AgentRegistry, TaskEscrow, ReceiptVerifier → v2 addresses
 * - AgentInsurance → InsurancePool v2 address
 * - DisputeArbitration → DisputeResolution v2 address
 * - All other v1 contracts (market, batches, collective, router, etc.) unchanged
 */
export const CONTRACTS: ContractConfig = CONTRACT_VERSION === "v2"
  ? {
      ..._v1,
      AgentRegistry: _v2.AgentRegistry,
      TaskEscrow: _v2.TaskEscrow,
      ReceiptVerifier: _v2.ReceiptVerifier,
      AgentInsurance: _v2.InsurancePool,       // v1 name → v2 address
      DisputeArbitration: _v2.DisputeResolution, // v1 name → v2 address
      MultiTokenEscrow: _v2.MultiTokenEscrow,
    } as ContractConfig
  : _v1;

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
    try {
      _account = privateKeyToAccount(key as `0x${string}`);
    } catch {
      return null;
    }
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
// New contracts
import COVENANTRouterAbi from "./abis/COVENANTRouter.json" with { type: "json" };
import LitProtocolIntegrationAbi from "./abis/LitProtocolIntegration.json" with { type: "json" };
import AgentWalletAbi from "./abis/AgentWallet.json" with { type: "json" };
import MultiTokenEscrowAbi from "./abis/MultiTokenEscrow.json" with { type: "json" };
// V2 ABIs — loaded dynamically via loadAbiV2(); static imports added as v2 artifacts are compiled
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ABIS: Record<string, any> = {
  // Core Protocol
  AgentRegistry: AgentRegistryAbi.abi,
  TaskEscrow: TaskEscrowAbi.abi,
  ReceiptVerifier: ReceiptVerifierAbi.abi,
  // Market & Batching
  OpenTaskMarket: OpenTaskMarketAbi.abi,
  ParallelTaskBatch: ParallelTaskBatchAbi.abi,
  // Collective & Insurance
  AgentCollective: AgentCollectiveAbi.abi,
  AgentInsurance: AgentInsuranceAbi.abi,
  // Dispute Resolution
  DisputeArbitration: DisputeArbitrationAbi.abi,
  // Router & Integration
  COVENANTRouter: COVENANTRouterAbi,
  LitProtocolIntegration: LitProtocolIntegrationAbi,
  // Wallet
  AgentWallet: AgentWalletAbi,
  // Multi-Token Escrow
  MultiTokenEscrow: MultiTokenEscrowAbi,
};

const ALLOWED_CONTRACTS = Object.keys(ABIS);

// V1→V2 contract name mapping (tools use v1 names, v2 ABIs have different names)
const V1_TO_V2_ABI_MAP: Record<string, string> = {
  AgentInsurance: "InsurancePool",
  DisputeArbitration: "DisputeResolution",
};

export function loadAbi(contractName: string): any {
  // When v2 is active, try v2 ABI first
  if (CONTRACT_VERSION === "v2") {
    const v2Name = V1_TO_V2_ABI_MAP[contractName] || contractName;
    try {
      const filePath = path.join(V2_ABI_DIR, `${v2Name}.json`);
      if (fs.existsSync(filePath)) {
        const artifact = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        return artifact.abi ?? artifact;
      }
    } catch { /* fall through to v1 ABI */ }
  }
  if (!ALLOWED_CONTRACTS.includes(contractName)) {
    throw new Error(`Unknown contract: ${contractName}. Allowed: ${ALLOWED_CONTRACTS.join(", ")}`);
  }
  return ABIS[contractName];
}

// ============================================================
// V2 ABI Loader
// ============================================================

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);

const V2_ABI_DIR = path.resolve(_dirname, "abis", "v2");

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
