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
import { formatTxResult, formatReadResult, formatError } from "../handlers/transactions.js";
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
        "Post an open task for competitive bidding. Workers can submit bids. " +
        "Client sends maxPayment as msg.value. Returns the new taskId.",
      inputSchema: {
        maxPayment: z.string().describe("Maximum payment in ETH (e.g. '0.05')"),
        deadline: z.number().describe("Unix timestamp deadline (seconds)"),
        descriptionHash: z.string().describe("IPFS CID or hash for task description"),
      },
    },
    async ({ maxPayment, deadline, descriptionHash }) => {
      try {
        const validation = postTaskSchema.safeParse({ maxPayment, deadline, descriptionHash });
        if (!validation.success) {
          return formatError(new Error(`Invalid input: ${validation.error.issues.map(e => e.message).join(", ")}`));
        }

        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured — cannot send transactions"));
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
        return formatError(e);
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
      description: "Retrieve details of an open market task including bids and selected worker.",
      inputSchema: {
        taskId: z.number().describe("Numeric task ID"),
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
        return formatError(e);
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
        "Submit a bid on an open task. Include your proposed price, time estimate, and proposal hash.",
      inputSchema: {
        taskId: z.number().describe("Task ID to bid on"),
        price: z.string().describe("Your bid price in ETH"),
        timeEstimate: z.number().describe("Estimated completion time in seconds"),
        proposalHash: z.string().describe("IPFS CID or hash of your proposal"),
      },
    },
    async ({ taskId, price, timeEstimate, proposalHash }) => {
      try {
        const validation = submitBidSchema.safeParse({ taskId, price, timeEstimate, proposalHash });
        if (!validation.success) {
          return formatError(new Error(`Invalid input: ${validation.error.issues.map(e => e.message).join(", ")}`));
        }

        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured"));
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
        return formatError(e);
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
      description: "Retrieve a specific bid on an open task by taskId and bidder address.",
      inputSchema: {
        taskId: z.number().describe("Task ID"),
        bidder: z.string().describe("Bidder's Ethereum address"),
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
        return formatError(e);
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
        "Select a winning bidder for your open task. Only the task client can call this. " +
        "Transitions task to InProgress and assigns the worker.",
      inputSchema: {
        taskId: z.number().describe("Task ID"),
        worker: z.string().describe("Address of the selected worker/bidder"),
      },
    },
    async ({ taskId, worker }) => {
      try {
        const validation = selectWorkerSchema.safeParse({ taskId, worker });
        if (!validation.success) {
          return formatError(new Error(`Invalid input: ${validation.error.issues.map(e => e.message).join(", ")}`));
        }

        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured"));
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
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // make_counter_offer
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_make_counter_offer",
    {
      title: "Make Counter Offer",
      description:
        "Task client makes a counter offer to a worker's bid. " +
        "The worker can then accept or reject the counter.",
      inputSchema: {
        taskId: z.number().describe("Task ID"),
        bidder: z.string().describe("Bidder address to counter"),
        counterPrice: z.string().describe("Counter price in ETH"),
        counterTimeEstimate: z.number().describe("Counter time estimate in seconds"),
        counterProposalHash: z.string().describe("IPFS CID for counter proposal"),
      },
    },
    async ({ taskId, bidder, counterPrice, counterTimeEstimate, counterProposalHash }) => {
      try {
        const validation = counterOfferSchema.safeParse({ taskId, bidder, counterPrice, counterTimeEstimate, counterProposalHash });
        if (!validation.success) {
          return formatError(new Error(`Invalid input: ${validation.error.issues.map(e => e.message).join(", ")}`));
        }

        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured"));
        }

        const priceWei = parseEther(counterPrice);
        const result = await executeOrPrepare(
          CONTRACTS.OpenTaskMarket,
          ABI,
          "makeCounterOffer",
          [BigInt(taskId), bidder as Address, priceWei, BigInt(counterTimeEstimate), counterProposalHash],
          undefined,
          "OpenTaskMarket"
        );
        return formatTxResult(result);
      } catch (e) {
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // accept_counter_offer
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_accept_counter_offer",
    {
      title: "Accept Counter Offer",
      description: "Worker accepts the client's counter offer on their bid.",
      inputSchema: {
        taskId: z.number().describe("Task ID"),
      },
    },
    async ({ taskId }) => {
      try {
        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured"));
        }

        const result = await executeOrPrepare(
          CONTRACTS.OpenTaskMarket,
          ABI,
          "acceptCounterOffer",
          [BigInt(taskId)]
        );
        return formatTxResult(result);
      } catch (e) {
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // withdraw_bid
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_withdraw_bid",
    {
      title: "Withdraw Bid",
      description: "Withdraw your bid from an open task before being selected.",
      inputSchema: {
        taskId: z.number().describe("Task ID"),
      },
    },
    async ({ taskId }) => {
      try {
        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured"));
        }

        const result = await executeOrPrepare(
          CONTRACTS.OpenTaskMarket,
          ABI,
          "withdrawBid",
          [BigInt(taskId)]
        );
        return formatTxResult(result);
      } catch (e) {
        return formatError(e);
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
      description: "Cancel an open task and refund the escrowed payment.",
      inputSchema: {
        taskId: z.number().describe("Task ID to cancel"),
      },
    },
    async ({ taskId }) => {
      try {
        const account = getAccount();
        if (!account) {
          return formatError(new Error("No private key configured"));
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
        return formatError(e);
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
      description: "Worker marks an open market task as completed after being selected.",
      inputSchema: { taskId: z.number().describe("Task ID") },
    },
    async ({ taskId }) => {
      try {
        const account = getAccount();
        if (!account) return formatError(new Error("No private key configured"));
        const result = await executeOrPrepare(
          CONTRACTS.OpenTaskMarket, ABI, "completeTask", [BigInt(taskId)]
        );
        return formatTxResult(result);
      } catch (e) { return formatError(e); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_reject_counter_offer
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_reject_counter_offer",
    {
      title: "Reject Counter Offer",
      description: "Worker rejects the client's counter offer on their bid.",
      inputSchema: { taskId: z.number().describe("Task ID") },
    },
    async ({ taskId }) => {
      try {
        const account = getAccount();
        if (!account) return formatError(new Error("No private key configured"));
        const result = await executeOrPrepare(
          CONTRACTS.OpenTaskMarket, ABI, "rejectCounterOffer", [BigInt(taskId)]
        );
        return formatTxResult(result);
      } catch (e) { return formatError(e); }
    }
  );
}
