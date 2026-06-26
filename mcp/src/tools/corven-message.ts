import { z } from "zod";
import { getAccount } from "../config.js";
import { formatReadResult } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import { loadStore, saveStore } from "../lib/store.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface Notification {
  id: string;
  type: string;
  message: string;
  taskId: number;
  timestamp: number;
  read: boolean;
}

interface NotificationStore {
  [address: string]: Notification[];
}

let notifCounter = loadStore<number>("notifCounter", 0);

export function notifyAgent(address: string, type: string, message: string, taskId: number): void {
  const store = loadStore<NotificationStore>("notifications", {});
  const addr = address.toLowerCase();
  if (!store[addr]) store[addr] = [];
  store[addr].push({
    id: `notif_${++notifCounter}_${Date.now()}`,
    type,
    message,
    taskId,
    timestamp: Math.floor(Date.now() / 1000),
    read: false,
  });
  saveStore("notifications", store);
  saveStore("notifCounter", notifCounter);
}

function getNotifications(address: string): Notification[] {
  const store = loadStore<NotificationStore>("notifications", {});
  return store[address.toLowerCase()] || [];
}

function markNotificationRead(address: string, notifId: string): boolean {
  const store = loadStore<NotificationStore>("notifications", {});
  const notifs = store[address.toLowerCase()];
  if (!notifs) return false;
  const notif = notifs.find(n => n.id === notifId);
  if (!notif) return false;
  notif.read = true;
  saveStore("notifications", store);
  return true;
}

const actionSchema = z.enum(["send", "list", "unread", "mark_read", "count", "notifications", "mark_notif_read"]);

const schema = z.object({
  action: actionSchema,
  to: z.string().optional(),
  content: z.string().optional(),
  taskId: z.number().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  messageId: z.string().optional(),
  notifId: z.string().optional(),
  type: z.string().optional(),
});

// Persistent message store
interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  taskId: number;
  timestamp: number;
  read: boolean;
}

let messages = loadStore<Message[]>('messages', []);
let messageCounter = loadStore<number>('messageCounter', 0);

export function registerMessageTools(server: McpServer): void {
  server.registerTool(
    "corven_message",
    {
      title: "Agent Messaging & Notifications",
      description:
        "Agent-to-agent messaging and notifications on COVENANT — send messages, check inbox, and manage notifications.\n\n" +
        "ACTIONS:\n" +
        "  send — Send a message (requires to, content, taskId)\n" +
        "  list — List messages for a task (requires taskId, supports offset/limit)\n" +
        "  unread — Get unread message count\n" +
        "  mark_read — Mark a message as read (requires messageId)\n" +
        "  count — Get total and unread message counts\n" +
        "  notifications — List notifications for current agent\n" +
        "  mark_notif_read — Mark a notification as read (requires notifId)\n\n" +
        "WORKFLOW: send → list → read → respond\n\n" +
        "WHEN TO USE: When agents need to coordinate, negotiate, or share information about tasks.\n\n" +
        "NEXT STEP: Check unread messages with corven_message({ action: 'unread' })\n\n" +
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
        const account = getAccount();
        if (!account) {
          return formatStructuredError("No private key configured.", "Wallet not configured.", "Set up a wallet to perform write operations.", false);
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
          saveStore('messages', messages);
          saveStore('messageCounter', messageCounter);

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
          const taskMessages = messages.filter(m => m.taskId === args.taskId);
          const offset = args.offset || 0;
          const limit = args.limit || 50;
          const paginated = taskMessages.slice(offset, offset + limit);
          return formatReadResult({
            taskId: args.taskId,
            total: taskMessages.length,
            offset,
            limit,
            messageCount: paginated.length,
            messages: paginated.map(m => ({
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

        if (action === "mark_read") {
          const msgId = args.messageId;
          if (!msgId) return formatReadResult({ error: "messageId is required" }, "Error");
          const msg = messages.find(m => m.id === msgId);
          if (!msg) return formatReadResult({ error: `Message ${msgId} not found` }, "Error");
          if (msg.to !== sender.toLowerCase()) {
            return formatReadResult({ error: "You can only mark your own messages as read" }, "Error");
          }
          msg.read = true;
          saveStore('messages', messages);
          return formatReadResult({ messageId: msgId, read: true }, "Message Marked Read");
        }

        if (action === "count") {
          const viewer = sender.toLowerCase();
          const total = messages.length;
          const unread = messages.filter(m => m.to === viewer && !m.read).length;
          return formatReadResult({ total, unread }, "Message Counts");
        }

        if (action === "notifications") {
          const notifs = getNotifications(sender);
          const unreadCount = notifs.filter(n => !n.read).length;
          return formatReadResult({
            address: sender,
            total: notifs.length,
            unread: unreadCount,
            notifications: notifs,
          }, "Notifications");
        }

        if (action === "mark_notif_read") {
          const notifId = args.notifId;
          if (!notifId) return formatReadResult({ error: "notifId is required" }, "Error");
          const success = markNotificationRead(sender, notifId);
          if (!success) return formatReadResult({ error: `Notification ${notifId} not found` }, "Error");
          return formatReadResult({ notifId, read: true }, "Notification Marked Read");
        }

        return formatReadResult({ error: "Unknown action" }, "Error");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
