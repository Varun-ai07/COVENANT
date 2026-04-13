"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { getContractAddresses } from "@/contracts/addresses";
import DisputeArbitrationABI from "@/contracts/DisputeArbitration.json";
import { useToast } from "@/components/Toast";

export interface Dispute {
  disputeId: bigint;
  taskId: bigint;
  challenger: string;
  worker: string;
  client: string;
  challengerBond: bigint;
  workerBond: bigint;
  status: number; // 0=Active, 1=Resolved
  createdAt: bigint;
  votesForChallenger: number;
  votesForWorker: number;
  jurorsVoted: number;
}

export interface Juror {
  address: string;
  reputation: number;
  stake: bigint;
}

export function useDisputeArbitration() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);
  const { addToast } = useToast();

  // Read: Dispute counter
  const { data: disputeCounter, refetch: refetchDisputeCounter } = useReadContract({
    address: contracts.DisputeArbitration as `0x${string}`,
    abi: DisputeArbitrationABI,
    functionName: "disputeCounter",
  });

  // Read: Get dispute details
  const useDispute = (disputeId: bigint | undefined) => {
    const { data: disputeData, isLoading, refetch } = useReadContract({
      address: contracts.DisputeArbitration as `0x${string}`,
      abi: DisputeArbitrationABI,
      functionName: "getDispute",
      args: disputeId !== undefined ? [disputeId] : undefined,
      query: { enabled: disputeId !== undefined },
    });

    const parseDispute = (data: any): Dispute => ({
      disputeId: data[0] || disputeId,
      taskId: data[1],
      challenger: data[2],
      worker: data[3],
      client: data[4],
      challengerBond: data[5],
      workerBond: data[6],
      status: Number(data[7]),
      createdAt: data[8],
      votesForChallenger: Number(data[9]),
      votesForWorker: Number(data[10]),
      jurorsVoted: Number(data[11]),
    });

    return {
      dispute: disputeData ? parseDispute(disputeData) : undefined,
      isLoading,
      refetch,
    };
  };

  // Read: Get active disputes for user (as challenger, worker, or client)
  const useMyDisputes = (userAddress: string | undefined) => {
    const { data: disputeIds, isLoading, refetch } = useReadContract({
      address: contracts.DisputeArbitration as `0x${string}`,
      abi: DisputeArbitrationABI,
      functionName: "getDisputesForUser",
      args: userAddress ? [userAddress] : undefined,
      query: { enabled: !!userAddress },
    });

    return {
      disputeIds: (disputeIds as bigint[]) || [],
      isLoading,
      refetch,
    };
  };

  // Read: Get jury for a dispute
  const useJury = (disputeId: bigint | undefined) => {
    const { data: juryData, isLoading, refetch } = useReadContract({
      address: contracts.DisputeArbitration as `0x${string}`,
      abi: DisputeArbitrationABI,
      functionName: "getJury",
      args: disputeId !== undefined ? [disputeId] : undefined,
      query: { enabled: disputeId !== undefined },
    });

    // Returns array of juror addresses
    return {
      jury: (juryData as string[]) || [],
      isLoading,
      refetch,
    };
  };

  // Read: Get juror info
  const useJurorInfo = (jurorAddress: string | undefined) => {
    const { data: jurorData, isLoading } = useReadContract({
      address: contracts.DisputeArbitration as `0x${string}`,
      abi: DisputeArbitrationABI,
      functionName: "getJurorInfo",
      args: jurorAddress ? [jurorAddress] : undefined,
      query: { enabled: !!jurorAddress },
    });

    return {
      juror: jurorData ? {
        address: jurorAddress,
        reputation: Number(jurorData[0]),
        stake: jurorData[1],
        isActive: jurorData[2],
      } : undefined,
      isLoading,
    };
  };

  // Write: Create dispute (challenge task verification)
  const { writeContract: writeCreateDispute, data: disputeHash, isPending: isCreating, error: createError } = useWriteContract();
  const { isLoading: isConfirmingCreate, isSuccess: isCreateSuccess } = useWaitForTransactionReceipt({ hash: disputeHash });

  const createDispute = (taskId: bigint) => {
    writeCreateDispute({
      address: contracts.DisputeArbitration as `0x${string}`,
      abi: DisputeArbitrationABI,
      functionName: "createDispute",
      args: [taskId],
    });
    addToast({ type: "info", title: "Creating Dispute", message: "Submitting dispute to arbitration..." });
  };

  // Write: Cast vote as juror
  const { writeContract: writeVote, data: voteHash, isPending: isVoting, error: voteError } = useWriteContract();
  const { isLoading: isConfirmingVote, isSuccess: isVoteSuccess } = useWaitForTransactionReceipt({ hash: voteHash });

  const castVote = (disputeId: bigint, voteForChallenger: boolean) => {
    writeVote({
      address: contracts.DisputeArbitration as `0x${string}`,
      abi: DisputeArbitrationABI,
      functionName: "vote",
      args: [disputeId, voteForChallenger],
    });
    addToast({ type: "info", title: "Vote Cast", message: voteForChallenger ? "Voting for challenger" : "Voting for worker" });
  };

  // Write: Withdraw dispute bond (after dispute resolved)
  const { writeContract: writeWithdrawBond, data: withdrawHash, isPending: isWithdrawing, error: withdrawError } = useWriteContract();
  const { isLoading: isConfirmingWithdraw, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawHash });

  const withdrawBond = (disputeId: bigint) => {
    writeWithdrawBond({
      address: contracts.DisputeArbitration as `0x${string}`,
      abi: DisputeArbitrationABI,
      functionName: "withdrawDisputeBond",
      args: [disputeId],
    });
  };

  // Events
  const { useWatchContractEvent } = require("wagmi");

  const useWatchDisputeCreated = (onDisputeCreated?: (disputeId: number) => void) => {
    useWatchContractEvent({
      address: contracts.DisputeArbitration as `0x${string}`,
      abi: DisputeArbitrationABI,
      eventName: "DisputeCreated",
      onLogs(logs) {
        for (const log of logs as any[]) {
          const args = log.args as { disputeId: bigint };
          onDisputeCreated?.(Number(args.disputeId));
        }
      },
    });
  };

  const useWatchVoteCast = (onVoteCast?: (disputeId: number, juror: string) => void) => {
    useWatchContractEvent({
      address: contracts.DisputeArbitration as `0x${string}`,
      abi: DisputeArbitrationABI,
      eventName: "VoteCast",
      onLogs(logs) {
        for (const log of logs as any[]) {
          const args = log.args as { disputeId: bigint; juror: string };
          onVoteCast?.(Number(args.disputeId), args.juror);
        }
      },
    });
  };

  const useWatchDisputeResolved = (onDisputeResolved?: (disputeId: number, winner: string) => void) => {
    useWatchContractEvent({
      address: contracts.DisputeArbitration as `0x${string}`,
      abi: DisputeArbitrationABI,
      eventName: "DisputeResolved",
      onLogs(logs) {
        for (const log of logs as any[]) {
          const args = log.args as { disputeId: bigint; winner: string };
          onDisputeResolved?.(Number(args.disputeId), args.winner);
        }
      },
    });
  };

  return {
    // State
    disputeCounter,
    useDispute,
    useMyDisputes,
    useJury,
    useJurorInfo,
    // Mutations
    createDispute,
    castVote,
    withdrawBond,
    // Status
    isCreating,
    isConfirmingCreate,
    isCreateSuccess,
    createError,
    isVoting,
    isConfirmingVote,
    isVoteSuccess,
    voteError,
    isWithdrawing,
    isConfirmingWithdraw,
    isWithdrawSuccess,
    withdrawError,
    // Events
    useWatchDisputeCreated,
    useWatchVoteCast,
    useWatchDisputeResolved,
  };
}
