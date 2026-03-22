"use client";

import { useAccount, useReadContract } from "wagmi";
import { getContractAddresses } from "@/contracts/addresses";
import ReceiptVerifierABI from "@/contracts/ReceiptVerifier.json";
import { Receipt } from "@/types";

export function useAgentReceipts(agentAddress: `0x${string}` | undefined) {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  const { data: receiptIds, isLoading, refetch } = useReadContract({
    address: contracts.ReceiptVerifier as `0x${string}`,
    abi: ReceiptVerifierABI,
    functionName: "getReceiptsByAgent",
    args: agentAddress ? [agentAddress] : undefined,
    query: { enabled: !!agentAddress },
  });

  return {
    receiptIds: (receiptIds as string[]) || [],
    isLoading,
    refetch,
  };
}

export function useReceipt(receiptId: string | undefined) {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  const { data, isLoading } = useReadContract({
    address: contracts.ReceiptVerifier as `0x${string}`,
    abi: ReceiptVerifierABI,
    functionName: "verifyReceipt",
    args: receiptId ? [receiptId] : undefined,
    query: { enabled: !!receiptId },
  });

  const [isValid, receipt] = (data as [boolean, Receipt]) || [false, undefined];

  return {
    isValid,
    receipt,
    isLoading,
  };
}

export function useReceiptCount() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  const { data: count } = useReadContract({
    address: contracts.ReceiptVerifier as `0x${string}`,
    abi: ReceiptVerifierABI,
    functionName: "receiptCount",
  });

  return count ? Number(count) : 0;
}

export function useAgentReceiptCount(agentAddress: `0x${string}` | undefined) {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  const { data: count } = useReadContract({
    address: contracts.ReceiptVerifier as `0x${string}`,
    abi: ReceiptVerifierABI,
    functionName: "getAgentReceiptCount",
    args: agentAddress ? [agentAddress] : undefined,
    query: { enabled: !!agentAddress },
  });

  return count ? Number(count) : 0;
}
