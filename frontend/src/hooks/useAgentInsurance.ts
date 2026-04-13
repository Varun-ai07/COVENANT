"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import { getContractAddresses } from "@/contracts/addresses";
import AgentInsuranceABI from "@/contracts/AgentInsurance.json";
import { useToast } from "@/components/Toast";

export interface InsurancePool {
  totalPool: bigint;
  totalPremiumsPaid: bigint;
  totalClaimsPaid: bigint;
  reserveRatio: number;
  isActive: boolean;
  minReserveRatio: number;
  claimPeriod: bigint;
  maxClaimAmount: bigint;
}

export interface MemberInfo {
  address: string;
  contribution: bigint;
  isMember: boolean;
  activeTasks: bigint;
  totalPaidPremiums: bigint;
  totalReceivedClaims: bigint;
}

export interface Claim {
  claimId: bigint;
  taskId: bigint;
  claimant: string;
  amount: bigint;
  reason: number; // enum
  isApproved: boolean;
  isPaid: boolean;
  votesFor: number;
  votesAgainst: number;
  createdAt: bigint;
}

export function useAgentInsurance() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);
  const { addToast } = useToast();

  const { address } = useAccount();

  // Read: Pool info
  const { data: poolData, isLoading: poolLoading, refetch: refetchPool } = useReadContract({
    address: contracts.AgentInsurance as `0x${string}`,
    abi: AgentInsuranceABI,
    functionName: "getPoolInfo",
  });

  const pool: InsurancePool | undefined = poolData ? {
    totalPool: poolData[0],
    totalPremiumsPaid: poolData[1],
    totalClaimsPaid: poolData[2],
    reserveRatio: Number(poolData[3]) / 100, // stored as basis points
    isActive: poolData[4],
    minReserveRatio: Number(poolData[5]) / 100,
    claimPeriod: poolData[6],
    maxClaimAmount: poolData[7],
  } : undefined;

  // Read: Member info for connected user
  const { data: memberData, isLoading: memberLoading } = useReadContract({
    address: contracts.AgentInsurance as `0x${string}`,
    abi: AgentInsuranceABI,
    functionName: "getMemberInfo",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const memberInfo: MemberInfo | undefined = memberData ? {
    address: address as string,
    contribution: memberData[0],
    isMember: memberData[1],
    activeTasks: memberData[2],
    totalPaidPremiums: memberData[3],
    totalReceivedClaims: memberData[4],
  } : undefined;

  // Read: All members (for governance)
  const { data: memberAddresses, isLoading: membersLoading, refetch: refetchMembers } = useReadContract({
    address: contracts.AgentInsurance as `0x${string}`,
    abi: AgentInsuranceABI,
    functionName: "getAllMembers",
  });

  // Read: Claims for user
  const { data: claimIds, isLoading: claimsLoading } = useReadContract({
    address: contracts.AgentInsurance as `0x${string}`,
    abi: AgentInsuranceABI,
    functionName: "getClaimsForUser",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const useClaim = (claimId: bigint | undefined) => {
    const { data: claimData, isLoading, refetch } = useReadContract({
      address: contracts.AgentInsurance as `0x${string}`,
      abi: AgentInsuranceABI,
      functionName: "getClaim",
      args: claimId !== undefined ? [claimId] : undefined,
      query: { enabled: claimId !== undefined },
    });

    const parseClaim = (data: any): Claim => ({
      claimId: data[0] || claimId,
      taskId: data[1],
      claimant: data[2],
      amount: data[3],
      reason: Number(data[4]),
      isApproved: data[5],
      isPaid: data[6],
      votesFor: Number(data[7]),
      votesAgainst: Number(data[8]),
      createdAt: data[9],
    });

    return {
      claim: claimData ? parseClaim(claimData) : undefined,
      isLoading,
      refetch,
    };
  };

  // Write: Join pool (become member)
  const { writeContract: writeJoin, data: joinHash, isPending: isJoining, error: joinError } = useWriteContract();
  const { isLoading: isConfirmingJoin, isSuccess: isJoinSuccess } = useWaitForTransactionReceipt({ hash: joinHash });

  const joinPool = (contribution: string) => {
    const contributionWei = parseEther(contribution);
    writeJoin({
      address: contracts.AgentInsurance as `0x${string}`,
      abi: AgentInsuranceABI,
      functionName: "joinPool",
      args: [], // contribution passed as value
      value: contributionWei,
    });
    addToast({ type: "info", title: "Joining Pool", message: `Contributing ${contribution} ETH to insurance pool...` });
  };

  // Write: Pay premium (for active task)
  const { writeContract: writePayPremium, data: premiumHash, isPending: isPayingPremium, error: premiumError } = useWriteContract();
  const { isLoading: isConfirmingPremium, isSuccess: isPremiumSuccess } = useWaitForTransactionReceipt({ hash: premiumHash });

  const payPremium = (taskId: bigint, amount: string) => {
    const amountWei = parseEther(amount);
    writePayPremium({
      address: contracts.AgentInsurance as `0x${string}`,
      abi: AgentInsuranceABI,
      functionName: "payPremium",
      args: [taskId],
      value: amountWei,
    });
    addToast({ type: "info", title: "Premium Paid", message: `Paid premium for task #${taskId}` });
  };

  // Write: Claim insurance (for failed task)
  const { writeContract: writeClaim, data: claimHash, isPending: isClaiming, error: claimError } = useWriteContract();
  const { isLoading: isConfirmingClaim, isSuccess: isClaimSuccess } = useWaitForTransactionReceipt({ hash: claimHash });

  const claimInsurance = (taskId: bigint) => {
    writeClaim({
      address: contracts.AgentInsurance as `0x${string}`,
      abi: AgentInsuranceABI,
      functionName: "claimInsurance",
      args: [taskId],
    });
    addToast({ type: "info", title: "Filing Claim", message: `Submitting insurance claim for task #${taskId}...` });
  };

  // Write: Vote on claim (governance)
  const { writeContract: writeVoteClaim, data: voteClaimHash, isPending: isVotingClaim, error: votingClaimError } = useWriteContract();
  const { isLoading: isConfirmingVoteClaim, isSuccess: isVoteClaimSuccess } = useWaitForTransactionReceipt({ hash: voteClaimHash });

  const voteOnClaim = (claimId: bigint, support: boolean) => {
    writeVoteClaim({
      address: contracts.AgentInsurance as `0x${string}`,
      abi: AgentInsuranceABI,
      functionName: "voteOnClaim",
      args: [claimId, support],
    });
  };

  // Write: Withdraw excess funds (member)
  const { writeContract: writeWithdrawExcess, data: withdrawExcessHash, isPending: isWithdrawingExcess, error: withdrawExcessError } = useWriteContract();
  const { isLoading: isConfirmingWithdrawExcess, isSuccess: isWithdrawExcessSuccess } = useWaitForTransactionReceipt({ hash: withdrawExcessHash });

  const withdrawExcess = (amount: string) => {
    const amountWei = parseEther(amount);
    writeWithdrawExcess({
      address: contracts.AgentInsurance as `0x${string}`,
      abi: AgentInsuranceABI,
      functionName: "withdrawExcess",
      args: [], // amount implicit (all available)
      value: amountWei, // can be 0 to withdraw all available
    });
  };

  // Events
  const { useWatchContractEvent } = require("wagmi");

  const useWatchPremiumPaid = (onPremiumPaid?: (taskId: bigint, member: string, amount: bigint) => void) => {
    useWatchContractEvent({
      address: contracts.AgentInsurance as `0x${string}`,
      abi: AgentInsuranceABI,
      eventName: "PremiumPaid",
      onLogs(logs) {
        for (const log of logs as any[]) {
          const args = log.args as { taskId: bigint; member: string; amount: bigint };
          onPremiumPaid?.(args.taskId, args.member, args.amount);
        }
      },
    });
  };

  const useWatchClaimFiled = (onClaimFiled?: (claimId: bigint, claimant: string, taskId: bigint) => void) => {
    useWatchContractEvent({
      address: contracts.AgentInsurance as `0x${string}`,
      abi: AgentInsuranceABI,
      eventName: "ClaimFiled",
      onLogs(logs) {
        for (const log of logs as any[]) {
          const args = log.args as { claimId: bigint; claimant: string; taskId: bigint };
          onClaimFiled?.(args.claimId, args.claimant, args.taskId);
        }
      },
    });
  };

  const useWatchClaimPaid = (onClaimPaid?: (claimId: bigint, claimant: string, amount: bigint) => void) => {
    useWatchContractEvent({
      address: contracts.AgentInsurance as `0x${string}`,
      abi: AgentInsuranceABI,
      eventName: "ClaimPaid",
      onLogs(logs) {
        for (const log of logs as any[]) {
          const args = log.args as { claimId: bigint; claimant: string; amount: bigint };
          onClaimPaid?.(args.claimId, args.claimant, args.amount);
        }
      },
    });
  };

  return {
    // State
    pool,
    poolLoading,
    refetchPool,
    memberInfo,
    memberLoading,
    memberAddresses: (memberAddresses as string[]) || [],
    membersLoading,
    refetchMembers,
    useClaim,
    // Mutations
    joinPool,
    payPremium,
    claimInsurance,
    voteOnClaim,
    withdrawExcess,
    // Status
    isJoining,
    isConfirmingJoin,
    isJoinSuccess,
    joinError,
    isPayingPremium,
    isConfirmingPremium,
    isPremiumSuccess,
    premiumError,
    isClaiming,
    isConfirmingClaim,
    isClaimSuccess,
    claimError,
    isVotingClaim,
    isConfirmingVoteClaim,
    isVoteClaimSuccess,
    votingClaimError,
    isWithdrawingExcess,
    isConfirmingWithdrawExcess,
    isWithdrawExcessSuccess,
    withdrawExcessError,
    // Events
    useWatchPremiumPaid,
    useWatchClaimFiled,
    useWatchClaimPaid,
  };
}
