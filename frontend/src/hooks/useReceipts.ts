"use client";

import { useReadContract } from "wagmi";
import { useChainId } from "wagmi";
import ReceiptVerifierABI from "@/contracts/ReceiptVerifier.json";
import { getContractAddresses, isDeployed } from "@/config/contracts";
import type { Address } from "viem";

export interface ReceiptData {
  receiptId: `0x${string}`;
  issuer: Address;
  counterparty: Address;
  interactionType: string;
  dataHash: `0x${string}`;
  timestamp: bigint;
  blockNumber: bigint;
  isValid: boolean;
}

export function useAgentReceipts(agentAddress?: Address) {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  return useReadContract({
    address: contracts.ReceiptVerifier as Address,
    abi: ReceiptVerifierABI as any,
    functionName: "getReceiptsByAgent",
    args: [agentAddress as Address],
    query: {
      enabled: !!agentAddress,
    },
  });
}

export function useReceipt(receiptId?: `0x${string}` | string) {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  return useReadContract({
    address: contracts.ReceiptVerifier as Address,
    abi: ReceiptVerifierABI as any,
    functionName: "verifyReceipt",
    args: [receiptId as `0x${string}`],
    query: {
      enabled: !!receiptId,
    },
  });
}

export function useReceiptCount() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  return useReadContract({
    address: contracts.ReceiptVerifier as Address,
    abi: ReceiptVerifierABI as any,
    functionName: "receiptCount",
    query: { enabled: isDeployed(contracts.ReceiptVerifier) },
  });
}

export function useAgentReceiptCount(agentAddress?: Address) {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  return useReadContract({
    address: contracts.ReceiptVerifier as Address,
    abi: ReceiptVerifierABI as any,
    functionName: "getAgentReceiptCount",
    args: [agentAddress as Address],
    query: {
      enabled: !!agentAddress,
    },
  });
}
