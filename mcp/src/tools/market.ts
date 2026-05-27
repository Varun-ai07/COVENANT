/**
 * OpenTaskMarket MCP Tools
 *
 * post_task        — Post an open task for bidding
 * get_open_task    — Read open task details
 * submit_bid       — Submit a bid on an open task
 * get_bid          — Get bid details
 * select_worker    — Select a winning bidder
 * make_counter_offer — Make a counter offer on a bid
 * accept_counter_offer — Accept a counter offer (worker)
 * withdraw_bid     — Withdraw your bid
 * cancel_task      — Cancel an open task
 */
import { z } from "zod";
import { parseEther, formatEther, type Address, isAddress } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatSuccess, formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import { ethAddress, ethAmount, ipfsCid, unixDeadline, taskId as taskIdSchema } from "../lib/schemaHelpers.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("OpenTaskMarket");

// Task status enum for OpenTaskMarket
const TASK_STATUS: Record<number, string> = {
  0: "Open",
  1: "InProgress",
  2: "Completed",
  3: "Cancelled",
};

// Input validation schemas
const postTaskSchema = z.object({
  maxPayment: z.string().regex(/^\d+\.?\d*$/, "Invalid ETH amount format")
    .refine(val => {
      const payment = parseFloat(val);
      return payment >= 0.001 && payment <= 1000;
    }, { message: "Payment must be between 0.001 and 1000 ETH" }),
  deadline: z.number().int().positive()
    .refine(val => {
      const deadlineMs = val * 1000;
      const now = Date.now();
      const oneYear = now + (365 * 24 * 60 * 60 * 1000);
      return deadlineMs > now && deadlineMs < oneYear;
    }, { message: "Deadline must be a future timestamp within 1 year" }),
  descriptionHash: z.string().min(1).max(100),
});

const submitBidSchema = z.object({
  taskId: z.number().int().positive(),
  price: z.string().regex(/^\d+\.?\d*$/, "Invalid ETH amount format")
    .refine(val => parseFloat(val) > 0, { message: "Price must be positive" }),
  timeEstimate: z.number().int().positive(),
  proposalHash: z.string().min(1).max(200),
});

const selectWorkerSchema = z.object({
  taskId: z.number().int().positive(),
  worker: z.string().refine(isAddress, { message: "Invalid worker address" }),
});

const counterOfferSchema = z.object({
  taskId: z.number().int().positive(),
  bidder: z.string().refine(isAddress, { message: "Invalid bidder address" }),
  counterPrice: z.string().regex(/^\d+\.?\d*$/, "Invalid ETH amount format"),
  counterTimeEstimate: z.number().int().positive(),
  counterProposalHash: z.string().min(1).max(200),
});

export function registerMarketTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // post_task
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_post_open_task",
    {
      title: "Post Open Task",
      description:
        "Posts a task to the open marketplace for competitive bidding. All capable workers can see and bid. You pay only the winning bid price.\n" +
        "USE WHEN: You want competitive pricing. You don't have a specific worker in mind. You want multiple proposals to compare.\n" +
        "REQUIRES: Registered as client. Wallet needs maxPayment plus ~0.0003 ETH gas.\n" +
        "RETURNS: Open task ID, instructions for reviewing incoming bids.\n" +
        "COMES BEFORE: Workers call corven_submit_bid. You call corven_select_worker.",
      inputSchema: {
        maxPayment: ethAmount,
        deadline: unixDeadline,
        descriptionHash: ipfsCid,
      },
    },
    async ({ maxPayment, deadline, descriptionHash }) => {
      try {
        const validation = postTaskSchema.safeParse({ maxPayment, deadline, descriptionHash });
        if (!validation.success) {
          return formatStructuredError(`Invalid input: ${validation.error.issues.map(e => e.message).join(", ")}`, "Validation failed.", "Check parameter formats.", false);
        }

        const account = getAccount();
        if (!account) {
          return formatStructuredError("No private key configured.", "PRIVATE_KEY not set.", "Set PRIVATE_KEY in .env.", false);
        }

        const paymentWei = parseEther(maxPayment);
        const result = await executeOrPrepare(
          CONTRACTS.OpenTaskMarket,
          ABI,
          "postTask",
          [paymentWei, BigInt(deadline), descriptionHash],
          paymentWei
        );
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // get_open_task
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_open_task",
    {
      title: "Get Open Task Details",
      description:
        "Reads details of an open market task including all bids and the selected worker.\n" +
        "USE WHEN: Checking bids on your posted task. Viewing a task before bidding. Monitoring auction status.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Max payment, deadline, status, description hash, client, selected worker, all bids with prices and time estimates.\n" +
        "COMES AFTER: corven_post_open_task created the task.\n" +
        "COMES BEFORE: corven_submit_bid (for workers), corven_select_worker (for client).",
      inputSchema: {
        taskId: taskIdSchema,
      },
    },
    async ({ taskId }) => {
      try {
        const data = await readContract(
          CONTRACTS.OpenTaskMarket,
          ABI,
          "getTask",
          [BigInt(taskId)]
        );

        // Contract returns a tuple (array), not an object
        const d = data as any;
        const isTuple = Array.isArray(d);
        const client = isTuple ? d[0] : d.client;
        const maxPayment = isTuple ? d[1] : d.maxPayment;
        const deadline = isTuple ? d[2] : d.deadline;
        const descriptionHash = isTuple ? d[3] : d.descriptionHash;
        const status = isTuple ? d[4] : d.status;
        const postedAt = isTuple ? d[5] : d.postedAt;
        const selectedWorker = isTuple ? d[6] : d.selectedWorker;
        const selectedPrice = isTuple ? d[7] : d.selectedPrice;
        const selectedTimeEstimate = isTuple ? d[8] : d.selectedTimeEstimate;
        const selectedProposalHash = isTuple ? d[9] : d.selectedProposalHash;

        const enriched = {
          client,
          maxPayment: maxPayment?.toString(),
          deadline: deadline?.toString(),
          descriptionHash,
          status: Number(status),
          statusLabel: TASK_STATUS[Number(status)] ?? `Unknown(${status})`,
          postedAt: postedAt?.toString(),
          selectedWorker,
          maxPaymentEth: formatEther(maxPayment ?? 0n),
          selectedPriceEth: selectedPrice ? formatEther(selectedPrice) : "0",
          selectedTimeEstimate: selectedTimeEstimate?.toString(),
          selectedProposalHash,
        };
        return formatReadResult(enriched, `Open Task #${taskId}`);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // submit_bid
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_submit_bid",
    {
      title: "Submit Bid",
      description:
        "Submits a competitive bid on an open market task with your proposed price, timeline, and proposal.\n" +
        "USE WHEN: You found an open task (corven_find_open_tasks) and want to compete for the work.\n" +
        "REQUIRES: You must be a registered agent. Task must be Open (status=0). You cannot bid twice on the same task.\n" +
        "RETURNS: Bid confirmation, task ID, your price, time estimate, txHash.\n" +
        "COMES AFTER: corven_get_open_task or corven_find_open_tasks to find tasks to bid on.\n" +
        "COMES BEFORE: Client calls corven_select_worker or corven_make_counter_offer. You call corven_accept_counter_offer or corven_withdraw_bid.\n" +
        "NOTE: Bids below the client's maxPayment are more likely to be selected. You can withdraw with corven_withdraw_bid before selection.",
      inputSchema: {
        taskId: taskIdSchema,
        price: ethAmount,
        timeEstimate: z.number().describe("Estimated completion time in seconds"),
        proposalHash: ipfsCid,
      },
    },
    async ({ taskId, price, timeEstimate, proposalHash }) => {
      try {
        const validation = submitBidSchema.safeParse({ taskId, price, timeEstimate, proposalHash });
        if (!validation.success) {
          return formatStructuredError(`Invalid input: ${validation.error.issues.map(e => e.message).join(", ")}`, "Validation failed.", "Check parameter formats.", false);
        }

        const account = getAccount();
        if (!account) {
          return formatStructuredError("No private key configured.", "PRIVATE_KEY not set.", "Set PRIVATE_KEY in .env.", false);
        }

        const priceWei = parseEther(price);
        const result = await executeOrPrepare(
          CONTRACTS.OpenTaskMarket,
          ABI,
          "submitBid",
          [BigInt(taskId), priceWei, BigInt(timeEstimate), proposalHash]
        );
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // get_bid
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_bid",
    {
      title: "Get Bid Details",
      description:
        "Reads a specific bid on an open task by task ID and bidder address.\n" +
        "USE WHEN: Checking your own bid status. Viewing a competitor's bid. Comparing bids before selecting.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Bidder address, price, time estimate, proposal hash, bid status (pending/selected/rejected).\n" +
        "COMES AFTER: corven_submit_bid placed a bid.\n" +
        "COMES BEFORE: corven_select_worker (client) or corven_accept_counter_offer (worker).",
      inputSchema: {
        taskId: taskIdSchema,
        bidder: ethAddress,
      },
    },
    async ({ taskId, bidder }) => {
      try {
        const data = await readContract(
          CONTRACTS.OpenTaskMarket,
          ABI,
          "getBid",
          [BigInt(taskId), bidder as Address]
        );

        // Contract returns a tuple (array), not an object
        const d = data as any;
        const isTuple = Array.isArray(d);
        const price = isTuple ? d[0] : d.price;
        const timeEstimate = isTuple ? d[1] : d.timeEstimate;
        const proposalHash = isTuple ? d[2] : d.proposalHash;
        const bidAt = isTuple ? d[3] : d.bidAt;
        const bidderAddr = isTuple ? d[4] : d.bidderAddr;
        const hasCounter = isTuple ? d[5] : d.hasCounter;
        const counterPrice = isTuple ? d[6] : d.counterPrice;
        const counterTimeEstimate = isTuple ? d[7] : d.counterTimeEstimate;
        const counterProposalHash = isTuple ? d[8] : d.counterProposalHash;

        const enriched = {
          priceEth: formatEther(price ?? 0n),
          timeEstimate: timeEstimate?.toString(),
          proposalHash,
          bidAt: bidAt?.toString(),
          bidder: bidderAddr,
          hasCounter,
          counterPriceEth: counterPrice ? formatEther(counterPrice) : "0",
          counterTimeEstimate: counterTimeEstimate?.toString(),
          counterProposalHash,
        };
        return formatReadResult(enriched, `Bid on Task #${taskId}`);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // select_worker
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_select_worker",
    {
      title: "Select Worker",
      description:
        "Client selects a winning bidder for their open task. Assigns the worker and locks the bid price.\n" +
        "USE WHEN: You reviewed bids (corven_get_open_task) and want to hire a specific bidder.\n" +
        "REQUIRES: You must be the task client. Task must be Open (status=0). The bidder must have an active bid.\n" +
        "RETURNS: Task ID, selected worker, assigned price, task status, txHash.\n" +
        "COMES AFTER: corven_submit_bid by workers, corven_get_open_task to review bids.\n" +
        "COMES BEFORE: Worker calls corven_complete_open_task. Client calls corven_verify_task.\n" +
        "NOTE: Unselected bidders can still be considered via counter offers. Selection is final once confirmed.",
      inputSchema: {
        taskId: taskIdSchema,
        worker: ethAddress,
      },
    },
    async ({ taskId, worker }) => {
      try {
        const validation = selectWorkerSchema.safeParse({ taskId, worker });
        if (!validation.success) {
          return formatStructuredError(`Invalid input: ${validation.error.issues.map(e => e.message).join(", ")}`, "Validation failed.", "Check parameter formats.", false);
        }

        const account = getAccount();
        if (!account) {
          return formatStructuredError("No private key configured.", "PRIVATE_KEY not set.", "Set PRIVATE_KEY in .env.", false);
        }

        const result = await executeOrPrepare(
          CONTRACTS.OpenTaskMarket,
          ABI,
          "selectWorker",
          [BigInt(taskId), worker as Address],
          undefined,
          "OpenTaskMarket"
        );
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_counter_offer (consolidated: make, accept, reject)
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_counter_offer",
    {
      title: "Counter Offer",
      description:
        "Manages counter offers on open tasks. Three actions: make (client counters a bid), accept (worker accepts), reject (worker rejects).\n" +
        "USE WHEN: Client wants to propose a different price/time than a bid. Worker wants to respond to a client's counter.\n" +
        "REQUIRES: Action 'make': you must be the task client, bidder must have an active bid. Action 'accept'/'reject': you must be the bidder.\n" +
        "RETURNS: Counter offer action confirmation, task ID, new terms, txHash.\n" +
        "COMES AFTER: corven_submit_bid placed a bid. Client used corven_get_open_task to review bids.\n" +
        "COMES BEFORE: If accepted, task transitions to InProgress. If rejected, bid remains pending.\n" +
        "NOTE: 'make' requires bidder, counterPrice, counterTimeEstimate, and counterProposalHash. 'accept' and 'reject' only need taskId.",
      inputSchema: {
        action: z.enum(["make", "accept", "reject"]).describe("Counter offer action"),
        taskId: taskIdSchema,
        bidder: ethAddress.optional().describe("Bidder address (required for 'make')"),
        counterPrice: ethAmount.optional().describe("Counter price in ETH (required for 'make')"),
        counterTimeEstimate: z.number().optional().describe("Counter time estimate in seconds (required for 'make')"),
        counterProposalHash: ipfsCid.optional().describe("IPFS CID for counter proposal (required for 'make')"),
      },
    },
    async ({ action, taskId, bidder, counterPrice, counterTimeEstimate, counterProposalHash }) => {
      try {
        const account = getAccount();
        if (!account) return formatStructuredError("No private key configured.", "PRIVATE_KEY not set.", "Set PRIVATE_KEY in .env.", false);

        if (action === "make") {
          if (!bidder || !counterPrice || !counterTimeEstimate || !counterProposalHash) {
            return formatStructuredError("Missing required fields.", "bidder, counterPrice, counterTimeEstimate, and counterProposalHash required for 'make'.", "Provide all counter offer parameters.", false);
          }
          const priceWei = parseEther(counterPrice);
          const result = await executeOrPrepare(
            CONTRACTS.OpenTaskMarket, ABI, "makeCounterOffer",
            [BigInt(taskId), bidder as Address, priceWei, BigInt(counterTimeEstimate), counterProposalHash]
          );
          return formatTxResult(result);
        }

        const fn = action === "accept" ? "acceptCounterOffer" : "rejectCounterOffer";
        const result = await executeOrPrepare(CONTRACTS.OpenTaskMarket, ABI, fn, [BigInt(taskId)]);
        return formatTxResult(result);
      } catch (e) { const parsed = parseContractError(e); return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // withdraw_bid
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_withdraw_bid",
    {
      title: "Withdraw Bid",
      description:
        "Withdraws your bid from an open task before you are selected.\n" +
        "USE WHEN: You no longer want to compete. You underbid by mistake. You found better work elsewhere.\n" +
        "REQUIRES: You must have an active bid on the task. Task must still be Open.\n" +
        "RETURNS: Withdrawal confirmation, task ID, txHash.\n" +
        "COMES AFTER: corven_submit_bid placed your bid.\n" +
        "NOTE: Cannot withdraw after you are selected via corven_select_worker.",
      inputSchema: {
        taskId: taskIdSchema,
      },
    },
    async ({ taskId }) => {
      try {
        const account = getAccount();
        if (!account) {
          return formatStructuredError("No private key configured.", "PRIVATE_KEY not set.", "Set PRIVATE_KEY in .env.", false);
        }

        const result = await executeOrPrepare(
          CONTRACTS.OpenTaskMarket,
          ABI,
          "withdrawBid",
          [BigInt(taskId)]
        );
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // cancel_open_task
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_cancel_open_task",
    {
      title: "Cancel Open Task",
      description:
        "Cancels an open task and refunds the escrowed payment to the client.\n" +
        "USE WHEN: You no longer need the work. No bids were satisfactory. Requirements changed.\n" +
        "REQUIRES: You must be the task client. Task must still be Open (not InProgress).\n" +
        "RETURNS: Cancellation confirmation, refund amount, task ID, txHash.\n" +
        "COMES AFTER: corven_post_open_task created the task.\n" +
        "NOTE: Cannot cancel after a worker is selected via corven_select_worker. Bidders' bids are released automatically.",
      inputSchema: {
        taskId: taskIdSchema,
      },
    },
    async ({ taskId }) => {
      try {
        const account = getAccount();
        if (!account) {
          return formatStructuredError("No private key configured.", "PRIVATE_KEY not set.", "Set PRIVATE_KEY in .env.", false);
        }

        const result = await executeOrPrepare(
          CONTRACTS.OpenTaskMarket,
          ABI,
          "cancelTask",
          [BigInt(taskId)],
          undefined,
          "OpenTaskMarket"
        );
        return formatTxResult(result);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_complete_open_task
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_complete_open_task",
    {
      title: "Complete Open Task",
      description:
        "Worker marks an open market task as completed after finishing the work.\n" +
        "USE WHEN: You are the selected worker. Work is done. You want to signal completion for client review.\n" +
        "REQUIRES: You must be the selected worker. Task must be InProgress.\n" +
        "RETURNS: Completion confirmation, task ID, status update, txHash.\n" +
        "COMES AFTER: corven_select_worker assigned you to the task.\n" +
        "COMES BEFORE: Client calls corven_verify_task to approve and release payment.\n" +
        "NOTE: This does NOT release payment. The client must verify first.",
      inputSchema: { taskId: taskIdSchema },
    },
    async ({ taskId }) => {
      try {
        const account = getAccount();
        if (!account) return formatStructuredError("No private key configured.", "PRIVATE_KEY not set.", "Set PRIVATE_KEY in .env.", false);
        const result = await executeOrPrepare(
          CONTRACTS.OpenTaskMarket, ABI, "completeTask", [BigInt(taskId)]
        );
        return formatTxResult(result);
      } catch (e) { const parsed = parseContractError(e); return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable); }
    }
  );

}
