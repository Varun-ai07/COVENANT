/**
 * COVENANT CLI — configuration and viem client setup.
 *
 * Loads ABIs from the sibling mcp/src/abis/ directory.
 * Reads .env for PRIVATE_KEY and RPC_URL.
 */
import * as dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  http,
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

// ── Contract addresses ────────────────────────────────────────

export const CONTRACTS: Record<string, Address> = {
  AgentRegistry: (process.env.REGISTRY_ADDRESS ||
    "0xB215589dA259A98eEE8BF39739F6255131ac33A1") as Address,
  TaskEscrow: (process.env.ESCROW_ADDRESS ||
    "0xFD081B5cB8bAE37DC878078bE3165932b0bC0BB3") as Address,
  ReceiptVerifier: (process.env.VERIFIER_ADDRESS ||
    "0xa47D15099be6aC516B53a6859D468E9004eEf76b") as Address,
  OpenTaskMarket: (process.env.MARKET_ADDRESS ||
    "0x5ccF09469222E5046b0830c6d71ed6B912bE70e6") as Address,
  ParallelTaskBatch: (process.env.BATCH_ADDRESS ||
    "0xaf23D40668f0e33426824Bf2027A0E9cD26c11Bc") as Address,
  AgentCollective: (process.env.COLLECTIVE_ADDRESS ||
    "0x0CDE9560D2E95338922c40A52A2c81cdd20613d1") as Address,
  AgentInsurance: (process.env.INSURANCE_ADDRESS ||
    "0x1798d370e3C566001A84F38EbDc0F6F1Db6bdd55") as Address,
  DisputeArbitration: (process.env.DISPUTE_ADDRESS ||
    "0x37A62C6eDd18461CCe00B6772Da8640C75DE740e") as Address,
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
      `PRIVATE_KEY must be a 64-character hex string. Got ${normalized.length} chars.`
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
