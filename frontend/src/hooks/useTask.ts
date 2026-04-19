"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent } from "wagmi";
import { parseEther } from "viem";
import { getContractAddresses } from "@/contracts/addresses";
import TaskEscrowABI from "@/contracts/TaskEscrow.json";
import { Task } from "@/types";

export function useTask(taskId: bigint | undefined) {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  const { data: taskData, isLoading, refetch } = useReadContract({
    address: contracts.TaskEscrow as `0x${string}`,
    abi: TaskEscrowABI,
    functionName: "getTask",
    args: taskId !== undefined ? [taskId] : undefined,
    query: { enabled: taskId !== undefined },
  });

  return {
    task: taskData as Task | undefined,
    isLoading,
    refetch,
  };
}

export function useTaskCounter() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  const { data: counter } = useReadContract({
    address: contracts.TaskEscrow as `0x${string}`,
    abi: TaskEscrowABI,
    functionName: "taskCounter",
  });

  return counter ? Number(counter) : 0;
}

export function useClientTasks(clientAddress: `0x${string}` | undefined) {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  const { data: taskIds, isLoading, refetch } = useReadContract({
    address: contracts.TaskEscrow as `0x${string}`,
    abi: TaskEscrowABI,
    functionName: "getClientTasks",
    args: clientAddress ? [clientAddress] : undefined,
    query: { enabled: !!clientAddress },
  });

  return {
    taskIds: (taskIds as bigint[]) || [],
    isLoading,
    refetch,
  };
}

export function useWorkerTasks(workerAddress: `0x${string}` | undefined) {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  const { data: taskIds, isLoading, refetch } = useReadContract({
    address: contracts.TaskEscrow as `0x${string}`,
    abi: TaskEscrowABI,
    functionName: "getWorkerTasks",
    args: workerAddress ? [workerAddress] : undefined,
    query: { enabled: !!workerAddress },
  });

  return {
    taskIds: (taskIds as bigint[]) || [],
    isLoading,
    refetch,
  };
}

export function useCreateTask() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createTask = (
    worker: `0x${string}`,
    payment: string,
    deadline: bigint,
    descriptionHash: string
  ) => {
    const paymentWei = parseEther(payment);
    // TaskEscrow defaults to Priority.Medium in createAndFundTask, which adds a 1% fee.
    const priorityFeeWei = paymentWei / 100n;
    const totalFundingWei = paymentWei + priorityFeeWei;

    writeContract({
      address: contracts.TaskEscrow as `0x${string}`,
      abi: TaskEscrowABI,
      functionName: "createAndFundTask",
      args: [worker, paymentWei, deadline, descriptionHash],
      value: totalFundingWei,
    });
  };

  return {
    createTask,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

export function useSubmitWork() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const submitWork = (taskId: bigint, deliverableHash: string) => {
    writeContract({
      address: contracts.TaskEscrow as `0x${string}`,
      abi: TaskEscrowABI,
      functionName: "submitWork",
      args: [taskId, deliverableHash],
    });
  };

  return {
    submitWork,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

export function useVerifyTask() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const verifyTask = (taskId: bigint, success: boolean) => {
    writeContract({
      address: contracts.TaskEscrow as `0x${string}`,
      abi: TaskEscrowABI,
      functionName: "verifyTask",
      args: [taskId, success],
    });
  };

  return {
    verifyTask,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

export function useDisputeTask() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const disputeTask = (taskId: bigint) => {
    writeContract({
      address: contracts.TaskEscrow as `0x${string}`,
      abi: TaskEscrowABI,
      functionName: "disputeTask",
      args: [taskId],
    });
  };

  return {
    disputeTask,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

export function useTaskEscrowOwner() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  const { data: owner, isLoading, refetch } = useReadContract({
    address: contracts.TaskEscrow as `0x${string}`,
    abi: TaskEscrowABI,
    functionName: "owner",
  });

  return {
    owner: owner as `0x${string}` | undefined,
    isLoading,
    refetch,
  };
}

export function useResolveDispute() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const resolveDispute = (taskId: bigint, workerWins: boolean) => {
    writeContract({
      address: contracts.TaskEscrow as `0x${string}`,
      abi: TaskEscrowABI,
      functionName: "resolveDispute",
      args: [taskId, workerWins],
    });
  };

  return {
    resolveDispute,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

export function useWatchTasks(onNewTask?: (taskId: number) => void) {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  useWatchContractEvent({
    address: contracts.TaskEscrow as `0x${string}`,
    abi: TaskEscrowABI,
    eventName: "TaskCreated",
    onLogs(logs) {
      for (const log of logs) {
        const taskId = Number((log as unknown as { args: { taskId: bigint } }).args.taskId);
        onNewTask?.(taskId);
      }
    },
  });
}
