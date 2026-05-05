"use client";

import { useCallback, useState } from "react";
import { useWatchContractEvent } from "wagmi";
import AgentRegistryABI from "@/contracts/AgentRegistry.json";
import TaskEscrowABI from "@/contracts/TaskEscrow.json";
import ReceiptVerifierABI from "@/contracts/ReceiptVerifier.json";
import { getContractAddresses } from "@/config/contracts";
import { useChainId } from "wagmi";
import type { Address } from "viem";

export type ActivityEvent = {
  id: string;
  type:
    | "AgentRegistered"
    | "TaskCreated"
    | "WorkSubmitted"
    | "TaskCompleted"
    | "TaskDisputed"
    | "ReceiptCreated";
  timestamp: number;
  transactionHash?: string;
  logIndex?: number;
  // Event-specific data
  agent?: Address;
  taskId?: bigint;
  client?: Address;
  worker?: Address;
  name?: string;
  deliverableHash?: string;
  workerWins?: boolean;
  receiptId?: `0x${string}`;
  issuer?: Address;
  counterparty?: Address;
  interactionType?: string;
};

export function useActivityFeed() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  const addEvent = useCallback((event: ActivityEvent) => {
    setEvents((prev) => {
      // Avoid duplicates based on transaction hash and log index
      const exists = prev.some(
        (e) =>
          e.transactionHash === event.transactionHash &&
          e.logIndex === event.logIndex
      );
      if (exists) return prev;
      return [event, ...prev].sort((a, b) => b.timestamp - a.timestamp);
    });
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Watch AgentRegistered events
  useWatchContractEvent({
    address: contracts.AgentRegistry as Address,
    abi: AgentRegistryABI as any,
    eventName: "AgentRegistered",
    onLogs(logs) {
      for (const log of logs) {
        const { args, transactionHash, logIndex } = log as unknown as {
          args: { agent: Address; did: `0x${string}`; name: string; stake: bigint };
          transactionHash?: string;
          logIndex?: number;
        };
        addEvent({
          id: `agent-registered-${transactionHash}-${logIndex}`,
          type: "AgentRegistered",
          timestamp: Date.now(),
          transactionHash,
          logIndex,
          agent: args.agent,
          name: args.name,
        });
      }
    },
  });

  // Watch TaskCreated events
  useWatchContractEvent({
    address: contracts.TaskEscrow as Address,
    abi: TaskEscrowABI as any,
    eventName: "TaskCreated",
    onLogs(logs) {
      for (const log of logs) {
        const { args, transactionHash, logIndex } = log as unknown as {
          args: { taskId: bigint; client: Address; worker: Address; payment: bigint; deadline: bigint };
          transactionHash?: string;
          logIndex?: number;
        };
        addEvent({
          id: `task-created-${transactionHash}-${logIndex}`,
          type: "TaskCreated",
          timestamp: Date.now(),
          transactionHash,
          logIndex,
          taskId: args.taskId,
          client: args.client,
          worker: args.worker,
        });
      }
    },
  });

  // Watch WorkSubmitted events
  useWatchContractEvent({
    address: contracts.TaskEscrow as Address,
    abi: TaskEscrowABI as any,
    eventName: "WorkSubmitted",
    onLogs(logs) {
      for (const log of logs) {
        const { args, transactionHash, logIndex } = log as unknown as {
          args: { taskId: bigint; deliverableHash: string };
          transactionHash?: string;
          logIndex?: number;
        };
        addEvent({
          id: `work-submitted-${transactionHash}-${logIndex}`,
          type: "WorkSubmitted",
          timestamp: Date.now(),
          transactionHash,
          logIndex,
          taskId: args.taskId,
          deliverableHash: args.deliverableHash,
        });
      }
    },
  });

  // Watch TaskCompleted events
  useWatchContractEvent({
    address: contracts.TaskEscrow as Address,
    abi: TaskEscrowABI as any,
    eventName: "TaskCompleted",
    onLogs(logs) {
      for (const log of logs) {
        const { args, transactionHash, logIndex } = log as unknown as {
          args: { taskId: bigint; workerPayment: bigint };
          transactionHash?: string;
          logIndex?: number;
        };
        addEvent({
          id: `task-completed-${transactionHash}-${logIndex}`,
          type: "TaskCompleted",
          timestamp: Date.now(),
          transactionHash,
          logIndex,
          taskId: args.taskId,
        });
      }
    },
  });

  // Watch TaskDisputed events
  useWatchContractEvent({
    address: contracts.TaskEscrow as Address,
    abi: TaskEscrowABI as any,
    eventName: "TaskDisputed",
    onLogs(logs) {
      for (const log of logs) {
        const { args, transactionHash, logIndex } = log as unknown as {
          args: { taskId: bigint; disputedBy: Address };
          transactionHash?: string;
          logIndex?: number;
        };
        addEvent({
          id: `task-disputed-${transactionHash}-${logIndex}`,
          type: "TaskDisputed",
          timestamp: Date.now(),
          transactionHash,
          logIndex,
          taskId: args.taskId,
        });
      }
    },
  });

  // Watch ReceiptCreated events
  useWatchContractEvent({
    address: contracts.ReceiptVerifier as Address,
    abi: ReceiptVerifierABI as any,
    eventName: "ReceiptCreated",
    onLogs(logs) {
      for (const log of logs) {
        const { args, transactionHash, logIndex } = log as unknown as {
          args: {
            receiptId: bigint;
            issuer: Address;
            counterparty: Address;
            interactionType: string;
            dataHash: `0x${string}`;
          };
          transactionHash?: string;
          logIndex?: number;
        };
        addEvent({
          id: `receipt-created-${transactionHash}-${logIndex}`,
          type: "ReceiptCreated",
          timestamp: Date.now(),
          transactionHash,
          logIndex,
          receiptId: `0x${args.receiptId.toString(16)}` as `0x${string}`,
          issuer: args.issuer,
          counterparty: args.counterparty,
          interactionType: args.interactionType,
        });
      }
    },
  });

  return { events, clearEvents };
}
