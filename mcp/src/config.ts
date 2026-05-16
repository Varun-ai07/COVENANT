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
// Contract Addresses
// ============================================================

export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as Address;

export const CONTRACTS: ContractConfig = {
  // Core Protocol
  AgentRegistry: (process.env.REGISTRY_ADDRESS || "0xB215589dA259A98eEE8BF39739F6255131ac33A1") as Address,
  TaskEscrow: (process.env.ESCROW_ADDRESS || "0xFD081B5cB8bAE37DC878078bE3165932b0bC0BB3") as Address,
  ReceiptVerifier: (process.env.VERIFIER_ADDRESS || "0xa47D15099be6aC516B53a6859D468E9004eEf76b") as Address,
  // Market & Batching
  OpenTaskMarket: (process.env.MARKET_ADDRESS || "0x5ccF09469222E5046b0830c6d71ed6B912bE70e6") as Address,
  ParallelTaskBatch: (process.env.BATCH_ADDRESS || "0xaf23D40668f0e33426824Bf2027A0E9cD26c11Bc") as Address,
  // Collective & Insurance
  AgentCollective: (process.env.COLLECTIVE_ADDRESS || "0x0CDE9560D2E95338922c40A52A2c81cdd20613d1") as Address,
  AgentInsurance: (process.env.INSURANCE_ADDRESS || "0x1798d370e3C566001A84F38EbDc0F6F1Db6bdd55") as Address,
  // Dispute Resolution
  DisputeArbitration: (process.env.DISPUTE_ADDRESS || "0x37A62C6eDd18461CCe00B6772Da8640C75DE740e") as Address,
  // ZK Verifiers
  Groth16VerifierCapability: (process.env.CAPABILITY_VERIFIER_ADDRESS || "0xd7108ed5C8577B30f6FC024319ebE8B380DaAb85") as Address,
  CapabilityVerifier: (process.env.CAPABILITY_WRAPPER_ADDRESS || "0x628CB2cA13f6FeAc48e0f24f45C3AF2Dbb1c02Fb") as Address,
  Groth16VerifierReputation: (process.env.REPUTATION_VERIFIER_ADDRESS || "0xbe6AfBa53E06099410d78d56A75b689dfCa6532F") as Address,
  ReputationVerifier: (process.env.REPUTATION_WRAPPER_ADDRESS || "0x1ac2532e39591cdb5E00Fb9d7C0f47E082d0F149") as Address,
  // Router & Integration
  COVENANTRouter: (process.env.ROUTER_ADDRESS || "0x565C48FEFc39c9D98a37cCE30583913C7d0d5e09") as Address,
  LitProtocolIntegration: (process.env.LIT_ADDRESS || "0x9322B12111699Dd05DD3d0c5D8D08b764051A89f") as Address,
  // Wallet (sample)
  AgentWallet: (process.env.WALLET_ADDRESS || "0x70F6d2dBd0471DD0aA6a1A54d492eF1AE4F400A1") as Address,
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
// New contracts
import COVENANTRouterAbi from "./abis/COVENANTRouter.json" with { type: "json" };
import LitProtocolIntegrationAbi from "./abis/LitProtocolIntegration.json" with { type: "json" };
import AgentWalletAbi from "./abis/AgentWallet.json" with { type: "json" };
// ZK Verifiers
import Groth16VerifierCapabilityAbi from "./abis/Groth16VerifierCapability.json" with { type: "json" };
import CapabilityVerifierAbi from "./abis/CapabilityVerifier.json" with { type: "json" };
import Groth16VerifierReputationAbi from "./abis/Groth16VerifierReputation.json" with { type: "json" };
import ReputationVerifierAbi from "./abis/ReputationVerifier.json" with { type: "json" };

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
  // ZK Verifiers
  Groth16VerifierCapability: Groth16VerifierCapabilityAbi,
  CapabilityVerifier: CapabilityVerifierAbi,
  Groth16VerifierReputation: Groth16VerifierReputationAbi,
  ReputationVerifier: ReputationVerifierAbi,
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
