"use client";

import { useReadContract, useWriteContract, useChainId } from "wagmi";
import { getContractAddresses } from "@/config/contracts";
import type { Address } from "viem";
import CapabilityVerifierABI from "@/contracts/CapabilityVerifier.json";

export function useIsAuthorizedIssuer(address?: Address) {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  const result = useReadContract({
    address: contracts.CapabilityVerifier as Address,
    abi: CapabilityVerifierABI.abi as any,
    functionName: "authorizedIssuers",
    args: address ? [address] : undefined,
    query: { enabled: !!address && contracts.CapabilityVerifier !== "0x0000000000000000000000000000000000000000" },
  });

  return { isAuthorized: result.data as boolean | undefined, ...result };
}

export function useAddAuthorizedIssuer() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, isPending, data: hash, error } = useWriteContract();

  const addIssuer = (issuer: Address) => {
    writeContract({
      address: contracts.CapabilityVerifier as Address,
      abi: CapabilityVerifierABI.abi as any,
      functionName: "addAuthorizedIssuer",
      args: [issuer],
    });
  };

  return { addIssuer, isPending, hash, error };
}

export function useRemoveAuthorizedIssuer() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, isPending, data: hash, error } = useWriteContract();

  const removeIssuer = (issuer: Address) => {
    writeContract({
      address: contracts.CapabilityVerifier as Address,
      abi: CapabilityVerifierABI.abi as any,
      functionName: "removeAuthorizedIssuer",
      args: [issuer],
    });
  };

  return { removeIssuer, isPending, hash, error };
}

export function useVerifyCapabilityProof() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, isPending, data: hash, error } = useWriteContract();

  const verifyProof = (
    pA: [bigint, bigint],
    pB: [[bigint, bigint], [bigint, bigint]],
    pC: [bigint, bigint],
    pubSignals: [bigint, bigint, bigint, bigint, bigint]
  ) => {
    writeContract({
      address: contracts.CapabilityVerifier as Address,
      abi: CapabilityVerifierABI.abi as any,
      functionName: "verifyCapabilityProof",
      args: [pA, pB, pC, pubSignals],
    });
  };

  return { verifyProof, isPending, hash, error };
}
