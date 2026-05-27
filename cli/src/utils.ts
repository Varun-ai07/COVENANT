/**
 * COVENANT CLI — shared formatting and transaction helpers.
 */
import chalk from "chalk";
import { formatEther, type Address, type Abi } from "viem";
import {
  getPublicClient,
  getWalletClient,
  getAccount,
  explorerTxUrl,
} from "./config.js";

// ── Status labels ─────────────────────────────────────────────

export const TASK_STATUS: Record<number, string> = {
  0: "Created",
  1: "Funded",
  2: "InProgress",
  3: "Submitted",
  4: "Completed",
  5: "Failed",
  6: "Disputed",
  7: "Cancelled",
};

export const MARKET_STATUS: Record<number, string> = {
  0: "Open",
  1: "InProgress",
  2: "Completed",
  3: "Cancelled",
};

// ── Print helpers ─────────────────────────────────────────────

export function printSuccess(msg: string): void {
  console.log(chalk.green("  ✓ ") + msg);
}

export function printError(msg: string): void {
  console.error(chalk.red("  ✗ ") + msg);
}

export function printInfo(msg: string): void {
  console.log(chalk.cyan("  → ") + msg);
}

export function printField(label: string, value: string): void {
  console.log(chalk.gray(`  ${label}: `) + chalk.white(value));
}

export function printHeader(title: string): void {
  console.log();
  console.log(chalk.bold.underline(title));
}

export function printDivider(): void {
  console.log(chalk.gray("  " + "─".repeat(50)));
}

// ── Address formatting ────────────────────────────────────────

export function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr ?? "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ── BigInt → ETH display ─────────────────────────────────────

export function toEth(value: bigint | undefined | null): string {
  if (value === undefined || value === null) return "0 ETH";
  return `${formatEther(value)} ETH`;
}

// ── Timestamp → ISO ───────────────────────────────────────────

export function toDate(ts: bigint | number | undefined | null): string {
  if (!ts || ts === 0n) return "—";
  const n = Number(ts);
  const d = new Date(n * 1000);
  if (d.getFullYear() < 2000 || d.getFullYear() > 2100) return String(n);
  return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

// ── Contract read helper ─────────────────────────────────────

export async function readContract(
  address: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[] = []
): Promise<any> {
  const client = getPublicClient();
  return client.readContract({ address, abi, functionName, args: args as any });
}

// ── Contract write helper (sign + send + wait) ───────────────

export async function writeContract(
  address: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[],
  value?: bigint
): Promise<{ hash: string; blockNumber: bigint; gasUsed: bigint }> {
  const wallet = getWalletClient();
  const publicClient = getPublicClient();
  const account = getAccount();

  if (!wallet || !account) {
    throw new Error("No PRIVATE_KEY configured — cannot send transactions");
  }

  const { request } = await publicClient.simulateContract({
    address,
    abi,
    functionName,
    args: args as any,
    account,
    value,
  });

  const hash = await wallet.writeContract(request);
  printInfo(`Tx sent: ${chalk.yellow(hash)}`);
  printInfo(`Explorer: ${explorerTxUrl(hash)}`);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: 60_000,
  });

  return {
    hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
  };
}

// ── Error handler ─────────────────────────────────────────────

export function handleError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  printError(msg);
  process.exit(1);
}
