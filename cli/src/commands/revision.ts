/**
 * covenant revision — RevisionManager subcommands.
 *
 *   request  — request a revision on a task
 *   submit   — submit revised work
 *   get      — get revision details
 *   count    — get revision count
 */
import { Command } from "commander";
import { type Address, isAddress } from "viem";
import { loadAbi, CONTRACTS } from "../config.js";
import {
  readContract,
  writeContract,
  printHeader,
  printField,
  printSuccess,
  shortAddr,
  toEth,
  toDate,
  handleError,
} from "../utils.js";

const ABI = loadAbi("RevisionManager");

// ──────────────────────────────────────────────────────────────
// request
// ──────────────────────────────────────────────────────────────

async function requestRevision(
  taskId: string,
  reasonHash: string
): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");

  printHeader("Requesting Revision");
  printField("Task ID", String(id));
  printField("Reason Hash", reasonHash);

  const result = await writeContract(
    CONTRACTS.RevisionManager,
    ABI,
    "requestRevision",
    [BigInt(id), reasonHash as `0x${string}`]
  );

  printSuccess(`Revision requested — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// submit
// ──────────────────────────────────────────────────────────────

async function submitRevision(
  taskId: string,
  deliverableHash: string
): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");

  printHeader("Submitting Revision");
  printField("Task ID", String(id));
  printField("Deliverable Hash", deliverableHash);

  const result = await writeContract(
    CONTRACTS.RevisionManager,
    ABI,
    "submitRevision",
    [BigInt(id), deliverableHash as `0x${string}`]
  );

  printSuccess(`Revision submitted — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// get
// ──────────────────────────────────────────────────────────────

async function getRevision(taskId: string): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");

  const data = (await readContract(
    CONTRACTS.RevisionManager,
    ABI,
    "getRevision",
    [BigInt(id)]
  )) as any;

  const isTuple = Array.isArray(data);

  printHeader(`Revision for Task #${id}`);

  if (isTuple) {
    printField("Task ID", String(data[0]));
    printField("Requester", data[1] ? shortAddr(data[1]) : "—");
    printField("Reason Hash", data[2] ?? "—");
    printField("Deliverable", data[3] ?? "—");
    printField("Status", String(data[4] ?? "—"));
    printField("Requested At", toDate(data[5]));
    printField("Submitted At", toDate(data[6]));
  } else {
    printField("Task ID", String(data.taskId));
    printField("Requester", data.requester ? shortAddr(data.requester) : "—");
    printField("Reason Hash", data.reasonHash ?? "—");
    printField("Deliverable", data.deliverableHash ?? "—");
    printField("Status", String(data.status ?? "—"));
    printField("Requested At", toDate(data.requestedAt));
    printField("Submitted At", toDate(data.submittedAt));
  }
}

// ──────────────────────────────────────────────────────────────
// count
// ──────────────────────────────────────────────────────────────

async function revisionCount(): Promise<void> {
  const count = (await readContract(
    CONTRACTS.RevisionManager,
    ABI,
    "revisionCount",
    []
  )) as bigint;

  printHeader("Revision Count");
  printField("Total", String(count));
}

// ──────────────────────────────────────────────────────────────
// Command registration
// ──────────────────────────────────────────────────────────────

export function registerRevisionCommand(parent: Command): void {
  const rev = parent
    .command("revision")
    .description("Task revision operations (RevisionManager)");

  rev
    .command("request <taskId>")
    .description("Request a revision on a task")
    .requiredOption("--reason <hash>", "Reason hash (bytes32)")
    .action(async (taskId, opts) => {
      try {
        await requestRevision(taskId, opts.reason);
      } catch (e) {
        handleError(e);
      }
    });

  rev
    .command("submit <taskId>")
    .description("Submit revised work for a task")
    .requiredOption("--hash <deliverableHash>", "Deliverable hash (bytes32)")
    .action(async (taskId, opts) => {
      try {
        await submitRevision(taskId, opts.hash);
      } catch (e) {
        handleError(e);
      }
    });

  rev
    .command("get <taskId>")
    .description("Get revision details for a task")
    .action(async (taskId) => {
      try {
        await getRevision(taskId);
      } catch (e) {
        handleError(e);
      }
    });

  rev
    .command("count")
    .description("Get total revision count")
    .action(async () => {
      try {
        await revisionCount();
      } catch (e) {
        handleError(e);
      }
    });
}
