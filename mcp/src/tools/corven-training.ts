import { z } from "zod";
import { parseEther, formatEther, type Address } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("TrainingMarketplace");

const actionSchema = z.enum(["create", "enroll", "complete", "list", "get"]);

const schema = z.object({
  action: actionSchema,
  title: z.string().optional(),
  description: z.string().optional(),
  price: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  duration: z.number().optional(),
  trainingId: z.number().optional(),
});

export function registerTrainingTools(server: McpServer): void {
  server.registerTool(
    "corven_training",
    {
      title: "Training Marketplace",
      description:
        "Create and sell agent training programs. 2.5% platform fee.\n\n" +
        "ACTIONS:\n" +
        "  create — Create a training program (requires title, description, price, capabilities, duration)\n" +
        "  enroll — Enroll in a training program (requires trainingId)\n" +
        "  complete — Mark training as completed (requires trainingId)\n" +
        "  list — List available training programs\n" +
        "  get — Get training program details by ID (requires trainingId)\n\n" +
        "WORKFLOW: create → enroll → complete → earn capabilities\n" +
        "FEE: 2.5% platform fee on enrollment payments",
      inputSchema: schema.shape,
    },
    async (args) => {
      try {
        const { action } = args;

        if (action === "create") {
          const result = await executeOrPrepare(
            CONTRACTS.TrainingMarketplace, ABI, "createProgram",
            [args.title!, args.description!, parseEther(args.price || "0.001"),
             args.capabilities || [], args.duration || 10],
            0n
          );
          return formatTxResult(result);
        }

        if (action === "enroll") {
          const program = await readContract(CONTRACTS.TrainingMarketplace, ABI, "getProgram", [BigInt(args.trainingId!)]);
          const result = await executeOrPrepare(
            CONTRACTS.TrainingMarketplace, ABI, "enroll",
            [BigInt(args.trainingId!)],
            parseEther((program as any).price?.toString() || "0")
          );
          return formatTxResult(result);
        }

        if (action === "complete") {
          const result = await executeOrPrepare(
            CONTRACTS.TrainingMarketplace, ABI, "complete",
            [BigInt(args.trainingId!)],
            0n
          );
          return formatTxResult(result);
        }

        if (action === "list") {
          const count = await readContract(CONTRACTS.TrainingMarketplace, ABI, "getProgramCount", []);
          return formatReadResult({ totalPrograms: Number(count) }, "Training Programs");
        }

        if (action === "get") {
          const data = await readContract(CONTRACTS.TrainingMarketplace, ABI, "getProgram", [BigInt(args.trainingId!)]);
          return formatReadResult({
            id: Number((data as any).id),
            title: (data as any).title,
            description: (data as any).description,
            instructor: (data as any).instructor,
            price: formatEther((data as any).price),
            capabilities: (data as any).capabilities,
            duration: Number((data as any).duration),
            graduates: Number((data as any).graduates),
          }, `Training #${args.trainingId}`);
        }

        return formatReadResult({ error: "Unknown action" }, "Error");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
