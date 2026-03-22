"use client";

import { useState } from "react";
import { useAccount, useWatchContractEvent } from "wagmi";
import { getContractAddresses } from "@/contracts/addresses";
import TaskEscrowABI from "@/contracts/TaskEscrow.json";
import AgentRegistryABI from "@/contracts/AgentRegistry.json";
import ReceiptVerifierABI from "@/contracts/ReceiptVerifier.json";

export interface ActivityEvent {
  id: string;
  type: "registration" | "task_created" | "work_submitted" | "task_completed" | "task_failed" | "task_disputed" | "receipt_created";
  timestamp: Date;
  data: Record<string, string | number | bigint>;
  txHash?: string;
}

export function useActivityFeed() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(31337);
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  const addEvent = (event: Omit<ActivityEvent, "id" | "timestamp">) => {
    setEvents((prev) => [
      {
        ...event,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: new Date(),
      },
      ...prev,
    ].slice(0, 50)); // Keep last 50 events
  };

  // Watch AgentRegistry events
  useWatchContractEvent({
    address: contracts.AgentRegistry as `0x${string}`,
    abi: AgentRegistryABI,
    eventName: "AgentRegistered",
    onLogs(logs) {
      for (const log of logs) {
        const args = (log as unknown as { args: { agent?: string; name?: string; stake?: bigint } }).args;
        addEvent({
          type: "registration",
          data: {
            agent: args?.agent || "",
            name: args?.name || "",
            stake: args?.stake?.toString() || "0",
          },
        });
      }
    },
  });

  // Watch TaskEscrow events
  useWatchContractEvent({
    address: contracts.TaskEscrow as `0x${string}`,
    abi: TaskEscrowABI,
    eventName: "TaskCreated",
    onLogs(logs) {
      for (const log of logs) {
        const args = (log as unknown as { args: { taskId?: bigint; client?: string; worker?: string; payment?: bigint } }).args;
        addEvent({
          type: "task_created",
          data: {
            taskId: Number(args?.taskId || 0),
            client: args?.client || "",
            worker: args?.worker || "",
            payment: args?.payment?.toString() || "0",
          },
        });
      }
    },
  });

  useWatchContractEvent({
    address: contracts.TaskEscrow as `0x${string}`,
    abi: TaskEscrowABI,
    eventName: "WorkSubmitted",
    onLogs(logs) {
      for (const log of logs) {
        const args = (log as unknown as { args: { taskId?: bigint; deliverableHash?: string } }).args;
        addEvent({
          type: "work_submitted",
          data: {
            taskId: Number(args?.taskId || 0),
            deliverableHash: args?.deliverableHash || "",
          },
        });
      }
    },
  });

  useWatchContractEvent({
    address: contracts.TaskEscrow as `0x${string}`,
    abi: TaskEscrowABI,
    eventName: "TaskCompleted",
    onLogs(logs) {
      for (const log of logs) {
        const args = (log as unknown as { args: { taskId?: bigint; workerPayment?: bigint } }).args;
        addEvent({
          type: "task_completed",
          data: {
            taskId: Number(args?.taskId || 0),
            workerPayment: args?.workerPayment?.toString() || "0",
          },
        });
      }
    },
  });

  useWatchContractEvent({
    address: contracts.TaskEscrow as `0x${string}`,
    abi: TaskEscrowABI,
    eventName: "TaskDisputed",
    onLogs(logs) {
      for (const log of logs) {
        const args = (log as unknown as { args: { taskId?: bigint; disputedBy?: string } }).args;
        addEvent({
          type: "task_disputed",
          data: {
            taskId: Number(args?.taskId || 0),
            disputedBy: args?.disputedBy || "",
          },
        });
      }
    },
  });

  // Watch ReceiptVerifier events
  useWatchContractEvent({
    address: contracts.ReceiptVerifier as `0x${string}`,
    abi: ReceiptVerifierABI,
    eventName: "ReceiptCreated",
    onLogs(logs) {
      for (const log of logs) {
        const args = (log as unknown as { args: { receiptId?: bigint; issuer?: string; counterparty?: string; interactionType?: string } }).args;
        addEvent({
          type: "receipt_created",
          data: {
            receiptId: Number(args?.receiptId || 0),
            issuer: args?.issuer || "",
            counterparty: args?.counterparty || "",
            interactionType: args?.interactionType || "",
          },
        });
      }
    },
  });

  return { events, clearEvents: () => setEvents([]) };
}

export function getEventIcon(type: ActivityEvent["type"]): string {
  switch (type) {
    case "registration":
      return "AGENT";
    case "task_created":
      return "TASK";
    case "work_submitted":
      return "WORK";
    case "task_completed":
      return "DONE";
    case "task_failed":
      return "FAIL";
    case "task_disputed":
      return "DISP";
    case "receipt_created":
      return "RCPT";
    default:
      return "EVNT";
  }
}

export function getEventColor(type: ActivityEvent["type"]): string {
  switch (type) {
    case "registration":
      return "text-blue-400 bg-blue-500/20";
    case "task_created":
      return "text-violet-400 bg-violet-500/20";
    case "work_submitted":
      return "text-amber-400 bg-amber-500/20";
    case "task_completed":
      return "text-emerald-400 bg-emerald-500/20";
    case "task_failed":
      return "text-red-400 bg-red-500/20";
    case "task_disputed":
      return "text-orange-400 bg-orange-500/20";
    case "receipt_created":
      return "text-purple-400 bg-purple-500/20";
    default:
      return "text-gray-400 bg-gray-500/20";
  }
}

export function formatEventDescription(event: ActivityEvent): string {
  switch (event.type) {
    case "registration":
      return `New agent "${event.data.name}" registered with ${(Number(event.data.stake) / 1e18).toFixed(2)} ETH stake`;
    case "task_created":
      return `Task #${event.data.taskId} created with ${(Number(event.data.payment) / 1e18).toFixed(2)} ETH escrow`;
    case "work_submitted":
      return `Work submitted for Task #${event.data.taskId}`;
    case "task_completed":
      return `Task #${event.data.taskId} completed - ${(Number(event.data.workerPayment) / 1e18).toFixed(2)} ETH paid`;
    case "task_failed":
      return `Task #${event.data.taskId} failed`;
    case "task_disputed":
      return `Task #${event.data.taskId} disputed`;
    case "receipt_created":
      return `${event.data.interactionType} receipt created (#${event.data.receiptId})`;
    default:
      return "Unknown event";
  }
}
