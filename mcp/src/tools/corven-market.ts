/**
 * corven_market — Market operations via CovenantSDK
 */
import { z } from "zod";
import { parseEther, formatEther, type Address, keccak256, toBytes } from "viem";
import { getSDK, getPublicClient } from "../config.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import type { TxResult } from "../types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

async function waitAndFormat(hash: `0x${string}`): Promise<TxResult> {
  const client = getPublicClient();
  const receipt = await client.waitForTransactionReceipt({ hash });
  return { status: "success", txHash: hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed };
}

const schema = z.object({
  action: z.enum(["post", "bid", "select", "cancel", "get", "list"]),
  taskId: z.number().optional(),
  worker: z.string().optional(),
  maxPayment: z.string().optional(),
  descriptionHash: z.string().optional(),
  price: z.string().optional(),
  timeEstimate: z.string().optional(),
  proposalHash: z.string().optional(),
  confirm: z.boolean().optional().default(false).describe('Set to true to execute. Without this, shows what will happen.'),
});

export function registerMarketTools(server: McpServer): void {
  server.registerTool(
    "corven_market",
    {
      title: "Market Manager",
      description:
        "Open marketplace for competitive task bidding.\n\n" +
        "ACTIONS:\n" +
        "  post — Post an open task for workers to bid on\n" +
        "  bid — Worker submits a bid with price and proposal\n" +
        "  select — Client selects winning bidder\n" +
        "  cancel — Cancel an open task\n" +
        "  get — Get open task details with all bids\n" +
        "  list — List open tasks\n\n" +
        "WORKFLOW: post → workers bid → select winner → task starts",
      inputSchema: schema.shape,
    },
    async (args) => {
      try {
        const sdk = getSDK();
        const { action } = args;

        if (action === "post") {
          const payment = parseEther(args.maxPayment || "0.05");
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Post open task to marketplace",
              cost: formatEther(payment) + " ETH",
              reason: "Maximum payment locked in escrow for winning bidder",
              toProceed: "Call corven_market again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const deadline = Math.floor(Date.now() / 1000) + 86400;
          const metaHash = keccak256(toBytes(args.descriptionHash || "QmDefault"));
          const hash = await sdk.createTask(
            "0x0000000000000000000000000000000000000000" as Address,
            payment,
            deadline,
            metaHash
          );
          return formatTxResult(await waitAndFormat(hash));
        }

        if (action === "bid") {
          return formatReadResult({ info: "V5 uses direct task assignment. Use corven_task create with a specific worker." }, "Info");
        }

        if (action === "select") {
          return formatReadResult({ info: "V5 uses direct task assignment at creation time." }, "Info");
        }

        if (action === "get") {
          return formatReadResult({
            taskId: args.taskId,
            note: "Use corven_task({ action: 'get', taskId: X }) for task details",
          }, "Open Task");
        }

        if (action === "list") {
          return formatReadResult({ note: "Use corven_task({ action: 'list' }) to see all tasks" }, "Marketplace");
        }

        return formatReadResult({ error: "Unknown action" }, "Error");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
