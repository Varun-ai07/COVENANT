"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent } from "wagmi";
import { parseEther, formatEther } from "viem";
import { getContractAddresses } from "@/contracts/addresses";
import TaskEscrowABI from "@/contracts/TaskEscrow.json";

export function useGetSubmittedTasks() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  const { data: taskIds, isLoading, refetch } = useReadContract({
    address: contracts.TaskEscrow as `0x${string}`,
    abi: TaskEscrowABI,
    functionName: "getSubmittedTasks",
  });

  return {
    submittedTaskIds: (taskIds as bigint[]) || [],
    isLoading,
    refetch,
  };
}

export function useRegisterVerifier() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const registerVerifier = (stakeAmount: string) => {
    const stakeWei = parseEther(stakeAmount);
    writeContract({
      address: contracts.TaskEscrow as `0x${string}`,
      abi: TaskEscrowABI,
      functionName: "registerVerifier",
      value: stakeWei,
    });
  };

  return {
    registerVerifier,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

export function useVerifierStake(accountAddress: `0x${string}` | undefined) {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  const { data: stakeAmount, isLoading } = useReadContract({
    address: contracts.TaskEscrow as `0x${string}`,
    abi: TaskEscrowABI,
    functionName: "verifierStakes",
    args: accountAddress ? [accountAddress] : undefined,
    query: { enabled: !!accountAddress },
  });

  return {
    verifierStake: stakeAmount ? formatEther(stakeAmount) : "0",
    isLoading,
  };
}

export function useIsRegisteredVerifier(accountAddress: `0x${string}` | undefined) {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  const { data: isRegistered, isLoading } = useReadContract({
    address: contracts.TaskEscrow as `0x${string}`,
    abi: TaskEscrowABI,
    functionName: "isRegisteredVerifier",
    args: accountAddress ? [accountAddress] : undefined,
    query: { enabled: !!accountAddress },
  });

  return {
    isRegisteredVerifier: isRegistered ?? false,
    isLoading,
  };
}

export function useTotalVerifierStake() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  const { data: totalStake, isLoading } = useReadContract({
    address: contracts.TaskEscrow as `0x${string}`,
    abi: TaskEscrowABI,
    functionName: "totalVerifierStake",
  });

  return {
    totalVerifierStake: totalStake ? formatEther(totalStake) : "0",
    isLoading,
  };
}

export function useCreateVerificationReceipt() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createVerificationReceipt = (
    taskId: bigint,
    success: boolean,
    score: number,
    feedback: string
  ) => {
    writeContract({
      address: contracts.TaskEscrow as `0x${string}`,
      abi: TaskEscrowABI,
      functionName: "createVerificationReceipt",
      args: [taskId, success, BigInt(score), feedback],
    });
  };

  return {
    createVerificationReceipt,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

export function useStakeOnVerification() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const stakeOnVerification = (
    taskId: bigint,
    verifierDecision: boolean,
    stakeAmount: string
  ) => {
    const stakeWei = parseEther(stakeAmount);
    writeContract({
      address: contracts.TaskEscrow as `0x${string}`,
      abi: TaskEscrowABI,
      functionName: "stakeOnVerification",
      args: [taskId, verifierDecision],
      value: stakeWei,
    });
  };

  return {
    stakeOnVerification,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

export function useChallengeVerification() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const challengeVerification = (
    taskId: bigint,
    evidence: string
  ) => {
    writeContract({
      address: contracts.TaskEscrow as `0x${string}`,
      abi: TaskEscrowABI,
      functionName: "challengeVerification",
      args: [taskId, evidence],
    });
  };

  return {
    challengeVerification,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

export function useWatchVerificationEvents(onNewVerification?: (taskId: number) => void) {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  useWatchContractEvent({
    address: contracts.TaskEscrow as `0x${string}`,
    abi: TaskEscrowABI,
    eventName: "VerificationReceiptCreated",
    onLogs(logs) {
      for (const log of logs) {
        const taskId = Number((log as unknown as { args: { taskId: bigint } }).args.taskId);
        onNewVerification?.(taskId);
      }
    },
  });
}

export function useWatchVerifierStakes(onStakeUpdate?: (address: string, amount: string) => void) {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  useWatchContractEvent({
    address: contracts.TaskEscrow as `0x${string}`,
    abi: TaskEscrowABI,
    eventName: "VerifierStaked",
    onLogs(logs) {
      for (const log of logs) {
        const verifier = (log as unknown as { args: { verifier: `0x${string}` } }).args.verifier;
        const amount = formatEther((log as unknown as { args: { amountStaked: bigint } }).args.amountStaked);
        onStakeUpdate?.(verifier, amount);
      }
    },
  });
}

export function useWatchVerificationChallenges(onChallenge?: (taskId: number, challenger: string) => void) {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  useWatchContractEvent({
    address: contracts.TaskEscrow as `0x${string}`,
    abi: TaskEscrowABI,
    eventName: "VerificationChallenged",
    onLogs(logs) {
      for (const log of logs) {
        const taskId = Number((log as unknown as { args: { taskId: bigint } }).args.taskId);
        const challenger = (log as unknown as { args: { challenger: `0x${string}` } }).args.challenger;
        onChallenge?.(taskId, challenger);
      }
    },
  });
}