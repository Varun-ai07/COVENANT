import "dotenv/config";

export const RPC_URL = process.env.RPC_URL ?? "https://sepolia.base.org";
export const SUBGRAPH_URL =
  process.env.SUBGRAPH_URL ??
  "https://api.studio.thegraph.com/query/1753884/local";
export const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL ?? "";

export const CONTRACTS = {
  AgentRegistry: (process.env.AGENT_REGISTRY ?? "0xB215589dA259A98eEE8BF39739F6255131ac33A1") as `0x${string}`,
  TaskEscrow: (process.env.TASK_ESCROW ?? "0xFD081B5cB8bAE37DC878078bE3165932b0bC0BB3") as `0x${string}`,
  ReceiptVerifier: (process.env.RECEIPT_VERIFIER ?? "0xa47D15099be6aC516B53a6859D468E9004eEf76b") as `0x${string}`,
  InsurancePool: (process.env.INSURANCE_POOL ?? "0x1798d370e3C566001A84F38EbDc0F6F1Db6bdd55") as `0x${string}`,
  DisputeResolution: (process.env.DISPUTE_RESOLUTION ?? "0x37A62C6eDd18461CCe00B6772Da8640C75DE740e") as `0x${string}`,
} as const;

export const METRICS_INTERVAL_MS = Number(process.env.METRICS_INTERVAL_MS ?? 60_000);
export const CLAIM_ALERT_ETH = Number(process.env.CLAIM_ALERT_ETH ?? 0.1);
export const DEACTIVATION_STAKE_ALERT_ETH = Number(process.env.DEACTIVATION_STAKE_ALERT_ETH ?? 0.05);
export const SYNC_LAG_ALERT_BLOCKS = Number(process.env.SYNC_LAG_ALERT_BLOCKS ?? 500);

/** Base Sepolia chain ID */
export const CHAIN_ID = 84532;

export function ts(): string {
  return new Date().toISOString();
}
