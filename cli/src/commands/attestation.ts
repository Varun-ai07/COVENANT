/**
 * covenant attestation — CovenantAttestation subcommands.
 *
 *   attest   — create an attestation
 *   verify   — verify an attestation
 *   revoke   — revoke an attestation
 *   list     — list attestations for an agent
 *   count    — get total attestation count
 */
import { Command } from "commander";
import { type Address, isAddress } from "viem";
import chalk from "chalk";
import { loadAbi, CONTRACTS } from "../config.js";
import {
  readContract,
  writeContract,
  preWriteGuard,
  printHeader,
  printField,
  printSuccess,
  shortAddr,
  toDate,
  handleError,
} from "../utils.js";

const ABI = loadAbi("CovenantAttestation");

// ──────────────────────────────────────────────────────────────
// attest
// ──────────────────────────────────────────────────────────────

async function attest(
  subject: string,
  schemaHash: string,
  dataHash: string,
  expiresAt: string
): Promise<void> {
  if (!isAddress(subject)) throw new Error(`Invalid subject address: ${subject}`);

  const expiryNum = parseInt(expiresAt, 10);
  if (isNaN(expiryNum) || expiryNum <= 0) {
    throw new Error("Expiry must be a positive Unix timestamp");
  }

  await preWriteGuard(
    `Create attestation for ${shortAddr(subject)}.`,
    "0"
  );

  printHeader("Creating Attestation");
  printField("Subject", shortAddr(subject));
  printField("Schema Hash", schemaHash);
  printField("Data Hash", dataHash);
  printField("Expires", toDate(expiryNum));

  const result = await writeContract(
    CONTRACTS.CovenantAttestation,
    ABI,
    "attest",
    [
      subject as Address,
      schemaHash as `0x${string}`,
      dataHash as `0x${string}`,
      BigInt(expiryNum),
    ]
  );

  printSuccess(`Attestation created — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// verify
// ──────────────────────────────────────────────────────────────

async function verifyAttestation(attestationId: string): Promise<void> {
  const result = (await readContract(
    CONTRACTS.CovenantAttestation,
    ABI,
    "verify",
    [attestationId as `0x${string}`]
  )) as boolean;

  printHeader("Verify Attestation");
  printField("Attestation ID", attestationId);
  printField("Valid", result ? chalk.green("Yes") : chalk.red("No"));
}

// ──────────────────────────────────────────────────────────────
// revoke
// ──────────────────────────────────────────────────────────────

async function revokeAttestation(attestationId: string): Promise<void> {
  await preWriteGuard(
    `Revoke attestation ${attestationId}.`,
    "0"
  );

  printHeader("Revoking Attestation");
  printField("Attestation ID", attestationId);

  const result = await writeContract(
    CONTRACTS.CovenantAttestation,
    ABI,
    "revoke",
    [attestationId as `0x${string}`]
  );

  printSuccess(`Attestation revoked — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// list
// ──────────────────────────────────────────────────────────────

async function listAttestations(agent: string): Promise<void> {
  if (!isAddress(agent)) throw new Error(`Invalid agent address: ${agent}`);

  const data = (await readContract(
    CONTRACTS.CovenantAttestation,
    ABI,
    "getAgentAttestations",
    [agent as Address]
  )) as any[];

  printHeader(`Attestations for ${shortAddr(agent)}`);
  printField("Total", String(data.length));

  if (data.length === 0) return;

  for (let i = 0; i < data.length; i++) {
    const a = data[i];
    const isTuple = Array.isArray(a);
    console.log();
    console.log(chalk.gray(`  Attestation #${i}`));
    if (isTuple) {
      console.log(chalk.gray(`    Subject:    ${shortAddr(a[0])}`));
      console.log(chalk.gray(`    Schema:     ${a[1]}`));
      console.log(chalk.gray(`    Data:       ${a[2]}`));
      console.log(chalk.gray(`    Expires:    ${toDate(a[3])}`));
      console.log(chalk.gray(`    Revoked:    ${a[4] ? "Yes" : "No"}`));
    } else {
      console.log(chalk.gray(`    Subject:    ${a.subject ? shortAddr(a.subject) : "—"}`));
      console.log(chalk.gray(`    Schema:     ${a.schemaHash ?? "—"}`));
      console.log(chalk.gray(`    Data:       ${a.dataHash ?? "—"}`));
      console.log(chalk.gray(`    Expires:    ${toDate(a.expiresAt ?? a.expires)}`));
      console.log(chalk.gray(`    Revoked:    ${a.revoked ? "Yes" : "No"}`));
    }
  }
}

// ──────────────────────────────────────────────────────────────
// count
// ──────────────────────────────────────────────────────────────

async function attestationCount(): Promise<void> {
  const count = (await readContract(
    CONTRACTS.CovenantAttestation,
    ABI,
    "attestationCount",
    []
  )) as bigint;

  printHeader("Attestation Count");
  printField("Total", String(count));
}

// ──────────────────────────────────────────────────────────────
// Command registration
// ──────────────────────────────────────────────────────────────

export function registerAttestationCommand(parent: Command): void {
  const att = parent
    .command("attestation")
    .description("Attestation operations (CovenantAttestation)");

  att
    .command("attest")
    .description("Create an attestation for an agent")
    .requiredOption("--subject <addr>", "Subject agent address")
    .requiredOption("--schema <hash>", "Schema hash (bytes32)")
    .requiredOption("--data <hash>", "Data hash (bytes32)")
    .requiredOption("--expires <ts>", "Expiry timestamp (Unix seconds)")
    .action(async (opts) => {
      try {
        await attest(opts.subject, opts.schema, opts.data, opts.expires);
      } catch (e) {
        handleError(e);
      }
    });

  att
    .command("verify <attestationId>")
    .description("Verify an attestation")
    .action(async (attestationId) => {
      try {
        await verifyAttestation(attestationId);
      } catch (e) {
        handleError(e);
      }
    });

  att
    .command("revoke <attestationId>")
    .description("Revoke an attestation")
    .action(async (attestationId) => {
      try {
        await revokeAttestation(attestationId);
      } catch (e) {
        handleError(e);
      }
    });

  att
    .command("list <agent>")
    .description("List all attestations for an agent")
    .action(async (agent) => {
      try {
        await listAttestations(agent);
      } catch (e) {
        handleError(e);
      }
    });

  att
    .command("count")
    .description("Get total attestation count")
    .action(async () => {
      try {
        await attestationCount();
      } catch (e) {
        handleError(e);
      }
    });
}
