/**
 * covenant task — TaskEscrow subcommands.
 *
 *   create  — create and fund a task
 *   get     — read task details by ID
 *   submit  — submit deliverable hash
 *   verify  — verify/approve a submitted task
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

const ABI = loadAbi("TaskEscrow");

// ──────────────────────────────────────────────────────────────
// create
// ──────────────────────────────────────────────────────────────

async function create(
  worker: string,
  payment: string,
  deadline: string,
  desc: string,
  priority: number
): Promise<void> {
  if (!isAddress(worker)) throw new Error(`Invalid worker address: ${worker}`);

  const paymentWei = parseEther(payment);
  const deadlineNum = parseInt(deadline, 10);
  if (isNaN(deadlineNum) || deadlineNum <= 0) {
    throw new Error("Deadline must be a positive Unix timestamp");
  }

  // Calculate total value: payment + protocol fee (1%) + priority fee
  const PROTOCOL_FEE_BPS = 100n;
  const PRIORITY_FEES = [50n, 100n, 200n, 500n];
  const priorityFeeBps = PRIORITY_FEES[priority] ?? 100n;
  const totalFeeBps = PROTOCOL_FEE_BPS + priorityFeeBps;
  const feeAmount = (paymentWei * totalFeeBps) / 10000n;
  const totalValue = paymentWei + feeAmount;

  printHeader("Creating Task");
  printField("Worker", worker);
  printField("Payment", `${payment} ETH`);
  printField("Deadline", toDate(deadlineNum));
  printField("Description CID", desc);

  const result = await writeContract(
    CONTRACTS.TaskEscrow,
    ABI,
    "createAndFundTask",
    [worker as Address, paymentWei, BigInt(deadlineNum), desc],
    totalValue
  );

  printSuccess(`Task created — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// get
// ──────────────────────────────────────────────────────────────

async function get(taskId: string): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");

  const data = (await readContract(
    CONTRACTS.TaskEscrow,
    ABI,
    "getTask",
    [BigInt(id)]
  )) as any;

  const statusNum = Number(data.status);

  printHeader(`Task #${id}`);
  printField("Client", data.client ? shortAddr(data.client) : "—");
  printField("Worker", data.worker ? shortAddr(data.worker) : "—");
  printField("Payment", toEth(data.payment));
  printField("Status", TASK_STATUS[statusNum] ?? `Unknown(${statusNum})`);
  printField("Deadline", toDate(data.deadline));
  printField("Description", data.descriptionHash ?? "—");
  printField("Deliverable", data.deliverableHash ?? "—");
  printField("Created", toDate(data.createdAt));
  printField("Completed", toDate(data.completedAt));
}

// ──────────────────────────────────────────────────────────────
// submit
// ──────────────────────────────────────────────────────────────

async function submit(taskId: string, deliverable: string): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");

  printHeader("Submitting Work");
  printField("Task ID", String(id));
  printField("Deliverable CID", deliverable);

  const result = await writeContract(
    CONTRACTS.TaskEscrow,
    ABI,
    "submitWork",
    [BigInt(id), deliverable]
  );

  printSuccess(`Work submitted — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// verify
// ──────────────────────────────────────────────────────────────

async function verify(taskId: string, success: boolean): Promise<void> {
  const id = parseInt(taskId, 10);
  if (isNaN(id) || id < 0) throw new Error("Task ID must be a non-negative integer");

  printHeader("Verifying Task");
  printField("Task ID", String(id));
  printField("Result", success ? "Approved" : "Rejected");

  const result = await writeContract(
    CONTRACTS.TaskEscrow,
    ABI,
    "verifyTask",
    [BigInt(id), success],
    undefined,
  );

  printSuccess(`Task verified — block ${result.blockNumber}`);
}

// ──────────────────────────────────────────────────────────────
// Command registration
// ──────────────────────────────────────────────────────────────

export function registerTaskCommand(parent: Command): void {
  const task = parent.command("task").description("Task escrow operations");

  task
    .command("create")
    .description("Create and fund a new task")
    .requiredOption("--worker <addr>", "Worker agent's Ethereum address")
    .requiredOption("--payment <eth>", "Payment amount in ETH")
    .requiredOption("--deadline <ts>", "Unix timestamp deadline (seconds)")
    .requiredOption("--desc <cid>", "IPFS CID for task description")
    .option("--priority <level>", "Priority 0-3 (Low/Medium/High/Urgent)", "1")
    .action(async (opts) => {
      try {
        await create(
          opts.worker,
          opts.payment,
          opts.deadline,
          opts.desc,
          parseInt(opts.priority, 10)
        );
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
    .requiredOption("--deliverable <cid>", "IPFS CID of the deliverable")
    .action(async (id, opts) => {
      try {
        await submit(id, opts.deliverable);
      } catch (e) {
        handleError(e);
      }
    });

  task
    .command("verify <id>")
    .description("Verify and approve/reject a submitted task")
    .option("--success", "Approve the task (default)", true)
    .option("--reject", "Reject the task")
    .action(async (id, opts) => {
      try {
        await verify(id, !opts.reject);
      } catch (e) {
        handleError(e);
      }
    });
}
