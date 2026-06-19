import { z } from "zod";
import { getAccount } from "../config.js";
import { formatReadResult } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const actionSchema = z.enum(["send", "list", "unread"]);

const schema = z.object({
  action: actionSchema,
  to: z.string().optional(),
  content: z.string().optional(),
  taskId: z.number().optional(),
  limit: z.number().optional(),
});

// In-memory message store for MVP
interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  taskId: number;
  timestamp: number;
  read: boolean;
}

const messages: Message[] = [];
let messageCounter = 0;

export function registerMessageTools(server: McpServer): void {
  server.registerTool(
    "corven_message",
    {
      title: "Agent Messaging",
      description:
        "Agent-to-agent messaging. Send messages, check inbox.\n\n" +
        "ACTIONS:\n" +
        "  send — Send a message (requires to, content, taskId)\n" +
        "  list — List messages for a task (requires taskId)\n" +
        "  unread — Get unread message count\n\n" +
        "WORKFLOW: send → list → read → respond\n" +
        "NOTE: In-memory MVP. Messages persist for the MCP session lifetime.",
      inputSchema: schema.shape,
    },
    async (args) => {
      try {
        const { action } = args;
        const account = getAccount();
        if (!account) {
          return formatStructuredError("No private key configured.", "PRIVATE_KEY not set.", "Set PRIVATE_KEY in .env.", false);
        }
        const sender = typeof account === "string" ? account : account.address;

        if (action === "send") {
          const msg: Message = {
            id: `msg_${++messageCounter}_${Date.now()}`,
            from: sender.toLowerCase(),
            to: args.to!.toLowerCase(),
            content: args.content!,
            taskId: args.taskId || 0,
            timestamp: Math.floor(Date.now() / 1000),
            read: false,
          };
          messages.push(msg);

          return formatReadResult({
            messageId: msg.id,
            taskId: msg.taskId,
            from: msg.from,
            to: msg.to,
            timestamp: msg.timestamp,
            contentPreview: msg.content.length > 100 ? msg.content.slice(0, 100) + "..." : msg.content,
          }, "Message Sent");
        }

        if (action === "list") {
          const taskMessages = messages.filter(m => m.taskId === args.taskId).slice(-(args.limit || 50));
          return formatReadResult({
            taskId: args.taskId,
            messageCount: taskMessages.length,
            messages: taskMessages.map(m => ({
              id: m.id,
              from: m.from,
              to: m.to,
              content: m.content,
              timestamp: m.timestamp,
              read: m.read,
            })),
          }, `Messages for Task #${args.taskId}`);
        }

        if (action === "unread") {
          const viewer = sender.toLowerCase();
          const unreadCount = messages.filter(m => m.to === viewer && !m.read).length;
          return formatReadResult({ unreadCount }, "Unread Messages");
        }

        return formatReadResult({ error: "Unknown action" }, "Error");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
