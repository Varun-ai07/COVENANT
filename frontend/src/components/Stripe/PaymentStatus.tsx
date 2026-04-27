"use client";

import { useState, useEffect } from "react";
import { useReadContract } from "wagmi";
import { TaskEscrowABI } from "@/contracts/TaskEscrow.json";
import { getContractAddresses } from "@/contracts/addresses";

interface PaymentStatusProps {
  taskId: bigint;
  chainId: number;
}

export function PaymentStatus({ taskId, chainId }: PaymentStatusProps) {
  const contracts = getContractAddresses(chainId);

  const { data: taskData, isLoading } = useReadContract({
    address: contracts.TaskEscrow as `0x${string}`,
    abi: TaskEscrowABI,
    functionName: "getTask",
    args: [taskId],
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-400">
        <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse"></div>
        <span className="text-sm">Loading payment status...</span>
      </div>
    );
  }

  if (!taskData) {
    return (
      <div className="text-slate-500 text-sm">
        Payment status unavailable
      </div>
    );
  }

  const task = taskData as {
    status: number;
    payment: bigint;
  };

  // Task status constants from the contract
  const TaskStatus = {
    Created: 0,
    Funded: 1,
    InProgress: 2,
    Submitted: 3,
    Completed: 4,
    Failed: 5,
    Disputed: 6
  };

  const isFunded = task.status >= TaskStatus.Funded;
  const isCompleted = task.status === TaskStatus.Completed;
  const isFailed = task.status === TaskStatus.Failed;

  return (
    <div className="flex items-center gap-2">
      {isCompleted ? (
        <div className="flex items-center gap-2 text-emerald-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-medium">Payment Completed</span>
        </div>
      ) : isFailed ? (
        <div className="flex items-center gap-2 text-red-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="text-sm font-medium">Payment Failed</span>
        </div>
      ) : isFunded ? (
        <div className="flex items-center gap-2 text-amber-400">
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">Payment Processing</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-slate-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium">Payment Pending</span>
        </div>
      )}
    </div>
  );
}