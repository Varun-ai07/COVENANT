"use client";

import { useReadContract, useWriteContract, useChainId } from "wagmi";
import { getContractAddresses } from "@/config/contracts";
import type { Address } from "viem";
import AgentInsuranceABI from "@/contracts/AgentInsurance.json";

export interface MemberInfo {
  isMember: boolean;
  stake: bigint;
  premiumPaid: bigint;
}

export interface ClaimData {
  claimId: bigint;
  claimant: Address;
  taskId: bigint;
  amount: bigint;
  approved: boolean;
  paid: boolean;
  forVotes: bigint;
  againstVotes: bigint;
  voteDeadline: bigint;
  votersCount: bigint;
}

export function useInsurancePoolBalance() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  const result = useReadContract({
    address: contracts.AgentInsurance as Address,
    abi: AgentInsuranceABI.abi as any,
    functionName: "getPoolBalance",
    query: { enabled: contracts.AgentInsurance !== "0x0000000000000000000000000000000000000000" },
  });

  return { balance: result.data as bigint | undefined, ...result };
}

export function useInsuranceMemberInfo(address?: Address) {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  const result = useReadContract({
    address: contracts.AgentInsurance as Address,
    abi: AgentInsuranceABI.abi as any,
    functionName: "getMemberInfo",
    args: address ? [address] : undefined,
    query: { enabled: !!address && contracts.AgentInsurance !== "0x0000000000000000000000000000000000000000" },
  });

  const raw = result.data as any[] | undefined;
  const data: MemberInfo | undefined = raw
    ? { isMember: raw[0], stake: raw[1], premiumPaid: raw[2] }
    : undefined;

  return { ...result, data };
}

export function useInsuranceClaim(claimId?: string | number) {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  const result = useReadContract({
    address: contracts.AgentInsurance as Address,
    abi: AgentInsuranceABI.abi as any,
    functionName: "getClaim",
    args: claimId !== undefined ? [BigInt(claimId)] : undefined,
    query: { enabled: claimId !== undefined && contracts.AgentInsurance !== "0x0000000000000000000000000000000000000000" },
  });

  const raw = result.data as any[] | undefined;
  const data: ClaimData | undefined = raw
    ? {
        claimId: raw[0],
        claimant: raw[1],
        taskId: raw[2],
        amount: raw[3],
        approved: raw[4],
        paid: raw[5],
        forVotes: raw[6],
        againstVotes: raw[7],
        voteDeadline: raw[8],
        votersCount: raw[9],
      }
    : undefined;

  return { ...result, data };
}

export function useInsuranceClaimCount() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  const result = useReadContract({
    address: contracts.AgentInsurance as Address,
    abi: AgentInsuranceABI.abi as any,
    functionName: "getClaimCount",
    query: { enabled: contracts.AgentInsurance !== "0x0000000000000000000000000000000000000000" },
  });

  return { count: result.data as bigint | undefined, ...result };
}

export function useInsuranceMemberCount() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  const result = useReadContract({
    address: contracts.AgentInsurance as Address,
    abi: AgentInsuranceABI.abi as any,
    functionName: "memberCount",
    query: { enabled: contracts.AgentInsurance !== "0x0000000000000000000000000000000000000000" },
  });

  return { count: result.data as bigint | undefined, ...result };
}

export function useJoinInsurancePool() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, isPending, data: hash, error } = useWriteContract();

  const joinPool = () => {
    writeContract({
      address: contracts.AgentInsurance as Address,
      abi: AgentInsuranceABI.abi as any,
      functionName: "joinPool",
    });
  };

  return { joinPool, isPending, hash, error };
}

export function usePayPremium() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, isPending, data: hash, error } = useWriteContract();

  const payPremium = (taskId: bigint) => {
    writeContract({
      address: contracts.AgentInsurance as Address,
      abi: AgentInsuranceABI.abi as any,
      functionName: "payPremium",
      args: [taskId],
    });
  };

  return { payPremium, isPending, hash, error };
}

export function useClaimInsurance() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, isPending, data: hash, error } = useWriteContract();

  const claimInsurance = (taskId: bigint) => {
    writeContract({
      address: contracts.AgentInsurance as Address,
      abi: AgentInsuranceABI.abi as any,
      functionName: "claimInsurance",
      args: [taskId],
    });
  };

  return { claimInsurance, isPending, hash, error };
}

export function useVoteOnClaim() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, isPending, data: hash, error } = useWriteContract();

  const voteOnClaim = (claimId: bigint, support: boolean) => {
    writeContract({
      address: contracts.AgentInsurance as Address,
      abi: AgentInsuranceABI.abi as any,
      functionName: "voteOnClaim",
      args: [claimId, support],
    });
  };

  return { voteOnClaim, isPending, hash, error };
}

export function useWithdrawInsurance() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, isPending, data: hash, error } = useWriteContract();

  const withdraw = () => {
    writeContract({
      address: contracts.AgentInsurance as Address,
      abi: AgentInsuranceABI.abi as any,
      functionName: "withdraw",
    });
  };

  return { withdraw, isPending, hash, error };
}
