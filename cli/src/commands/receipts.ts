/**
 * covenant receipts — ReceiptVerifier subcommands.
 *
 *   get   — get all receipts for an address
 *   count — get receipt count for an address
 */
import { Command } from "commander";
import { type Address, isAddress } from "viem";
import chalk from "chalk";
import { loadAbi, CONTRACTS } from "../config.js";
import {
  readContract,
  printHeader,
  printField,
  shortAddr,
  toDate,
  handleError,
} from "../utils.js";

const ABI = loadAbi("ReceiptVerifier");

// ──────────────────────────────────────────────────────────────
// get
// ──────────────────────────────────────────────────────────────

async function get(address: string): Promise<void> {
  if (!isAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }

  const data = (await readContract(
    CONTRACTS.ReceiptVerifier,
    ABI,
    "getReceipts",
    [address as Address]
  )) as any[];

  printHeader(`Receipts for ${shortAddr(address)}`);
  printField("Total", String(data.length));

  if (data.length === 0) return;

  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const isTuple = Array.isArray(r);
    const issuer = isTuple ? r[0] : r.issuer;
    const counterparty = isTuple ? r[1] : r.counterparty;
    const interactionType = isTuple ? r[2] : r.interactionType;
    const dataHash = isTuple ? r[3] : r.dataHash;
    const timestamp = isTuple ? r[4] : r.timestamp;

    console.log();
    console.log(chalk.gray(`  Receipt #${i}`));
    console.log(chalk.gray(`    Issuer:         ${shortAddr(issuer)}`));
    console.log(chalk.gray(`    Counterparty:   ${shortAddr(counterparty)}`));
    console.log(chalk.gray(`    Type:           ${String(interactionType)}`));
    console.log(chalk.gray(`    Data Hash:      ${dataHash ?? "—"}`));
    console.log(chalk.gray(`    Timestamp:      ${toDate(timestamp)}`));
  }
}

// ──────────────────────────────────────────────────────────────
// count
// ──────────────────────────────────────────────────────────────

async function count(address: string): Promise<void> {
  if (!isAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }

  const data = await readContract(
    CONTRACTS.ReceiptVerifier,
    ABI,
    "getReceiptCount",
    [address as Address]
  );

  printHeader(`Receipt Count for ${shortAddr(address)}`);
  printField("Count", String(data));
}

// ──────────────────────────────────────────────────────────────
// Command registration
// ──────────────────────────────────────────────────────────────

export function registerReceiptsCommand(parent: Command): void {
  const receipts = parent
    .command("receipts")
    .description("ERC-8004 attestation receipt operations");

  receipts
    .command("get <address>")
    .description("Get all receipts for an address")
    .action(async (address) => {
      try {
        await get(address);
      } catch (e) {
        handleError(e);
      }
    });

  receipts
    .command("count <address>")
    .description("Get receipt count for an address")
    .action(async (address) => {
      try {
        await count(address);
      } catch (e) {
        handleError(e);
      }
    });
}
