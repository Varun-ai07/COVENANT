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
  confirm: z.boolean().optional().default(false).describe('Set to true to execute. Without this, shows what will happen.'),
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
          const priceWei = parseEther(args.price || "0.001");
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Create training program",
              cost: "Gas only",
              reason: "Lists a new training program on the marketplace",
              toProceed: "Call corven_training again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const result = await executeOrPrepare(
            CONTRACTS.TrainingMarketplace, ABI, "createTraining",
            [args.title!, args.description!, priceWei,
             args.capabilities || [], args.duration || 10],
            0n
          );
          return formatTxResult(result);
        }

        if (action === "enroll") {
          const program = await readContract(CONTRACTS.TrainingMarketplace, ABI, "trainings", [BigInt(args.trainingId!)]);
          const enrollPrice = parseEther((program as any).price?.toString() || "0");
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Enroll in training program #" + args.trainingId,
              cost: formatEther(enrollPrice) + " ETH enrollment fee",
              reason: "2.5% platform fee deducted from payment",
              toProceed: "Call corven_training again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const result = await executeOrPrepare(
            CONTRACTS.TrainingMarketplace, ABI, "enroll",
            [BigInt(args.trainingId!)],
            enrollPrice
          );
          return formatTxResult(result);
        }

        if (action === "complete") {
          return formatReadResult({
            info: "Training completion is not available in V5 contracts.",
            reason: "V5 TrainingMarketplace does not have a complete function. Training completion will be handled through a different mechanism.",
            trainingId: args.trainingId,
          }, "Training Complete — Not Available");
        }

        if (action === "list") {
          const count = await readContract(CONTRACTS.TrainingMarketplace, ABI, "trainingCount", []);
          return formatReadResult({ totalPrograms: Number(count) }, "Training Programs");
        }

        if (action === "get") {
          const data = await readContract(CONTRACTS.TrainingMarketplace, ABI, "trainings", [BigInt(args.trainingId!)]);
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
