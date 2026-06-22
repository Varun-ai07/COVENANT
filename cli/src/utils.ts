/**
 * COVENANT CLI — shared formatting, spinner, and transaction helpers.
 */
import chalk from "chalk";
import ora, { type Ora } from "ora";
import { formatEther, type Address, type Abi } from "viem";
import {
  getPublicClient,
  getWalletClient,
  getAccount,
  explorerTxUrl,
  explorerAddrUrl,
  CHAIN_NAME,
  RPC_URL,
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

export const STREAM_STATUS: Record<number, string> = {
  0: "Active",
  1: "Paused",
  2: "Cancelled",
  3: "Completed",
};

export const DISPUTE_STATUS: Record<number, string> = {
  0: "Open",
  1: "Voting",
  2: "Ruled",
  3: "Settled",
  4: "Appealed",
};

export const PROPOSAL_STATUS: Record<number, string> = {
  0: "Pending",
  1: "Active",
  2: "Passed",
  3: "Rejected",
  4: "Executed",
  5: "Vetoed",
};

export const CLAIM_STATUS: Record<number, string> = {
  0: "Filed",
  1: "Voting",
  2: "Approved",
  3: "Rejected",
  4: "Paid",
};

// ── Banner ────────────────────────────────────────────────────

export function printBanner(): void {
  const banner = `
${chalk.bold.cyan("  ╔══════════════════════════════════════════════════════╗")}
${chalk.bold.cyan("  ║")}  ${chalk.bold.white("██████╗ ███╗   ██╗██╗   ██╗██████╗ ██╗   ██╗")}${chalk.bold.cyan("║")}
${chalk.bold.cyan("  ║")}  ${chalk.bold.white("██╔══██╗████╗  ██║██║   ██║██╔══██╗╚██╗ ██╔╝")}${chalk.bold.cyan("║")}
${chalk.bold.cyan("  ║")}  ${chalk.bold.white("██████╔╝██╔██╗ ██║██║   ██║██████╔╝ ╚████╔╝ ")}${chalk.bold.cyan("║")}
${chalk.bold.cyan("  ║")}  ${chalk.bold.white("██╔═══╝ ██║╚██╗██║██║   ██║██╔══██╗  ╚██╔╝  ")}${chalk.bold.cyan("║")}
${chalk.bold.cyan("  ║")}  ${chalk.bold.white("██║     ██║ ╚████║╚██████╔╝██║  ██║   ██║   ")}${chalk.bold.cyan("║")}
${chalk.bold.cyan("  ║")}  ${chalk.bold.white("╚═╝     ╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ")}${chalk.bold.cyan("║")}
${chalk.bold.cyan("  ║")}${chalk.gray("                                                  ")}${chalk.bold.cyan("║")}
${chalk.bold.cyan("  ║")}  ${chalk.gray("Autonomous Agent Enforcement Protocol")}${chalk.bold.cyan("            ║")}
${chalk.bold.cyan("  ║")}  ${chalk.dim("v2.0.0")}${chalk.gray(" · ")}${chalk.yellow(CHAIN_NAME.padEnd(20))}${chalk.gray(" · ")}${chalk.dim("Base Sepolia L2")}${chalk.bold.cyan("  ║")}
${chalk.bold.cyan("  ╚══════════════════════════════════════════════════════╝")}
`;
  console.log(banner);
}

// ── Spinner ───────────────────────────────────────────────────

export function startSpinner(text: string): Ora {
  return ora({ text: chalk.cyan(text), color: "cyan" }).start();
}

export function succeedSpinner(spinner: Ora, msg: string): void {
  spinner.succeed(chalk.green(msg));
}

export function failSpinner(spinner: Ora, msg: string): void {
  spinner.fail(chalk.red(msg));
}

// ── Status labels ─────────────────────────────────────────────

export const printSuccess = (msg: string): void => {
  console.log(chalk.green("  ✓ ") + msg);
};

export const printError = (msg: string): void => {
  console.error(chalk.red("  ✗ ") + msg);
};

export const printInfo = (msg: string): void => {
  console.log(chalk.cyan("  ℹ ") + msg);
};

export const printWarning = (msg: string): void => {
  console.log(chalk.yellow("  ⚠ ") + msg);
};

export function printField(label: string, value: string): void {
  console.log(chalk.gray(`  ${label.padEnd(18)} `) + chalk.white(value));
}

export function printFieldColor(label: string, value: string, color: typeof chalk): void {
  console.log(chalk.gray(`  ${label.padEnd(18)} `) + color(value));
}

export function printHeader(title: string): void {
  console.log();
  console.log(chalk.bold.cyan(`  ┌─ ${title} ${"─".repeat(Math.max(0, 44 - title.length))}┐`));
  console.log(chalk.bold.cyan(`  │`));
}

export function printFooter(): void {
  console.log(chalk.bold.cyan(`  └${"─".repeat(48)}┘`));
}

export function printDivider(): void {
  console.log(chalk.gray("  " + "─".repeat(50)));
}

export function printSection(title: string): void {
  console.log();
  console.log(chalk.bold.white(`  ${title}`));
  console.log(chalk.gray("  " + "─".repeat(title.length + 2)));
}

// ── Table output ──────────────────────────────────────────────

export function printTable(
  headers: string[],
  rows: string[][],
  colors?: (typeof chalk)[]
): void {
  const colWidths = headers.map((h, i) => {
    const dataWidths = rows.map((r) => (r[i] ?? "").length);
    return Math.max(h.length, ...dataWidths) + 2;
  });

  const headerLine = headers.map((h, i) => chalk.bold.cyan(h.padEnd(colWidths[i]))).join("│");
  const dividerLine = colWidths.map((w) => chalk.gray("─".repeat(w))).join("┼");

  console.log(chalk.gray("  ┌" + colWidths.map((w) => "─".repeat(w)).join("┬") + "┐"));
  console.log(chalk.gray("  │") + headerLine + chalk.gray("│"));
  console.log(chalk.gray("  ├" + dividerLine + "┤"));

  for (const row of rows) {
    const line = row.map((cell, i) => {
      const c = colors?.[i] ?? chalk.white;
      return c(cell.padEnd(colWidths[i]));
    }).join(chalk.gray("│"));
    console.log(chalk.gray("  │") + line + chalk.gray("│"));
  }

  console.log(chalk.gray("  └" + colWidths.map((w) => "─".repeat(w)).join("┴") + "┘"));
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
  if (!ts || ts === 0n || ts === 0) return "—";
  const n = typeof ts === "bigint" ? Number(ts) : ts;
  const d = new Date(n * 1000);
  if (d.getFullYear() < 2000 || d.getFullYear() > 2100) return String(n);
  return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

// ── TX receipt formatter ──────────────────────────────────────

export function printTxReceipt(hash: string, blockNumber: bigint, gasUsed: bigint): void {
  console.log();
  printField("TX Hash", chalk.yellow(hash));
  printField("Block", String(blockNumber));
  printField("Gas Used", String(gasUsed));
  printField("Explorer", chalk.underline(explorerTxUrl(hash)));
  console.log();
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

  const spinner = startSpinner("Simulating transaction...");
  const { request } = await publicClient.simulateContract({
    address,
    abi,
    functionName,
    args: args as any,
    account,
    value,
  });
  succeedSpinner(spinner, "Simulation passed");

  const sendSpinner = startSpinner("Sending transaction...");
  const hash = await wallet.writeContract(request);
  succeedSpinner(spinner, `TX sent: ${chalk.yellow(hash)}`);

  printInfo(`Explorer: ${chalk.underline(explorerTxUrl(hash))}`);

  const waitSpinner = startSpinner("Waiting for confirmation...");
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: 60_000,
  });
  succeedSpinner(waitSpinner, `Confirmed in block ${chalk.cyan(String(receipt.blockNumber))}`);

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
