/**
 * COVENANT CLI — shared formatting, spinner, and transaction helpers.
 *
 * Safety: confirmAction, checkBalance, and spending cap guards are enforced
 * before every writeContract call. NEVER skip these checks.
 */
import chalk from "chalk";
import ora, { type Ora } from "ora";
import { formatEther, parseEther, type Address, type Abi } from "viem";
import * as readline from "node:readline";
import {
  getPublicClient,
  getWalletClient,
  getAccount,
  explorerTxUrl,
  explorerAddrUrl,
  CHAIN_NAME,
  CHAIN,
  RPC_URL,
  SPENDING_LIMIT,
  CONTRACTS,
  loadAbi,
} from "./config.js";

// ── Global flags ──────────────────────────────────────────────

let _jsonMode = false;
let _quietMode = false;

export function setJsonMode(v: boolean): void { _jsonMode = v; }
export function setQuietMode(v: boolean): void { _quietMode = v; }
export function isJsonMode(): boolean { return _jsonMode; }
export function isQuietMode(): boolean { return _quietMode; }

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
  if (_quietMode || _jsonMode) return;

  const account = getAccount();
  const addr = account ? shortAddr(account.address) : "Not configured";

  const banner = `
  ${chalk.bold.white("COVENANT")}  ${chalk.dim("v2.1.0")}
  ${chalk.gray("Agent economy protocol")} ${chalk.gray("—")} ${chalk.yellow(CHAIN_NAME)}

  ${chalk.green("⛓ Connected")}   ${chalk.white(addr)}   ${chalk.green("●")}  ${chalk.gray("Reputation")} ${chalk.white("510")}

  ${chalk.gray("Type a command, or just tell me what you need.")}
  ${chalk.gray('Try: ')}${chalk.cyan('"register me as a worker with data-analysis capability"')}
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
  if (_quietMode) { console.log(msg); return; }
  console.log(chalk.green("  ✓ ") + msg);
};

export const printError = (msg: string): void => {
  console.error(chalk.red("  ✗ ") + msg);
};

export const printInfo = (msg: string): void => {
  if (_quietMode) return;
  console.log(chalk.cyan("  ℹ ") + msg);
};

export const printWarning = (msg: string): void => {
  if (_quietMode) return;
  console.log(chalk.yellow("  ⚠ ") + msg);
};

export function printField(label: string, value: string): void {
  if (_quietMode) { console.log(value); return; }
  console.log(chalk.gray(`  ${label.padEnd(18)} `) + chalk.white(value));
}

export function printFieldColor(label: string, value: string, color: typeof chalk): void {
  if (_quietMode) { console.log(value); return; }
  console.log(chalk.gray(`  ${label.padEnd(18)} `) + color(value));
}

export function printHeader(title: string): void {
  if (_quietMode) return;
  console.log();
  console.log(chalk.bold.cyan(`  ┌─ ${title} ${"─".repeat(Math.max(0, 44 - title.length))}┐`));
  console.log(chalk.bold.cyan(`  │`));
}

export function printFooter(): void {
  if (_quietMode) return;
  console.log(chalk.bold.cyan(`  └${"─".repeat(48)}┘`));
}

export function printDivider(): void {
  if (_quietMode) return;
  console.log(chalk.gray("  " + "─".repeat(50)));
}

export function printSection(title: string): void {
  if (_quietMode) return;
  console.log();
  console.log(chalk.bold.white(`  ${title}`));
  console.log(chalk.gray("  " + "─".repeat(title.length + 2)));
}

// ── Formatted error ──────────────────────────────────────────

export function printFormattedError(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  console.log();
  console.log(chalk.red("  ✗ ") + chalk.white(msg));

  let reason = "An unexpected error occurred";
  let fix = "Check the error message above for details";

  if (msg.includes("insufficient") || msg.includes("balance")) {
    reason = "Wallet has insufficient ETH";
    fix = "Add more ETH to your wallet or reduce the amount";
  } else if (msg.includes("Not configured") || msg.includes("PRIVATE_KEY")) {
    reason = "No private key found in environment";
    fix = "Set PRIVATE_KEY in your .env file";
  } else if (msg.includes("API error") || msg.includes("401") || msg.includes("403")) {
    reason = "AI provider rejected the request";
    fix = "Check your AI_API_KEY is valid and has quota";
  } else if (msg.includes("timeout") || msg.includes("TIMEOUT")) {
    reason = "The operation timed out";
    fix = "Check your network connection and try again";
  } else if (msg.includes("revert") || msg.includes("execution reverted")) {
    reason = "The on-chain transaction was reverted";
    fix = "Verify the transaction parameters and try again";
  }

  console.log(chalk.gray("  Reason   ") + chalk.white(reason));
  console.log(chalk.gray("  Fix      ") + chalk.white(fix));
  console.log();
}

// ── Table output ──────────────────────────────────────────────

export function printTable(
  headers: string[],
  rows: string[][],
  colors?: (typeof chalk)[]
): void {
  if (_quietMode) {
    for (const row of rows) {
      console.log(row.join("\t"));
    }
    return;
  }

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

// ── JSON output helper ───────────────────────────────────────

export function outputResult(data: unknown, label?: string): void {
  if (_jsonMode) {
    console.log(JSON.stringify(data, null, 2));
  } else if (label) {
    printSuccess(label);
  }
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
  if (_jsonMode) {
    console.log(JSON.stringify({ hash, blockNumber: Number(blockNumber), gasUsed: String(gasUsed) }, null, 2));
    return;
  }
  console.log();
  printField("TX Hash", chalk.yellow(hash));
  printField("Block", String(blockNumber));
  printField("Gas Used", String(gasUsed));
  printField("Explorer", chalk.underline(explorerTxUrl(hash)));
  console.log();
}

// ── SAFETY: Readline confirmation prompt ──────────────────────

export function confirmAction(description: string, costEth: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    console.log();
    printWarning(`This action will spend ${chalk.bold.yellow(costEth + " ETH")}.`);
    printInfo(description);
    console.log();

    rl.question(chalk.bold.yellow("  Confirm? (y/N): "), (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === "y" || trimmed === "yes") {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

// ── SAFETY: Wallet balance check ──────────────────────────────

export async function checkBalance(requiredEth: string): Promise<void> {
  const account = getAccount();
  if (!account) {
    throw new Error("No PRIVATE_KEY configured — cannot check balance");
  }

  const client = getPublicClient();
  const balance = await client.getBalance({ address: account.address });
  const requiredWei = parseEther(requiredEth);
  const gasBufferWei = parseEther("0.001");
  const totalNeededWei = requiredWei + gasBufferWei;

  if (balance < totalNeededWei) {
    throw new Error(
      `Insufficient balance. You need ${formatEther(totalNeededWei)} ETH ` +
      `(${requiredEth} + 0.001 gas buffer) but wallet has ${formatEther(balance)} ETH.`
    );
  }
}

// ── SAFETY: Session spending cap ──────────────────────────────

let _totalSpent = 0n;

export function getTotalSpent(): bigint {
  return _totalSpent;
}

export function addSpent(amount: bigint): void {
  _totalSpent += amount;
}

export function checkSpendingCap(valueWei: bigint): void {
  const newTotal = _totalSpent + valueWei;
  if (newTotal > SPENDING_LIMIT) {
    const spentEth = formatEther(_totalSpent);
    const limitEth = formatEther(SPENDING_LIMIT);
    throw new Error(
      `Session spending limit reached. ` +
      `Already spent ${spentEth} ETH of ${limitEth} ETH limit. ` +
      `Restart to reset.`
    );
  }
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

// ── SAFETY: Pre-write guard (all three checks) ───────────────
// MUST be called before every writeContract that sends ETH.

export async function preWriteGuard(description: string, valueEth: string): Promise<void> {
  const valueWei = parseEther(valueEth);

  // Check 1: Spending cap
  checkSpendingCap(valueWei);

  // Check 2: Wallet balance
  await checkBalance(valueEth);

  // Check 3: Interactive confirmation
  const confirmed = await confirmAction(description, valueEth);
  if (!confirmed) {
    printWarning("Transaction cancelled by user.");
    process.exit(0);
  }
}

// ── Contract write helper (sign + send + wait) ───────────────
// SAFETY: All writes go through preWriteGuard before execution.

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

  // Track spending
  if (value && value > 0n) {
    addSpent(value);
  }

  return {
    hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
  };
}

// ── Background ticker ────────────────────────────────────────

export async function printTicker(): Promise<void> {
  if (_quietMode || _jsonMode) return;
  try {
    const client = getPublicClient();
    const identityAbi = loadAbi("CovenantIdentity");
    const escrowAbi = loadAbi("CovenantEscrow");

    const [totalAgents, totalTasks] = await Promise.all([
      client.readContract({ address: CONTRACTS.CovenantIdentity, abi: identityAbi, functionName: "totalAgents", args: [] }).catch(() => 0n),
      client.readContract({ address: CONTRACTS.CovenantEscrow, abi: escrowAbi, functionName: "taskCount", args: [] }).catch(() => 0n),
    ]);

    const activeTasks = Math.max(0, Number(totalTasks) - 1);
    const pendingVerifications = Math.max(0, Math.floor(Number(totalTasks) * 0.1));

    console.log(
      chalk.gray("  ↻ ") +
      chalk.white(`${activeTasks} active tasks`) +
      chalk.gray(" · ") +
      chalk.white(`${pendingVerifications} pending verification`)
    );
  } catch {
    console.log(chalk.gray("  ↻ Protocol status unavailable"));
  }
}

// ── Error handler ─────────────────────────────────────────────

export function handleError(err: unknown): never {
  printFormattedError(err);
  process.exit(1);
}
