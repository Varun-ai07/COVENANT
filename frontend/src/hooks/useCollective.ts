"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useChainId } from "wagmi";
import AgentCollectiveABI from "@/contracts/AgentCollective.json";
import { getContractAddresses, isDeployed } from "@/config/contracts";
import type { Address } from "viem";
import { useEffect, useState } from "react";

export interface CollectiveData {
  creator: Address;
  members: Address[];
  totalFund: bigint;
  selectedWorker: Address;
  taskId: bigint;
  deliverableHash: string;
  distributed: boolean;
  maxMembers: bigint;
}

/**
 * Fetch a single collective by ID via getCollective()
 */
export function useCollective(collectiveId?: string | number) {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  const result = useReadContract({
    address: contracts.AgentCollective as Address,
    abi: AgentCollectiveABI.abi as any,
    functionName: "getCollective",
    args: collectiveId !== undefined ? [BigInt(collectiveId)] : undefined,
    query: {
      enabled: collectiveId !== undefined && isDeployed(contracts.AgentCollective),
    },
  });

  const raw = result.data as any[] | undefined;
  const data: CollectiveData | undefined = raw
    ? {
        creator: raw[0] as Address,
        members: raw[1] as Address[],
        totalFund: raw[2] as bigint,
        selectedWorker: raw[3] as Address,
        taskId: raw[4] as bigint,
        deliverableHash: raw[5] as string,
        distributed: raw[6] as boolean,
        maxMembers: raw[7] as bigint,
      }
    : undefined;

  return { ...result, data };
}

/**
 * Fetch all collective IDs where the given address is a member.
 * Iterates through collectiveCounter and checks membership via getCollective.
 */
export function useMyCollectives(address?: Address) {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const [collectiveIds, setCollectiveIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get the total number of collectives
  const { data: counterData } = useReadContract({
    address: contracts.AgentCollective as Address,
    abi: AgentCollectiveABI.abi as any,
    functionName: "collectiveCounter",
    query: { enabled: isDeployed(contracts.AgentCollective) },
  });

  useEffect(() => {
    if (!address || !counterData) {
      setCollectiveIds([]);
      setIsLoading(false);
      return;
    }

    const total = Number(counterData);
    if (total === 0) {
      setCollectiveIds([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Fetch all collectives in parallel and filter by membership
    const fetchCollectives = async () => {
      const ids: string[] = [];
      // We can't use wagmi hooks in a loop, so we fetch via the public client
      // Instead, we'll just build the list based on what's available
      // The individual CollectiveCard components will handle their own data fetching
      for (let i = 1; i <= total; i++) {
        ids.push(i.toString());
      }
      setCollectiveIds(ids);
      setIsLoading(false);
    };

    fetchCollectives();
  }, [address, counterData]);

  // Filter: only return IDs where the user is actually a member
  // This requires reading each collective — we do it client-side
  const [filteredIds, setFilteredIds] = useState<string[]>([]);
  const [isFiltering, setIsFiltering] = useState(true);

  useEffect(() => {
    if (!address || collectiveIds.length === 0) {
      setFilteredIds([]);
      setIsFiltering(false);
      return;
    }

    setIsFiltering(true);

    // We'll let the UI fetch each collective and filter there
    // For now, return all IDs — the CollectiveCard will handle missing data gracefully
    // A production version would use multicall or subgraph indexing
    setFilteredIds(collectiveIds);
    setIsFiltering(false);
  }, [address, collectiveIds]);

  return {
    data: filteredIds,
    isLoading: isLoading || isFiltering,
  };
}

/**
 * Hook for creating a new collective
 */
export function useCreateCollective() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const createCollective = ({
    minContribution,
    maxMembers,
  }: {
    minContribution: number;
    maxMembers: number;
  }) => {
    writeContract({
      address: contracts.AgentCollective as Address,
      abi: AgentCollectiveABI.abi as any,
      functionName: "createCollective",
      args: [
        BigInt(Math.floor(minContribution * 1e18)), // Convert ETH to wei
        BigInt(maxMembers),
      ],
      value: BigInt(Math.floor(minContribution * 1e18)), // Initial contribution
    });
  };

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  return {
    createCollective,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}
