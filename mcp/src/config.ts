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
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { CovenantSDK } from "./sdk.js";
import { BASE_SEPOLIA_ADDRESSES } from "./shared-types.js";
import type { WalletMode, ContractConfig, ContractConfigV2, ContractVersion, ContractConfigMerged } from "./types.js";

// Load from CWD first (for local dev)
dotenv.config({ quiet: true });

// Then load from ~/.covenant/config.json (platform-agnostic fallback)
const homeConfig = join(homedir(), ".covenant", "config.json");
if (existsSync(homeConfig)) {
  try {
    const cfg = JSON.parse(readFileSync(homeConfig, "utf-8"));
    for (const [key, value] of Object.entries(cfg)) {
      if (typeof value === "string" && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {}
}

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
  Groth16VerifierCapability: (process.env.CAPABILITY_VERIFIER_ADDRESS || BASE_SEPOLIA_ADDRESSES.Groth16VerifierCapability) as Address,
  CapabilityVerifier: (process.env.CAPABILITY_WRAPPER_ADDRESS || BASE_SEPOLIA_ADDRESSES.CapabilityVerifier) as Address,
  Groth16VerifierReputation: (process.env.REPUTATION_VERIFIER_ADDRESS || BASE_SEPOLIA_ADDRESSES.Groth16VerifierReputation) as Address,
  ReputationVerifier: (process.env.REPUTATION_WRAPPER_ADDRESS || BASE_SEPOLIA_ADDRESSES.ReputationVerifier) as Address,
  COVENANTRouter: (process.env.ROUTER_ADDRESS || BASE_SEPOLIA_ADDRESSES.COVENANTRouter) as Address,
  LitProtocolIntegration: (process.env.LIT_ADDRESS || BASE_SEPOLIA_ADDRESSES.LitProtocolIntegration) as Address,
  AgentWallet: (process.env.WALLET_ADDRESS || BASE_SEPOLIA_ADDRESSES.AgentWallet) as Address,
  RevisionManager: (process.env.REVISION_MANAGER_V2 || BASE_SEPOLIA_ADDRESSES.RevisionManager) as Address,
  TrainingMarketplace: (process.env.TRAINING_MARKETPLACE_ADDRESS || BASE_SEPOLIA_ADDRESSES.TrainingMarketplace) as Address,
  GrantProgram: (process.env.GRANT_PROGRAM_ADDRESS || BASE_SEPOLIA_ADDRESSES.GrantProgram) as Address,
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
  (process.env.CONTRACT_VERSION as ContractVersion) || "v5";

/**
 * Active contract addresses.
 * V5 is the default. All V5 contracts are upgradeable.
 * Legacy V1 addresses are kept for backward compatibility.
 */
export const CONTRACTS: ContractConfig = (() => {
  const v5 = BASE_SEPOLIA_ADDRESSES;

  // Map V5 names to V1 names for tool compatibility
  // V5 CovenantIdentity → V1 AgentRegistry
  // V5 CovenantEscrow → V1 TaskEscrow
  // V5 CovenantSettlement → V1 ReceiptVerifier
  // V5 CovenantArbitration → V1 DisputeArbitration
  // V5 InsurancePool → V1 AgentInsurance
  return {
    ...v5,
    // V5 → V1 name mapping (tools use V1 names)
    AgentRegistry: v5.CovenantIdentity,
    TaskEscrow: v5.CovenantEscrow,
    ReceiptVerifier: v5.CovenantSettlement,
    DisputeArbitration: v5.CovenantArbitration,
    AgentInsurance: v5.InsurancePool,
  } as ContractConfig;
})();

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

// ─── CovenantSDK singleton ──────────────────────────────────────
let _sdk: CovenantSDK | null = null;

export function getSDK(): CovenantSDK {
  if (!_sdk) {
    _sdk = new CovenantSDK({
      chainId: CHAIN.id,
      publicClient: getPublicClient(),
      walletClient: getWalletClient(),
      contractAddresses: CONTRACTS as any,
    });
  }
  return _sdk;
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
import COVENANTRouterAbi from "./abis/COVENANTRouter.json" with { type: "json" };
import LitProtocolIntegrationAbi from "./abis/LitProtocolIntegration.json" with { type: "json" };
import AgentWalletAbi from "./abis/AgentWallet.json" with { type: "json" };
import MultiTokenEscrowAbi from "./abis/MultiTokenEscrow.json" with { type: "json" };
import Groth16VerifierCapabilityAbi from "./abis/Groth16VerifierCapability.json" with { type: "json" };
import CapabilityVerifierAbi from "./abis/CapabilityVerifier.json" with { type: "json" };
import Groth16VerifierReputationAbi from "./abis/Groth16VerifierReputation.json" with { type: "json" };
import ReputationVerifierAbi from "./abis/ReputationVerifier.json" with { type: "json" };
import TrainingMarketplaceAbi from "./abis/TrainingMarketplace.json" with { type: "json" };
import GrantProgramAbi from "./abis/GrantProgram.json" with { type: "json" };
import RevisionManagerAbi from "./abis/RevisionManager.json" with { type: "json" };
// V5 ABIs
import CovenantIdentityAbi from "./abis/CovenantIdentity.json" with { type: "json" };
import CovenantEscrowAbi from "./abis/CovenantEscrow.json" with { type: "json" };
import CovenantSettlementAbi from "./abis/CovenantSettlement.json" with { type: "json" };
import CovenantArbitrationAbi from "./abis/CovenantArbitration.json" with { type: "json" };
import CovenantAttestationAbi from "./abis/CovenantAttestation.json" with { type: "json" };
import CovenantGovernanceAbi from "./abis/CovenantGovernance.json" with { type: "json" };
import InsurancePoolAbi from "./abis/InsurancePool.json" with { type: "json" };

// V2 ABIs — loaded dynamically via loadAbiV2(); static imports added as v2 artifacts are compiled
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ABIS: Record<string, any> = {
  // V5 Core (NEW)
  CovenantIdentity: CovenantIdentityAbi.abi,
  CovenantEscrow: CovenantEscrowAbi.abi,
  CovenantSettlement: CovenantSettlementAbi.abi,
  CovenantArbitration: CovenantArbitrationAbi.abi,
  CovenantAttestation: CovenantAttestationAbi.abi,
  CovenantGovernance: CovenantGovernanceAbi.abi,
  // V5 Extensions (NEW)
  InsurancePool: InsurancePoolAbi.abi,
  // V5 → V1 name mapping (tools use V1 names)
  AgentRegistry: CovenantIdentityAbi.abi,    // V5 CovenantIdentity ABI
  TaskEscrow: CovenantEscrowAbi.abi,         // V5 CovenantEscrow ABI
  ReceiptVerifier: CovenantSettlementAbi.abi, // V5 CovenantSettlement ABI
  DisputeArbitration: CovenantArbitrationAbi.abi, // V5 CovenantArbitration ABI
  AgentInsurance: InsurancePoolAbi.abi,      // V5 InsurancePool ABI
  // Legacy V1 (still available)
  OpenTaskMarket: OpenTaskMarketAbi.abi,
  ParallelTaskBatch: ParallelTaskBatchAbi.abi,
  AgentCollective: AgentCollectiveAbi.abi,
  COVENANTRouter: COVENANTRouterAbi,
  LitProtocolIntegration: LitProtocolIntegrationAbi,
  AgentWallet: AgentWalletAbi,
  Groth16VerifierCapability: Groth16VerifierCapabilityAbi,
  CapabilityVerifier: CapabilityVerifierAbi,
  Groth16VerifierReputation: Groth16VerifierReputationAbi,
  ReputationVerifier: ReputationVerifierAbi,
  MultiTokenEscrow: MultiTokenEscrowAbi,
  TrainingMarketplace: TrainingMarketplaceAbi.abi,
  GrantProgram: GrantProgramAbi.abi,
  RevisionManager: RevisionManagerAbi.abi,
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
  // V1 contracts
  if (ABIS[contractName]) {
    return ABIS[contractName];
  }
  // Fallback: check v2 ABI directory for contracts not in v1 (e.g. RevisionManager)
  try {
    const filePath = path.join(V2_ABI_DIR, `${contractName}.json`);
    if (fs.existsSync(filePath)) {
      const artifact = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return artifact.abi ?? artifact;
    }
  } catch { /* not found anywhere */ }
  throw new Error(`Unknown contract: ${contractName}. Allowed: ${ALLOWED_CONTRACTS.join(", ")}`);
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
