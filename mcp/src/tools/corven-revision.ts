import { z } from "zod";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("RevisionManager");

const actionSchema = z.enum(["request", "submit", "get", "check"]);

const schema = z.object({
  action: actionSchema,
  taskId: z.number().optional(),
  feedbackHash: z.string().optional(),
  deliverableHash: z.string().optional(),
  confirm: z.boolean().optional().default(false).describe('NEVER set this yourself. ALWAYS ask the user first. Show the exact ETH cost and what will happen. Only set to true AFTER the user explicitly says yes.'),
});

function getRevisionManagerAddress(): `0x${string}` {
  const addr = CONTRACTS.RevisionManager;
  if (!addr || addr === "0x0000000000000000000000000000000000000000") {
    throw new Error("RevisionManager not deployed.");
  }
  return addr;
}

export function registerRevisionTools(server: McpServer): void {
  server.registerTool(
    "corven_revision",
    {
      title: "Revision Tracking",
      description:
        "Request revisions on deliverables and track revision history on COVENANT.\n\n" +
        "ACTIONS:\n" +
        "  request — Client requests changes (requires taskId, feedbackHash)\n" +
        "  submit — Worker submits revised work (requires taskId, deliverableHash)\n" +
        "  get — Get revision history (requires taskId)\n" +
        "  check — Check if revisions are allowed (requires taskId)\n\n" +
        "WORKFLOW: request → submit → check → approve or request again\n" +
        "LIMIT: Max 3 revisions per task. Revisions are free — only disputes cost ETH.\n\n" +
        "WHEN TO USE: When delivered work needs changes before final approval.\n\n" +
        "NEXT STEP: After revision, verify the updated work with corven_verify({ action: 'deep' })\n\n" +
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

        if (action === "request") {
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Request revision for task #" + args.taskId,
              cost: "0 ETH (free)",
              reason: "Revisions are free — only disputes cost ETH",
              toProceed: "Call corven_revision again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const addr = getRevisionManagerAddress();
          const result = await executeOrPrepare(
            addr, ABI, "requestRevision",
            [BigInt(args.taskId!), args.feedbackHash!],
            0n
          );
          return formatTxResult(result);
        }

        if (action === "submit") {
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Submit revised work for task #" + args.taskId,
              cost: "0 ETH (free)",
              reason: "Revisions are free — only disputes cost ETH",
              toProceed: "Call corven_revision again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const addr = getRevisionManagerAddress();
          const result = await executeOrPrepare(
            addr, ABI, "submitRevision",
            [BigInt(args.taskId!), args.deliverableHash!],
            0n
          );
          return formatTxResult(result);
        }

        if (action === "get") {
          const addr = getRevisionManagerAddress();
          const revisions = await readContract(addr, ABI, "revisions", [BigInt(args.taskId!)]);
          return formatReadResult({
            taskId: args.taskId,
            revisionCount: (revisions as any[]).length,
            revisions,
          }, `Revisions for Task #${args.taskId}`);
        }

        if (action === "check") {
          const addr = getRevisionManagerAddress();
          const canRevise = await readContract(addr, ABI, "revisionAllowed", [BigInt(args.taskId!)]);
          const count = await readContract(addr, ABI, "getRevisionCount", [BigInt(args.taskId!)]);
          return formatReadResult({
            taskId: args.taskId,
            canRevise,
            revisionCount: Number(count),
          }, `Revision Status for Task #${args.taskId}`);
        }

        return formatReadResult({ error: "Unknown action" }, "Error");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
