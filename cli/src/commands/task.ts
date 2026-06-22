/**
 * covenant task — CovenantEscrow subcommands.
 *
 *   create   — create a task
 *   fund     — fund a created task
 *   get      — read task details by ID
 *   submit   — submit deliverable hash
 *   complete — complete a task (client confirms)
 *   cancel   — cancel a task
 *   dispute  — dispute a task
 *   fail     — fail a task
 */
import { Command } from "commander";
import { parseEther, type Address, isAddress } from "viem";
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
  TASK_STATUS,
  handleError,
} from "../utils.js";

const ABI = loadAbi("CovenantEscrow");

// ──────────────────────────────────────────────────────────────
// create
// ──────────────────────────────────────────────────────────────

async function create(
  worker: string,
  payment: string,
  deadline: string,
  metaHash: string
): Promise<void> {
  if (!isAddress(worker)) throw new Error(`Invalid worker address: ${worker}`);

  const amountWei = parseEther(payment);
  const deadlineNum = parseInt(deadline, 10);
  if (isNaN(deadlineNum) || deadlineNum <= 0) {
    throw new Error("Deadline must be a positive Unix timestamp");
  }

  printHeader("Creating Task");
  printField("Worker", shortAddr(worker));
  printField("Payment", `${payment} ETH`);
  printField("Deadline", toDate(deadlineNum));
  printField("Meta Hash", metaHash);

  const result = await writeContract(
    CONTRACTS.CovenantEscrow,
    ABI,
    "createTask",
    [worker as Address, amountWei, BigInt(deadlineNum), metaHash as `0x${string}`]
  );

  printSuccess(`Task created — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// fund
// ──────────────────────────────────────────────────────────────

async function fund(taskId: string, payment: string): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");

  const amountWei = parseEther(payment);

  printHeader("Funding Task");
  printField("Task ID", String(id));
  printField("Amount", `${payment} ETH`);

  const result = await writeContract(
    CONTRACTS.CovenantEscrow,
    ABI,
    "fundTask",
    [BigInt(id)],
    amountWei
  );

  printSuccess(`Task funded — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// get
// ──────────────────────────────────────────────────────────────

async function get(taskId: string): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");

  const data = (await readContract(
    CONTRACTS.CovenantEscrow,
    ABI,
    "getTask",
    [BigInt(id)]
  )) as any;

  const statusNum = Number(data.status ?? data[5]);

  printHeader(`Task #${id}`);

  if (Array.isArray(data)) {
    printField("Client", data[0] ? shortAddr(data[0]) : "—");
    printField("Worker", data[1] ? shortAddr(data[1]) : "—");
    printField("Amount", toEth(data[2]));
    printField("Deadline", toDate(data[3]));
    printField("Meta Hash", data[4] ?? "—");
    printField("Status", TASK_STATUS[statusNum] ?? `Unknown(${statusNum})`);
    printField("Deliverable", data[6] ?? "—");
    printField("Created", toDate(data[7]));
    printField("Completed", toDate(data[8]));
  } else {
    printField("Client", data.client ? shortAddr(data.client) : "—");
    printField("Worker", data.worker ? shortAddr(data.worker) : "—");
    printField("Amount", toEth(data.amount ?? data.payment));
    printField("Deadline", toDate(data.deadline));
    printField("Meta Hash", data.metaHash ?? data.descriptionHash ?? "—");
    printField("Status", TASK_STATUS[statusNum] ?? `Unknown(${statusNum})`);
    printField("Deliverable", data.deliverableHash ?? "—");
    printField("Created", toDate(data.createdAt));
    printField("Completed", toDate(data.completedAt));
  }
}

// ──────────────────────────────────────────────────────────────
// submit
// ──────────────────────────────────────────────────────────────

async function submit(taskId: string, deliverable: string): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");

  printHeader("Submitting Work");
  printField("Task ID", String(id));
  printField("Deliverable Hash", deliverable);

  const result = await writeContract(
    CONTRACTS.CovenantEscrow,
    ABI,
    "submitWork",
    [BigInt(id), deliverable as `0x${string}`]
  );

  printSuccess(`Work submitted — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// complete
// ──────────────────────────────────────────────────────────────

async function complete(taskId: string): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");

  printHeader("Completing Task");
  printField("Task ID", String(id));

  const result = await writeContract(
    CONTRACTS.CovenantEscrow,
    ABI,
    "completeTask",
    [BigInt(id), "0x"]
  );

  printSuccess(`Task completed — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// cancel
// ──────────────────────────────────────────────────────────────

async function cancel(taskId: string): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");

  printHeader("Cancelling Task");
  printField("Task ID", String(id));

  const result = await writeContract(
    CONTRACTS.CovenantEscrow,
    ABI,
    "cancelTask",
    [BigInt(id)]
  );

  printSuccess(`Task cancelled — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// dispute
// ──────────────────────────────────────────────────────────────

async function dispute(taskId: string): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");

  printHeader("Disputing Task");
  printField("Task ID", String(id));

  const result = await writeContract(
    CONTRACTS.CovenantEscrow,
    ABI,
    "disputeTask",
    [BigInt(id)]
  );

  printSuccess(`Task disputed — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// fail
// ──────────────────────────────────────────────────────────────

async function fail(taskId: string, reason: string): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");

  printHeader("Failing Task");
  printField("Task ID", String(id));
  printField("Reason", reason);

  const result = await writeContract(
    CONTRACTS.CovenantEscrow,
    ABI,
    "failTask",
    [BigInt(id), reason as `0x${string}`]
  );

  printSuccess(`Task failed — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// taskCount
// ──────────────────────────────────────────────────────────────

async function taskCount(): Promise<void> {
  const count = (await readContract(
    CONTRACTS.CovenantEscrow,
    ABI,
    "taskCount",
    []
  )) as bigint;

  printHeader("Task Count");
  printField("Total", String(count));
}

// ──────────────────────────────────────────────────────────────
// Command registration
// ──────────────────────────────────────────────────────────────

export function registerTaskCommand(parent: Command): void {
  const task = parent.command("task").description("Task escrow operations (CovenantEscrow)");

  task
    .command("create")
    .description("Create a new task (must fund separately)")
    .requiredOption("--worker <addr>", "Worker agent's Ethereum address")
    .requiredOption("--amount <eth>", "Payment amount in ETH")
    .requiredOption("--deadline <ts>", "Unix timestamp deadline (seconds)")
    .requiredOption("--meta <hash>", "Metadata hash (bytes32)")
    .action(async (opts) => {
      try {
        await create(opts.worker, opts.amount, opts.deadline, opts.meta);
      } catch (e) {
        handleError(e);
      }
    });

  task
    .command("fund <id>")
    .description("Fund a created task")
    .requiredOption("--amount <eth>", "Amount to fund in ETH")
    .action(async (id, opts) => {
      try {
        await fund(id, opts.amount);
      } catch (e) {
        handleError(e);
      }
    });

  task
    .command("get <id>")
    .description("Get task details by numeric ID")
    .action(async (id) => {
      try {
        await get(id);
      } catch (e) {
        handleError(e);
      }
    });

  task
    .command("submit <id>")
    .description("Submit deliverable for a task")
    .requiredOption("--hash <deliverableHash>", "Deliverable hash (bytes32)")
    .action(async (id, opts) => {
      try {
        await submit(id, opts.hash);
      } catch (e) {
        handleError(e);
      }
    });

  task
    .command("complete <id>")
    .description("Complete a task (client confirms)")
    .action(async (id) => {
      try {
        await complete(id);
      } catch (e) {
        handleError(e);
      }
    });

  task
    .command("cancel <id>")
    .description("Cancel a task")
    .action(async (id) => {
      try {
        await cancel(id);
      } catch (e) {
        handleError(e);
      }
    });

  task
    .command("dispute <id>")
    .description("Dispute a task")
    .action(async (id) => {
      try {
        await dispute(id);
      } catch (e) {
        handleError(e);
      }
    });

  task
    .command("fail <id>")
    .description("Mark a task as failed")
    .requiredOption("--reason <hash>", "Failure reason hash (bytes32)")
    .action(async (id, opts) => {
      try {
        await fail(id, opts.reason);
      } catch (e) {
        handleError(e);
      }
    });

  task
    .command("count")
    .description("Get total task count")
    .action(async () => {
      try {
        await taskCount();
      } catch (e) {
        handleError(e);
      }
    });
}
