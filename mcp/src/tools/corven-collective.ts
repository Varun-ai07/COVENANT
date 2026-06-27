/**
 * corven_collective — Agent collectives/pools
 *
 * Consolidates: corven_create_collective, corven_join_collective,
 *               corven_launch_collective_task, corven_get_collective
 */
import { z } from "zod";
import { parseEther, formatEther, type Address, isAddress } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import { stringToBytes32 } from "../utils.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("AgentCollective");

const actionSchema = z.enum([
  "create", "join", "launch", "propose", "get",
]);

const schema = z.object({
  action: actionSchema,
  collectiveId: z.number().optional(),
  minContribution: z.string().optional(),
  maxMembers: z.number().optional(),
  contribution: z.string().optional(),
  worker: z.string().optional(),
  payment: z.string().optional(),
  deadline: z.number().optional(),
  descriptionHash: z.string().optional(),
  confirm: z.boolean().optional().default(false).describe('NEVER set this yourself. ALWAYS ask the user first. Show the exact ETH cost and what will happen. Only set to true AFTER the user explicitly says yes.'),
});

export function registerCollectiveTools(server: McpServer): void {
  server.registerTool(
    "corven_collective",
    {
      title: "Collective Manager",
      description:
        "Pool resources with other agents to fund expensive tasks together on COVENANT.\n\n" +
        "ACTIONS:\n" +
        "  create — Create a new collective (requires minContribution, maxMembers)\n" +
        "  join — Join an existing collective by contributing ETH (requires collectiveId, contribution)\n" +
        "  launch — Launch a task from pooled funds (requires collectiveId, worker, payment, deadline, descriptionHash)\n" +
        "  propose — Submit a governance proposal to the collective\n" +
        "  get — Get collective details or total count (pass collectiveId for details, omit for count)\n\n" +
        "WORKFLOW: create → join (others contribute) → launch (use pooled funds for tasks)\n" +
        "NOTE: maxMembers is permanent. Initial contribution defaults to minContribution.\n\n" +
        "WHEN TO USE: When a single agent cannot afford a task alone and needs pooled resources.\n\n" +
        "NEXT STEP: After joining, launch a task with corven_collective({ action: 'launch' })\n\n" +
        "CRITICAL SAFETY: The AI must NEVER auto-set confirm=true. ALWAYS present the cost summary to the user first and wait for explicit approval. This is real money. Violating this is unacceptable.\n\n" +
        "OUTPUT RULES:\n" +
        "- Present results as clean, readable text. Never show raw JSON.\n" +
        "- On error: Explain in plain language what went wrong and suggest next step.\n" +
        "- Always recommend a logical follow-up action.\n" +
        "- Never show stack traces, technical errors, or raw data.",
      inputSchema: schema.shape,
    },
    async (args) => {
      try {
        const { action } = args;

        if (action === "create") {
          if (!args.minContribution || !args.maxMembers) {
            return formatStructuredError("Missing required fields.", "create requires minContribution and maxMembers.", "Provide both parameters.", false);
          }
          const minWei = parseEther(args.minContribution);
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Create new collective with " + args.maxMembers + " max members",
              cost: formatEther(minWei) + " ETH initial contribution",
              reason: "Initial contribution seeds the collective pool",
              toProceed: "Call corven_collective again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const result = await executeOrPrepare(
            CONTRACTS.AgentCollective, ABI, "createCollective",
            [minWei, BigInt(args.maxMembers)],
            minWei
          );
          return formatTxResult(result);
        }

        if (action === "join") {
          if (args.collectiveId === undefined || !args.contribution) {
            return formatStructuredError("Missing required fields.", "join requires collectiveId and contribution.", "Provide both parameters.", false);
          }
          const contribWei = parseEther(args.contribution);
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Join collective #" + args.collectiveId,
              cost: formatEther(contribWei) + " ETH contribution",
              reason: "Contribution pooled with other members for shared tasks",
              toProceed: "Call corven_collective again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const result = await executeOrPrepare(
            CONTRACTS.AgentCollective, ABI, "joinCollective",
            [BigInt(args.collectiveId)],
            contribWei
          );
          return formatTxResult(result);
        }

        if (action === "launch") {
          if (args.collectiveId === undefined || !args.worker || !args.payment || !args.deadline || !args.descriptionHash) {
            return formatStructuredError("Missing required fields.", "launch requires collectiveId, worker, payment, deadline, and descriptionHash.", "Provide all five parameters.", false);
          }
          const paymentWei = parseEther(args.payment);
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Launch task from collective #" + args.collectiveId,
              cost: formatEther(paymentWei) + " ETH from collective pool",
              reason: "Payment released from pooled funds to worker",
              toProceed: "Call corven_collective again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const descBytes32 = stringToBytes32(args.descriptionHash);
          const result = await executeOrPrepare(
            CONTRACTS.AgentCollective, ABI, "launchCollectiveTask",
            [
              BigInt(args.collectiveId),
              args.worker as Address,
              paymentWei,
              BigInt(args.deadline),
              descBytes32,
            ],
            0n
          );
          return formatTxResult(result);
        }

        if (action === "propose") {
          if (args.collectiveId === undefined || !args.descriptionHash) {
            return formatStructuredError("Missing required fields.", "propose requires collectiveId and descriptionHash.", "Provide both parameters.", false);
          }
          return formatReadResult({
            info: "Collective proposals are not available in V5 AgentCollective.",
            reason: "V5 AgentCollective does not have a submitProposal function. Governance features will be added in a future release.",
            collectiveId: args.collectiveId,
          }, "Submit Proposal — Not Available");
        }

        if (action === "get") {
          if (args.collectiveId === undefined) {
            const count = await readContract(CONTRACTS.AgentCollective, ABI, "collectiveCounter", []);
            return formatReadResult({ totalCollectives: Number(count) }, "Collective Count");
          }
          const data = await readContract(CONTRACTS.AgentCollective, ABI, "getCollective", [BigInt(args.collectiveId)]);
          const enriched = {
            ...(data as any),
            totalFundEth: formatEther((data as any).totalFund),
          };
          return formatReadResult(enriched, `Collective #${args.collectiveId}`);
        }

        return formatReadResult({ error: "Unknown action" }, "Error");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
