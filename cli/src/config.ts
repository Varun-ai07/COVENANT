/**
 * COVENANT CLI — configuration and viem client setup.
 *
 * Loads ABIs from the sibling mcp/src/abis/ directory.
 * Reads .env for PRIVATE_KEY, RPC_URL, and SPENDING_LIMIT.
 */
import * as dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Address,
  type Abi,
  defineChain,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── ABI loader ────────────────────────────────────────────────

const ABI_DIR = resolve(__dirname, "../../mcp/src/abis");

const ABI_CACHE: Record<string, Abi> = {};

export function loadAbi(contractName: string): Abi {
  if (ABI_CACHE[contractName]) return ABI_CACHE[contractName];

  const filePath = resolve(ABI_DIR, `${contractName}.json`);
  const raw = JSON.parse(readFileSync(filePath, "utf-8"));
  const abi: Abi = raw.abi ?? raw;
  ABI_CACHE[contractName] = abi;
  return abi;
}

// ── Network ───────────────────────────────────────────────────

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

export const CHAIN_NAME = (() => {
  const id = CHAIN.id as number;
  if (id === 31337) return "Hardhat Local";
  if (id === 8453) return "Base Mainnet";
  return "Base Sepolia";
})();

// ── AI configuration ──────────────────────────────────────────

export const AI_API_KEY = process.env.AI_API_KEY || "";
export const AI_BASE_URL = process.env.AI_BASE_URL || "https://openrouter.ai/api/v1";
export const AI_MODEL = process.env.AI_MODEL || "openai/gpt-4o";
export const AI_PROVIDER = process.env.AI_PROVIDER || "openrouter";

// ── Spending limit (Fix 5) ────────────────────────────────────

export const SPENDING_LIMIT: bigint = process.env.SPENDING_LIMIT
  ? parseEther(process.env.SPENDING_LIMIT)
  : parseEther("0.1"); // Default 0.1 ETH per session

// ── Contract addresses (V5 + Legacy) ──────────────────────────

export const CONTRACTS: Record<string, Address> = {
  // V5 Core
  CovenantIdentity: (process.env.COVENANT_IDENTITY_ADDRESS ||
    "0xFa1bFd34290bf12A2F09Ea24Cda05E71cc79c1fF") as Address,
  CovenantEscrow: (process.env.COVENANT_ESCROW_ADDRESS ||
    "0x130e2027eB57C427Bf63E2B06d35B10CB20C4b77") as Address,
  CovenantSettlement: (process.env.COVENANT_SETTLEMENT_ADDRESS ||
    "0x61124E9aDAd3167ED1DB644a901a5838c8725251") as Address,
  CovenantArbitration: (process.env.COVENANT_ARBITRATION_ADDRESS ||
    "0x4e7abC16c7f8bB65501bb451073a969345611D1d") as Address,
  CovenantAttestation: (process.env.COVENANT_ATTESTATION_ADDRESS ||
    "0x945d1576B71fA332e16B5a5fBD6Ca661B4DD1b8D") as Address,
  CovenantGovernance: (process.env.COVENANT_GOVERNANCE_ADDRESS ||
    "0x128A14cf46D3a34c963AcF85a6EdEf6aF7A25342") as Address,
  // V5 Extensions
  ParallelTaskBatch: (process.env.BATCH_ADDRESS ||
    "0xaE8C7897ED19A38B416b7B32E58F820d8D5Cd5D8") as Address,
  AgentCollective: (process.env.COLLECTIVE_ADDRESS ||
    "0xfc5E4f36e7477F744D1d99dEf13caC02e1C0f9cE") as Address,
  TrainingMarketplace: (process.env.TRAINING_ADDRESS ||
    "0x9A34ea8a30eD68c18b4Eb51B80916B90a7118f3D") as Address,
  GrantProgram: (process.env.GRANT_ADDRESS ||
    "0xE6ce269829E6c33A9038e055De026A804C5c464A") as Address,
  InsurancePool: (process.env.INSURANCE_ADDRESS ||
    "0x7855E3BDf7d5FdCa33fF911E8B4B034263214371") as Address,
  RevisionManager: (process.env.REVISION_ADDRESS ||
    "0xAEB709652712307092FE10Ffa0a58a0850b82Ad8") as Address,
  // Legacy (still deployed, needed for some commands)
  OpenTaskMarket: (process.env.MARKET_ADDRESS ||
    "0xF163007a42f00dB4D1296186A9BD07B28fe2a4a7") as Address,
  DisputeArbitration: (process.env.DISPUTE_ARBITRATION_ADDRESS ||
    "0x37A62C6eDd18461CCe00B6772Da8640C75DE740e") as Address,
  AgentInsurance: (process.env.AGENT_INSURANCE_ADDRESS ||
    "0x1798d370e3C566001A84F38EbDc0F6F1Db6bdd55") as Address,
  TaskEscrow: (process.env.TASK_ESCROW_ADDRESS ||
    "0xFD081B5cB8bAE37DC878078bE3165932b0bC0BB3") as Address,
  ReceiptVerifier: (process.env.RECEIPT_VERIFIER_ADDRESS ||
    "0xa47D15099be6aC516B53a6859D468E9004eEf76b") as Address,
  AgentRegistry: (process.env.AGENT_REGISTRY_ADDRESS ||
    "0x0003072b15d2c299d46bC5FfE7785E803895E614") as Address,
};

// ── Viem clients ──────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
let _publicClient: any = null;
let _walletClient: any = null;
let _account: any = null;

function getPrivateKey(): `0x${string}` | null {
  const key = process.env.PRIVATE_KEY;
  if (!key) return null;
  const normalized = key.startsWith("0x") ? key : `0x${key}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error(
      "PRIVATE_KEY must be a 64-character hex string."
    );
  }
  return normalized as `0x${string}`;
}

export function getPublicClient() {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: CHAIN,
      transport: http(RPC_URL),
    });
  }
  return _publicClient;
}

export function getAccount() {
  if (!_account) {
    const key = getPrivateKey();
    if (!key) return null;
    _account = privateKeyToAccount(key);
  }
  return _account;
}

export function getWalletClient() {
  const account = getAccount();
  if (!account) return null;
  if (!_walletClient) {
    _walletClient = createWalletClient({
      account,
      chain: CHAIN,
      transport: http(RPC_URL),
    });
  }
  return _walletClient;
}

// ── Explorer helpers ──────────────────────────────────────────

export function explorerTxUrl(hash: string): string {
  const chainId = CHAIN.id as number;
  if (chainId === 31337) return `localhost tx: ${hash}`;
  if (chainId === 8453) return `https://basescan.org/tx/${hash}`;
  return `https://sepolia.basescan.org/tx/${hash}`;
}

export function explorerAddrUrl(addr: string): string {
  const chainId = CHAIN.id as number;
  if (chainId === 31337) return addr;
  if (chainId === 8453) return `https://basescan.org/address/${addr}`;
  return `https://sepolia.basescan.org/address/${addr}`;
}
