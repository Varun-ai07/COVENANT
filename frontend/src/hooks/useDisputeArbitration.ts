"use client";

import { useReadContract, useWriteContract, useChainId } from "wagmi";
import { getContractAddresses } from "@/config/contracts";
import type { Address } from "viem";
import DisputeArbitrationABI from "@/contracts/DisputeArbitration.json";

export interface DisputeData {
  disputeId: bigint;
  challenger: Address;
  client: Address;
  taskId: bigint;
  resolved: boolean;
  taskCancelled: bigint;
  forVotes: bigint;
  againstVotes: bigint;
  deadline: bigint;
}

export function useDispute(disputeId?: string | number) {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  const result = useReadContract({
    address: contracts.DisputeArbitration as Address,
    abi: DisputeArbitrationABI.abi as any,
    functionName: "getDispute",
    args: disputeId !== undefined ? [BigInt(disputeId)] : undefined,
    query: { enabled: disputeId !== undefined && contracts.DisputeArbitration !== "0x0000000000000000000000000000000000000000" },
  });

  const raw = result.data as any[] | undefined;
  const data: DisputeData | undefined = raw
    ? {
        disputeId: raw[0],
        challenger: raw[1],
        client: raw[2],
        taskId: raw[3],
        resolved: raw[4],
        taskCancelled: raw[5],
        forVotes: raw[6],
        againstVotes: raw[7],
        deadline: raw[8],
      }
    : undefined;

  return { ...result, data };
}

export function useDisputeCounter() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  const result = useReadContract({
    address: contracts.DisputeArbitration as Address,
    abi: DisputeArbitrationABI.abi as any,
    functionName: "disputeCounter",
    query: { enabled: contracts.DisputeArbitration !== "0x0000000000000000000000000000000000000000" },
  });

  return { count: result.data as bigint | undefined, ...result };
}

export function useDisputeTask() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, isPending, data: hash, error } = useWriteContract();

  const disputeTask = (taskId: bigint) => {
    writeContract({
      address: contracts.DisputeArbitration as Address,
      abi: DisputeArbitrationABI.abi as any,
      functionName: "disputeTask",
      args: [taskId],
    });
  };

  return { disputeTask, isPending, hash, error };
}

export function useCastDisputeVote() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, isPending, data: hash, error } = useWriteContract();

  const castVote = (disputeId: bigint, support: boolean) => {
    writeContract({
      address: contracts.DisputeArbitration as Address,
      abi: DisputeArbitrationABI.abi as any,
      functionName: "castVote",
      args: [disputeId, support],
    });
  };

  return { castVote, isPending, hash, error };
}
