/**
 * Agent Messaging MCP Tools
 *
 * send_message    — Send a message to the other party in a task (client <-> worker)
 * get_messages    — Get messages for a task
 * get_unread_count — Get count of unread messages for the current account
 *
 * MVP: in-memory store, no on-chain contract required.
 */
import { z } from "zod";
import { getAccount } from "../config.js";
import { formatReadResult, formatError } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import { loadStore, saveStore } from "../lib/store.js";
import { ethAddress, taskId as taskIdSchema } from "../lib/schemaHelpers.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ─── Persisted message store ────────────────────────────────

interface Message {
  id: string;
  taskId: number;
  from: string;
  to: string;
  content: string;
  timestamp: number;
  read: boolean;
}

interface MessageStoreData {
  counter: number;
  /** taskId -> Message[] stored as a plain object keyed by taskId string. */
  items: Record<number, Message[]>;
}

const messageData = loadStore<MessageStoreData>("messaging", { counter: 0, items: {} });
let messageIdCounter = messageData.counter;
const messageStore = new Map<number, Message[]>(
  Object.entries(messageData.items).map(([k, v]) => [Number(k), v])
);

function persistMessages(): void {
  const items: Record<number, Message[]> = {};
  messageStore.forEach((v, k) => { items[k] = v; });
  saveStore("messaging", { counter: messageIdCounter, items });
}

// ─── Registration ─────────────────────────────────────────────

export function registerMessagingTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // corven_send_message
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_send_message",
    {
      title: "Send Message",
      description:
        "Send a message to the other party in a task (client <-> worker).\n" +
        "USE WHEN: You need to coordinate with your task counterpart — ask questions, share updates, or negotiate.\n" +
        "REQUIRES: You must be either the client or worker on the task. PRIVATE_KEY must be set.\n" +
        "RETURNS: Message ID, sender, recipient, timestamp, content preview.\n" +
        "COMES AFTER: A task has been created (corven_create_task or corven_post_open_task).\n" +
        "NOTE: Messages are stored in-memory for the MCP session lifetime. Use corven_get_messages to retrieve.",
      inputSchema: {
        taskId: taskIdSchema,
        to: ethAddress,
        content: z.string().min(1).max(10000).describe("Message content (max 10,000 characters)"),
      },
    },
    async ({ taskId, to, content }) => {
      try {
        const account = getAccount();
        if (!account) {
          return formatStructuredError(
            "No private key configured.",
            "PRIVATE_KEY environment variable is not set.",
            "Set PRIVATE_KEY in your .env file.",
            false
          );
        }

        const sender = typeof account === "string" ? account : account.address;
        const id = `msg_${++messageIdCounter}_${Date.now()}`;
        const timestamp = Math.floor(Date.now() / 1000);

        const message: Message = {
          id,
          taskId,
          from: sender.toLowerCase(),
          to: to.toLowerCase(),
          content,
          timestamp,
          read: false,
        };

        const existing = messageStore.get(taskId) ?? [];
        existing.push(message);
        messageStore.set(taskId, existing);
        persistMessages();

        return formatReadResult(
          {
            messageId: id,
            taskId,
            from: sender,
            to,
            timestamp,
            contentPreview: content.length > 100 ? content.slice(0, 100) + "..." : content,
          },
          `Message sent on Task #${taskId}`
        );
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_messages
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_messages",
    {
      title: "Get Messages",
      description:
        "Retrieve messages for a task, optionally filtered by timestamp.\n" +
        "USE WHEN: Checking for new messages from your task counterpart. Reviewing conversation history.\n" +
        "REQUIRES: Nothing. Free read-only call.\n" +
        "RETURNS: Array of messages with sender, recipient, content, timestamp, read status.\n" +
        "NOTE: Returned messages are automatically marked as read for the current account.",
      inputSchema: {
        taskId: taskIdSchema,
        since: z.number().optional().describe("Optional Unix timestamp — only return messages after this time"),
        limit: z.number().optional().default(50).describe("Max messages to return (default 50)"),
      },
    },
    async ({ taskId, since, limit }) => {
      try {
        const account = getAccount();
        if (!account) {
          return formatStructuredError(
            "No private key configured.",
            "PRIVATE_KEY environment variable is not set.",
            "Set PRIVATE_KEY in your .env file.",
            false
          );
        }

        const viewer = (typeof account === "string" ? account : account.address).toLowerCase();
        let messages = messageStore.get(taskId) ?? [];

        if (since !== undefined) {
          messages = messages.filter((m) => m.timestamp > since);
        }

        // Sort newest first and apply limit
        messages = [...messages].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);

        // Mark messages addressed to the viewer as read
        for (const msg of messages) {
          if (msg.to === viewer && !msg.read) {
            msg.read = true;
          }
        }

        return formatReadResult(
          {
            taskId,
            messageCount: messages.length,
            messages: messages.map((m) => ({
              id: m.id,
              from: m.from,
              to: m.to,
              content: m.content,
              timestamp: m.timestamp,
              read: m.read,
            })),
          },
          `Messages for Task #${taskId}`
        );
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_unread_count
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_unread_count",
    {
      title: "Get Unread Count",
      description:
        "Get the count of unread messages for the current account on a task.\n" +
        "USE WHEN: Polling for new messages. Checking if you have pending communications.\n" +
        "REQUIRES: PRIVATE_KEY must be set.\n" +
        "RETURNS: Task ID, unread count for the current account.",
      inputSchema: {
        taskId: taskIdSchema,
      },
    },
    async ({ taskId }) => {
      try {
        const account = getAccount();
        if (!account) {
          return formatStructuredError(
            "No private key configured.",
            "PRIVATE_KEY environment variable is not set.",
            "Set PRIVATE_KEY in your .env file.",
            false
          );
        }

        const viewer = (typeof account === "string" ? account : account.address).toLowerCase();
        const messages = messageStore.get(taskId) ?? [];
        const unread = messages.filter((m) => m.to === viewer && !m.read).length;

        return formatReadResult(
          { taskId, unreadCount: unread },
          `Unread messages for Task #${taskId}`
        );
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
