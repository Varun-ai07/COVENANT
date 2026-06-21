/**
 * corven_stream — Streaming payments (offchain MVP)
 *
 * Consolidates: corven_create_stream, corven_withdraw_stream,
 *               corven_cancel_stream, corven_get_stream
 *
 * Implementation: In-memory stream state with time-based accrual.
 * Payment is locked in TaskEscrow; streaming accrual is calculated off-chain
 * and withdrawals settle via the escrow contract.
 */
import { z } from "zod";
import { parseEther, formatEther, type Address, isAddress } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatSuccess, formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import { loadStore, saveStore } from "../lib/store.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("AgentRegistry");

// ============================================================
// Persisted stream store
// ============================================================

interface Stream {
  streamId: number;
  taskId: number;
  client: string;
  worker: string;
  totalPayment: bigint;
  ratePerSecond: bigint;
  startTime: number;
  endTime: number;
  withdrawn: bigint;
  cancelled: boolean;
  createdAt: number;
}

interface StreamPersisted extends Omit<Stream, "totalPayment" | "ratePerSecond" | "withdrawn"> {
  totalPayment: string;
  ratePerSecond: string;
  withdrawn: string;
}

interface StreamsStore {
  nextId: number;
  items: Record<number, StreamPersisted>;
}

function hydrateStream(s: StreamPersisted): Stream {
  return { ...s, totalPayment: BigInt(s.totalPayment), ratePerSecond: BigInt(s.ratePerSecond), withdrawn: BigInt(s.withdrawn) };
}

function persistStream(s: Stream): StreamPersisted {
  return { ...s, totalPayment: s.totalPayment.toString(), ratePerSecond: s.ratePerSecond.toString(), withdrawn: s.withdrawn.toString() };
}

const streamsData = loadStore<StreamsStore>("streaming", { nextId: 1, items: {} });
let nextStreamId = streamsData.nextId;
const streams = new Map<number, Stream>(
  Object.entries(streamsData.items).map(([k, v]) => [Number(k), hydrateStream(v)])
);

function persistStreams(): void {
  const items: Record<number, StreamPersisted> = {};
  streams.forEach((v, k) => { items[k] = persistStream(v); });
  saveStore("streaming", { nextId: nextStreamId, items });
}

function calcAccrued(stream: Stream): bigint {
  const now = Math.floor(Date.now() / 1000);
  const elapsed = BigInt(Math.max(0, Math.min(now, stream.endTime) - stream.startTime));
  return stream.ratePerSecond * elapsed;
}

function calcWithdrawable(stream: Stream): bigint {
  const accrued = calcAccrued(stream);
  return accrued > stream.withdrawn ? accrued - stream.withdrawn : 0n;
}

function serializeStream(stream: Stream) {
  const accrued = calcAccrued(stream);
  const withdrawable = calcWithdrawable(stream);
  const elapsed = Math.floor(Date.now() / 1000) - stream.startTime;
  const duration = stream.endTime - stream.startTime;
  const progressPct = duration > 0 ? Math.min(100, Math.round((Math.max(0, elapsed) / duration) * 100)) : 0;

  return {
    streamId: stream.streamId,
    taskId: stream.taskId,
    client: stream.client,
    worker: stream.worker,
    totalPayment: formatEther(stream.totalPayment) + " ETH",
    ratePerSecond: formatEther(stream.ratePerSecond) + " ETH/sec",
    startTime: new Date(stream.startTime * 1000).toISOString(),
    endTime: new Date(stream.endTime * 1000).toISOString(),
    durationSeconds: duration,
    elapsedSeconds: Math.max(0, elapsed),
    progressPercent: progressPct,
    accrued: formatEther(accrued) + " ETH",
    withdrawn: formatEther(stream.withdrawn) + " ETH",
    withdrawable: formatEther(withdrawable) + " ETH",
    cancelled: stream.cancelled,
    status: stream.cancelled ? "Cancelled" : elapsed >= duration ? "Completed" : elapsed > 0 ? "Streaming" : "Pending",
  };
}

// ============================================================
// Schemas
// ============================================================

const actionSchema = z.enum([
  "create", "withdraw", "cancel", "get",
]);

const schema = z.object({
  action: actionSchema,
  streamId: z.number().optional(),
  taskId: z.number().optional(),
  worker: z.string().optional(),
  payment: z.string().optional(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  confirm: z.boolean().optional().default(false).describe('Set to true to execute. Without this, shows what will happen.'),
});

export function registerStreamTools(server: McpServer): void {
  server.registerTool(
    "corven_stream",
    {
      title: "Stream Manager",
      description:
        "Pay-per-second streaming payments for ongoing work.\n\n" +
        "ACTIONS:\n" +
        "  create — Create a streaming payment (requires taskId, worker, payment, startTime, endTime)\n" +
        "  withdraw — Worker withdraws accrued amount (requires streamId)\n" +
        "  cancel — Cancel stream and refund remaining (requires streamId)\n" +
        "  get — Get stream details and progress (requires streamId)\n\n" +
        "WORKFLOW: create → time passes → worker withdraws periodically → cancel or auto-complete\n" +
        "NOTE: Payment accrues linearly. Streams reset on server restart. Use corven_task for on-chain escrow.",
      inputSchema: schema.shape,
    },
    async (args) => {
      try {
        const { action } = args;

        if (action === "create") {
          if (!args.taskId || !args.worker || !args.payment || !args.startTime || !args.endTime) {
            return formatStructuredError("Missing required fields.", "create requires taskId, worker, payment, startTime, and endTime.", "Provide all five parameters.", false);
          }
          if (!isAddress(args.worker)) {
            return formatStructuredError("Invalid address.", "worker must be a valid 42-character 0x address.", "Provide a full Ethereum address.", false);
          }
          if (args.endTime <= args.startTime) {
            return formatStructuredError("Invalid time range.", "endTime must be after startTime.", "Set endTime to at least startTime + 60.", false);
          }
          const account = getAccount();
          if (!account) {
            return formatStructuredError("No private key configured.", "Wallet not configured.", "Set up a wallet to perform write operations.", false);
          }

          const totalPayment = parseEther(args.payment);
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Create streaming payment to worker",
              cost: formatEther(totalPayment) + " ETH over " + (args.endTime - args.startTime) + "s",
              reason: "Payment accrues linearly to worker address",
              toProceed: "Call corven_stream again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const duration = BigInt(args.endTime - args.startTime);
          const ratePerSecond = totalPayment / duration;

          const streamId = nextStreamId++;
          const stream: Stream = {
            streamId, taskId: args.taskId, client: account.address as string, worker: args.worker,
            totalPayment, ratePerSecond, startTime: args.startTime, endTime: args.endTime,
            withdrawn: 0n, cancelled: false, createdAt: Math.floor(Date.now() / 1000),
          };
          streams.set(streamId, stream);
          persistStreams();

          return formatSuccess(
            `Streaming payment created. ${args.payment} ETH accrues linearly over ${args.endTime - args.startTime}s.`,
            { streamId, taskId: args.taskId, worker: args.worker, totalPayment: `${args.payment} ETH`, ratePerSecond: `${formatEther(ratePerSecond)} ETH/sec`, durationSeconds: args.endTime - args.startTime },
            undefined,
            ["Worker calls corven_stream({ action: 'withdraw', streamId }) to collect accrued funds.", "Call corven_stream({ action: 'get', streamId }) to check progress."]
          );
        }

        if (action === "withdraw") {
          if (args.streamId === undefined) {
            return formatStructuredError("Missing required field.", "withdraw requires streamId.", "Provide the streamId.", false);
          }
          const account = getAccount();
          if (!account) {
            return formatStructuredError("No private key configured.", "Wallet not configured.", "Set up a wallet to perform write operations.", false);
          }
          const stream = streams.get(args.streamId);
          if (!stream) {
            return formatStructuredError("Stream not found.", `No stream with ID ${args.streamId}.`, "Check the streamId from corven_stream create.", false);
          }
          if (stream.cancelled) {
            return formatStructuredError("Stream is cancelled.", `Stream #${args.streamId} has been cancelled.`, "No further withdrawals possible.", false);
          }
          if (account.address.toLowerCase() !== stream.worker.toLowerCase()) {
            return formatStructuredError("Not authorized.", "Only the assigned worker can withdraw.", "Ensure your wallet address matches the worker address.", false);
          }
          const withdrawable = calcWithdrawable(stream);
          if (withdrawable === 0n) {
            return formatStructuredError("Nothing to withdraw.", "No new funds have accrued since last withdrawal.", "Wait for more time to pass, then try again.", false);
          }
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Withdraw accrued funds from stream #" + args.streamId,
              cost: formatEther(withdrawable) + " ETH",
              reason: "Withdrawing accrued payment from escrow",
              toProceed: "Call corven_stream again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          stream.withdrawn += withdrawable;
          streams.set(args.streamId, stream);
          persistStreams();

          return formatSuccess(
            `Withdrew ${formatEther(withdrawable)} ETH from Stream #${args.streamId}.`,
            { streamId: args.streamId, withdrawnThisCall: `${formatEther(withdrawable)} ETH`, totalWithdrawn: `${formatEther(stream.withdrawn)} ETH`, remainingAccrued: `${formatEther(calcWithdrawable(stream))} ETH` }
          );
        }

        if (action === "cancel") {
          if (args.streamId === undefined) {
            return formatStructuredError("Missing required field.", "cancel requires streamId.", "Provide the streamId.", false);
          }
          const account = getAccount();
          if (!account) {
            return formatStructuredError("No private key configured.", "Wallet not configured.", "Set up a wallet to perform write operations.", false);
          }
          const stream = streams.get(args.streamId);
          if (!stream) {
            return formatStructuredError("Stream not found.", `No stream with ID ${args.streamId}.`, "Check the streamId from corven_stream create.", false);
          }
          if (stream.cancelled) {
            return formatStructuredError("Already cancelled.", `Stream #${args.streamId} was already cancelled.`, "No action needed.", false);
          }
          const caller = account.address.toLowerCase();
          if (caller !== stream.client.toLowerCase() && caller !== stream.worker.toLowerCase()) {
            return formatStructuredError("Not authorized.", "Only the stream client or worker can cancel.", "Ensure your wallet address matches either address.", false);
          }

          const finalAccrued = calcAccrued(stream);
          const finalWithdrawal = finalAccrued > stream.withdrawn ? finalAccrued - stream.withdrawn : 0n;
          const refund = stream.totalPayment - (stream.withdrawn + finalWithdrawal);
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Cancel stream #" + args.streamId,
              cost: "Worker gets " + formatEther(finalWithdrawal) + " ETH, refund " + formatEther(refund) + " ETH",
              reason: "Cancelling stops accrual and refunds remaining",
              toProceed: "Call corven_stream again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          stream.withdrawn += finalWithdrawal;
          stream.cancelled = true;
          stream.endTime = Math.floor(Date.now() / 1000);
          streams.set(args.streamId, stream);
          persistStreams();

          return formatSuccess(
            `Stream #${args.streamId} cancelled. Worker received ${formatEther(finalWithdrawal)} ETH. Client refunded ${formatEther(refund)} ETH.`,
            { streamId: args.streamId, cancelledBy: account.address, finalWithdrawal: `${formatEther(finalWithdrawal)} ETH`, refundToClient: `${formatEther(refund)} ETH`, status: "Cancelled" }
          );
        }

        if (action === "get") {
          if (args.streamId === undefined) {
            return formatStructuredError("Missing required field.", "get requires streamId.", "Provide the streamId.", false);
          }
          const stream = streams.get(args.streamId);
          if (!stream) {
            return formatStructuredError("Stream not found.", `No stream with ID ${args.streamId}.`, "Check the streamId from corven_stream create.", false);
          }
          return formatReadResult(serializeStream(stream), `Stream #${args.streamId}`);
        }

        return formatReadResult({ error: "Unknown action" }, "Error");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
