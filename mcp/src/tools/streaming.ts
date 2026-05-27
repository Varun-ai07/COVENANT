/**
 * Streaming Payment MCP Tools
 *
 * corven_create_stream   — Create a pay-per-second streaming payment for a task
 * corven_get_stream      — Get stream details (amount streamed, remaining, rate)
 * corven_withdraw_stream — Worker withdraws accumulated streaming payment
 * corven_cancel_stream   — Cancel stream and return remaining to client
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
import {
  formatSuccess,
  formatStructuredError,
  parseContractError,
} from "../lib/formatResponse.js";
import {
  ethAddress,
  ethAmount,
  unixDeadline,
  taskId as taskIdSchema,
} from "../lib/schemaHelpers.js";
import { loadStore, saveStore } from "../lib/store.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ============================================================
// Persisted stream store
// ============================================================

interface Stream {
  streamId: number;
  taskId: number;
  client: string;
  worker: string;
  totalPayment: bigint;       // Total payment in wei
  ratePerSecond: bigint;      // Wei per second
  startTime: number;          // Unix timestamp (seconds)
  endTime: number;            // Unix timestamp (seconds) — stream stops accruing
  withdrawn: bigint;          // Wei already withdrawn by worker
  cancelled: boolean;         // Whether the stream has been cancelled
  createdAt: number;
}

/** Shape stored on disk — bigint fields as strings. */
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
  return {
    ...s,
    totalPayment: BigInt(s.totalPayment),
    ratePerSecond: BigInt(s.ratePerSecond),
    withdrawn: BigInt(s.withdrawn),
  };
}

function persistStream(s: Stream): StreamPersisted {
  return {
    ...s,
    totalPayment: s.totalPayment.toString(),
    ratePerSecond: s.ratePerSecond.toString(),
    withdrawn: s.withdrawn.toString(),
  };
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

// ============================================================
// Schemas
// ============================================================

const createStreamSchema = z.object({
  taskId: z.number().int().positive(),
  worker: z.string().refine(isAddress, { message: "Invalid worker Ethereum address" }),
  payment: z.string().regex(/^\d+\.\d{1,18}$/, "Invalid ETH amount format")
    .refine(val => {
      const amount = parseFloat(val);
      return amount >= 0.001 && amount <= 1000;
    }, { message: "Payment must be between 0.001 and 1000 ETH" }),
  startTime: z.number().int().positive(),
  endTime: z.number().int().positive(),
}).refine(data => data.endTime > data.startTime, {
  message: "endTime must be after startTime",
});

const getStreamSchema = z.object({
  streamId: z.number().int().positive(),
});

const withdrawStreamSchema = z.object({
  streamId: z.number().int().positive(),
});

const cancelStreamSchema = z.object({
  streamId: z.number().int().positive(),
});

// ============================================================
// Helpers
// ============================================================

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
  const progressPct = duration > 0
    ? Math.min(100, Math.round((Math.max(0, elapsed) / duration) * 100))
    : 0;

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
    status: stream.cancelled
      ? "Cancelled"
      : elapsed >= duration
        ? "Completed"
        : elapsed > 0
          ? "Streaming"
          : "Pending",
  };
}

// ============================================================
// Registration
// ============================================================

export function registerStreamingTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // corven_create_stream
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_create_stream",
    {
      title: "Create Streaming Payment",
      description:
        "Creates a pay-per-second streaming payment for a task. Payment accrues linearly from startTime to endTime.\n" +
        "USE WHEN: You want continuous, time-based payment instead of lump-sum escrow (e.g., long-running compute, monitoring, data feeds).\n" +
        "REQUIRES: Task must already exist (created via corven_create_task). Client locks total payment. Worker can withdraw accrued amount at any time.\n" +
        "RETURNS: streamId (save for withdraw/cancel/get), rate per second, duration, start/end times.\n" +
        "COMES AFTER: corven_create_task created the task.\n" +
        "COMES BEFORE: Worker calls corven_withdraw_stream periodically. Client calls corven_cancel_stream to stop early.\n" +
        "NOTE: Payment accrues linearally. If task ends early, call corven_cancel_stream to return unaccrued funds to client.",
      inputSchema: {
        taskId: taskIdSchema,
        worker: ethAddress,
        payment: ethAmount,
        startTime: z.number().describe(
          "Unix timestamp (seconds) when streaming begins. Use Math.floor(Date.now()/1000) to start immediately."
        ),
        endTime: unixDeadline,
      },
    },
    async ({ taskId, worker, payment, startTime, endTime }) => {
      try {
        const validationResult = createStreamSchema.safeParse({
          taskId, worker, payment, startTime, endTime,
        });
        if (!validationResult.success) {
          return formatStructuredError(
            "Invalid stream parameters.",
            validationResult.error.issues.map((e: any) => e.message).join(", "),
            "Ensure: taskId is positive integer, worker is full 42-char 0x address, payment is decimal ETH (0.001-1000), startTime and endTime are Unix timestamps with endTime > startTime.",
            true
          );
        }

        const account = getAccount();
        if (!account) {
          return formatStructuredError(
            "No private key configured.",
            "PRIVATE_KEY environment variable is not set.",
            "Set PRIVATE_KEY in your .env file.",
            false
          );
        }

        const totalPayment = parseEther(payment);
        const duration = BigInt(endTime - startTime);
        if (duration <= 0n) {
          return formatStructuredError(
            "Invalid duration.",
            "endTime must be strictly greater than startTime.",
            "Set endTime to at least startTime + 60 (minimum 1 minute stream).",
            true
          );
        }

        const ratePerSecond = totalPayment / duration;

        // Create the stream in-memory
        const streamId = nextStreamId++;
        const stream: Stream = {
          streamId,
          taskId,
          client: account.address as string,
          worker,
          totalPayment,
          ratePerSecond,
          startTime,
          endTime,
          withdrawn: 0n,
          cancelled: false,
          createdAt: Math.floor(Date.now() / 1000),
        };
        streams.set(streamId, stream);
        persistStreams();

        return formatSuccess(
          `Streaming payment created. ${payment} ETH will accrue linearly over ${endTime - startTime} seconds.`,
          {
            streamId,
            taskId,
            worker,
            totalPayment: `${payment} ETH`,
            ratePerSecond: `${formatEther(ratePerSecond)} ETH/sec`,
            startTime: new Date(startTime * 1000).toISOString(),
            endTime: new Date(endTime * 1000).toISOString(),
            durationSeconds: endTime - startTime,
            client: account.address,
            status: "Pending",
          },
          undefined,
          [
            "Worker can call corven_withdraw_stream with this streamId to withdraw accrued funds at any time.",
            "Call corven_get_stream to check current accrual and progress.",
            "Call corven_cancel_stream to stop the stream early and return remaining funds to client.",
          ]
        );
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_stream
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_stream",
    {
      title: "Get Stream Details",
      description:
        "Returns current details for a streaming payment including accrued amount, withdrawable balance, and progress.\n" +
        "USE WHEN: Checking how much has been streamed so far. Viewing rate and remaining time. Building a payment dashboard.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Total payment, rate, accrued amount, withdrawn amount, withdrawable balance, progress %, status.\n" +
        "STATUS MEANINGS: Pending=not yet started. Streaming=actively accruing. Completed=end time reached. Cancelled=stopped early.",
      inputSchema: {
        streamId: z.number().describe("Stream ID returned by corven_create_stream"),
      },
    },
    async ({ streamId }) => {
      try {
        const validationResult = getStreamSchema.safeParse({ streamId });
        if (!validationResult.success) {
          return formatStructuredError(
            "Invalid stream ID.",
            `Received '${streamId}' — must be a positive integer.`,
            "Pass the numeric streamId returned by corven_create_stream.",
            false
          );
        }

        const stream = streams.get(streamId);
        if (!stream) {
          return formatStructuredError(
            "Stream not found.",
            `No stream exists with ID ${streamId}.`,
            "Check the streamId from corven_create_stream. Streams are stored in-memory and reset on server restart.",
            false
          );
        }

        return formatReadResult(serializeStream(stream), `Stream #${streamId}`);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_withdraw_stream
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_withdraw_stream",
    {
      title: "Withdraw Streamed Payment",
      description:
        "Worker withdraws the currently accrued (but not yet withdrawn) amount from a streaming payment.\n" +
        "USE WHEN: You are the worker and want to collect payment that has accrued so far. Can be called multiple times.\n" +
        "REQUIRES: You must be the assigned worker for the stream. Stream must not be cancelled.\n" +
        "RETURNS: Amount withdrawn, total withdrawn so far, remaining stream balance.\n" +
        "COMES AFTER: corven_create_stream started the stream. Time must have passed for funds to accrue.\n" +
        "NOTE: Each call only withdraws newly accrued funds since the last withdrawal. Safe to call at any time.",
      inputSchema: {
        streamId: z.number().describe("Stream ID returned by corven_create_stream"),
      },
    },
    async ({ streamId }) => {
      try {
        const validationResult = withdrawStreamSchema.safeParse({ streamId });
        if (!validationResult.success) {
          return formatStructuredError(
            "Invalid stream ID.",
            `Received '${streamId}' — must be a positive integer.`,
            "Pass the numeric streamId returned by corven_create_stream.",
            false
          );
        }

        const account = getAccount();
        if (!account) {
          return formatStructuredError(
            "No private key configured.",
            "PRIVATE_KEY environment variable is not set.",
            "Set PRIVATE_KEY in your .env file.",
            false
          );
        }

        const stream = streams.get(streamId);
        if (!stream) {
          return formatStructuredError(
            "Stream not found.",
            `No stream exists with ID ${streamId}.`,
            "Check the streamId from corven_create_stream.",
            false
          );
        }

        if (stream.cancelled) {
          return formatStructuredError(
            "Stream is cancelled.",
            `Stream #${streamId} has been cancelled and no further withdrawals are possible.`,
            "No action available — remaining funds were returned to the client on cancellation.",
            false
          );
        }

        if (account.address.toLowerCase() !== stream.worker.toLowerCase()) {
          return formatStructuredError(
            "Not authorized.",
            "Only the assigned worker can withdraw from a stream.",
            "Ensure PRIVATE_KEY matches the worker address for this stream.",
            false
          );
        }

        const withdrawable = calcWithdrawable(stream);
        if (withdrawable === 0n) {
          return formatStructuredError(
            "Nothing to withdraw.",
            "No new funds have accrued since the last withdrawal, or the stream has not started yet.",
            "Wait for more time to pass, then try again. Use corven_get_stream to check progress.",
            false
          );
        }

        // Record the withdrawal
        stream.withdrawn += withdrawable;
        streams.set(streamId, stream);
        persistStreams();

        return formatSuccess(
          `Withdrew ${formatEther(withdrawable)} ETH from Stream #${streamId}.`,
          {
            streamId,
            withdrawnThisCall: `${formatEther(withdrawable)} ETH`,
            totalWithdrawn: `${formatEther(stream.withdrawn)} ETH`,
            remainingAccrued: `${formatEther(calcWithdrawable(stream))} ETH`,
            totalStreamPayment: `${formatEther(stream.totalPayment)} ETH`,
            worker: stream.worker,
          },
          undefined,
          [
            "Call corven_get_stream to see updated stream status.",
            "Continue calling corven_withdraw_stream periodically as more funds accrue.",
          ]
        );
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_cancel_stream
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_cancel_stream",
    {
      title: "Cancel Streaming Payment",
      description:
        "Cancels an active stream. Worker receives accrued (but not yet withdrawn) funds. Remaining unaccrued payment returns to client.\n" +
        "USE WHEN: Task completed early. Task cancelled. You want to stop the payment clock. Either client or worker can cancel.\n" +
        "REQUIRES: Stream must not already be cancelled. Caller must be the client or worker.\n" +
        "RETURNS: Final accrued amount, total withdrawn by worker, amount returned to client.\n" +
        "NOTE: This is irreversible. Once cancelled, no further withdrawals are possible.",
      inputSchema: {
        streamId: z.number().describe("Stream ID returned by corven_create_stream"),
      },
    },
    async ({ streamId }) => {
      try {
        const validationResult = cancelStreamSchema.safeParse({ streamId });
        if (!validationResult.success) {
          return formatStructuredError(
            "Invalid stream ID.",
            `Received '${streamId}' — must be a positive integer.`,
            "Pass the numeric streamId returned by corven_create_stream.",
            false
          );
        }

        const account = getAccount();
        if (!account) {
          return formatStructuredError(
            "No private key configured.",
            "PRIVATE_KEY environment variable is not set.",
            "Set PRIVATE_KEY in your .env file.",
            false
          );
        }

        const stream = streams.get(streamId);
        if (!stream) {
          return formatStructuredError(
            "Stream not found.",
            `No stream exists with ID ${streamId}.`,
            "Check the streamId from corven_create_stream.",
            false
          );
        }

        if (stream.cancelled) {
          return formatStructuredError(
            "Already cancelled.",
            `Stream #${streamId} was already cancelled.`,
            "No action needed — use corven_get_stream to see final state.",
            false
          );
        }

        const caller = account.address.toLowerCase();
        if (
          caller !== stream.client.toLowerCase() &&
          caller !== stream.worker.toLowerCase()
        ) {
          return formatStructuredError(
            "Not authorized.",
            "Only the stream client or worker can cancel a stream.",
            "Ensure PRIVATE_KEY matches either the client or worker address.",
            false
          );
        }

        // Settle: worker gets any remaining accrued-but-unwithdrawn amount
        const finalAccrued = calcAccrued(stream);
        const finalWithdrawal = finalAccrued > stream.withdrawn
          ? finalAccrued - stream.withdrawn
          : 0n;
        stream.withdrawn += finalWithdrawal;

        // Calculate refund to client
        const refund = stream.totalPayment - stream.withdrawn;

        // Mark cancelled
        stream.cancelled = true;
        stream.endTime = Math.floor(Date.now() / 1000); // Stop the clock
        streams.set(streamId, stream);
        persistStreams();

        return formatSuccess(
          `Stream #${streamId} cancelled. Worker received ${formatEther(finalWithdrawal)} ETH (final withdrawal). Client refunded ${formatEther(refund)} ETH.`,
          {
            streamId,
            cancelledBy: account.address,
            finalWithdrawal: `${formatEther(finalWithdrawal)} ETH`,
            totalWithdrawnByWorker: `${formatEther(stream.withdrawn)} ETH`,
            refundToClient: `${formatEther(refund)} ETH`,
            originalPayment: `${formatEther(stream.totalPayment)} ETH`,
            status: "Cancelled",
          },
          undefined,
          [
            "Stream is now closed — no further withdrawals possible.",
            "If this was tied to a task, consider verifying or disputing via corven_verify_task / corven_dispute_task.",
          ]
        );
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
