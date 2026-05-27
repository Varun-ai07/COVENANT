import { keccak256, toBytes, type Address, type Hash } from "viem";
import { CovenantSDK } from "./index.js";
import { getV2ContractAddresses } from "./config.js";
import { InsurancePoolABI } from "./contracts/InsurancePool.js";
import { DisputeResolutionABI } from "./contracts/DisputeResolution.js";
import { ReceiptVerifierV2ABI } from "./contracts/ReceiptVerifierV2.js";
import type {
  CovenantConfigV2,
  V2ContractAddresses,
  ReceiptType,
  ReceiptDataV2,
  InsuranceClaimData,
  MemberInfo,
  DisputeData,
} from "./types.js";

/**
 * COVENANT SDK V2 — extends CovenantSDK with v2 contract methods.
 *
 * Adds support for InsurancePool, DisputeResolution, and ReceiptVerifier v2.
 * All v1 methods remain available through inheritance.
 *
 * @example
 * ```typescript
 * import { CovenantSDKV2 } from "@covenant/sdk/v2";
 *
 * const sdk = new CovenantSDKV2({
 *   version: "v2",
 *   chainId: 84532,
 *   publicClient: client,
 *   walletClient: wallet,
 * });
 *
 * // V2 methods
 * await sdk.joinInsurancePool(parseEther("0.01"));
 * const receipt = await sdk.createReceiptV2(issuer, counterparty, 0, dataHash);
 * ```
 */
export class CovenantSDKV2 extends CovenantSDK {
  private v2Addresses: V2ContractAddresses;

  constructor(config: CovenantConfigV2) {
    super(config);
    this.v2Addresses = getV2ContractAddresses(
      config.chainId,
      config.v2ContractAddresses
    );
  }

  // =========================================================================
  // Insurance Pool Methods
  // =========================================================================

  /**
   * Join the insurance pool by contributing ETH
   */
  async joinInsurancePool(contribution: bigint): Promise<Hash> {
    this.requireWallet();

    return await this.walletClient!.writeContract({
      address: this.v2Addresses.InsurancePool,
      abi: InsurancePoolABI,
      functionName: "joinPool",
      value: contribution,
      chain: this.chain,
      account: this.account!,
    });
  }

  /**
   * File an insurance claim for a failed task
   */
  async fileClaim(taskId: bigint, amount: bigint): Promise<Hash> {
    this.requireWallet();

    return await this.walletClient!.writeContract({
      address: this.v2Addresses.InsurancePool,
      abi: InsurancePoolABI,
      functionName: "fileClaim",
      args: [taskId, amount],
      chain: this.chain,
      account: this.account!,
    });
  }

  /**
   * Get insurance claim details
   */
  async getClaim(claimId: bigint): Promise<InsuranceClaimData> {
    const result = await this.publicClient.readContract({
      address: this.v2Addresses.InsurancePool,
      abi: InsurancePoolABI,
      functionName: "getClaim",
      args: [claimId],
    });
    const data = result as unknown as Record<string, unknown>;
    return {
      claimant: data.claimant as Address,
      taskId: data.taskId as bigint,
      amount: data.amount as bigint,
      paid: data.paid as boolean,
      timestamp: data.timestamp as bigint,
    };
  }

  /**
   * Get the current balance of the insurance pool
   */
  async getPoolBalance(): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.v2Addresses.InsurancePool,
      abi: InsurancePoolABI,
      functionName: "getPoolBalance",
    }) as bigint;
  }

  /**
   * Get insurance membership info for an agent
   */
  async getMemberInfo(member: Address): Promise<MemberInfo> {
    const result = await this.publicClient.readContract({
      address: this.v2Addresses.InsurancePool,
      abi: InsurancePoolABI,
      functionName: "getMemberInfo",
      args: [member],
    });
    const tuple = result as unknown as readonly unknown[];
    return {
      active: tuple[0] as boolean,
      contributed: tuple[1] as bigint,
    };
  }

  // =========================================================================
  // Dispute Resolution Methods
  // =========================================================================

  /**
   * File a formal dispute on a task (requires bond in ETH)
   */
  async fileDispute(taskId: bigint, bond: bigint): Promise<Hash> {
    this.requireWallet();

    return await this.walletClient!.writeContract({
      address: this.v2Addresses.DisputeResolution,
      abi: DisputeResolutionABI,
      functionName: "fileDispute",
      args: [taskId],
      value: bond,
      chain: this.chain,
      account: this.account!,
    });
  }

  /**
   * Resolve a dispute (arbiter-only). Sets winner and worker share.
   */
  async resolveDispute(
    disputeId: bigint,
    workerWins: boolean,
    workerShare: bigint
  ): Promise<Hash> {
    this.requireWallet();

    return await this.walletClient!.writeContract({
      address: this.v2Addresses.DisputeResolution,
      abi: DisputeResolutionABI,
      functionName: "resolveDispute",
      args: [disputeId, workerWins, workerShare],
      chain: this.chain,
      account: this.account!,
    });
  }

  /**
   * Get dispute details
   */
  async getDispute(disputeId: bigint): Promise<DisputeData> {
    const result = await this.publicClient.readContract({
      address: this.v2Addresses.DisputeResolution,
      abi: DisputeResolutionABI,
      functionName: "getDispute",
      args: [disputeId],
    });
    const data = result as unknown as Record<string, unknown>;
    return {
      taskId: data.taskId as bigint,
      filedBy: data.filedBy as Address,
      bondAmount: data.bondAmount as bigint,
      votingEndsAt: data.votingEndsAt as bigint,
      resolved: data.resolved as boolean,
      workerWins: data.workerWins as boolean,
      workerShare: data.workerShare as bigint,
    };
  }

  // =========================================================================
  // Receipt Verifier V2 Methods
  // =========================================================================

  /**
   * Create an ERC-8004 attestation receipt with enum type
   */
  async createReceiptV2(
    issuer: Address,
    counterparty: Address,
    receiptType: ReceiptType,
    dataHash: `0x${string}`
  ): Promise<Hash> {
    this.requireWallet();

    return await this.walletClient!.writeContract({
      address: this.v2Addresses.ReceiptVerifier,
      abi: ReceiptVerifierV2ABI,
      functionName: "createReceipt",
      args: [issuer, counterparty, receiptType, dataHash],
      chain: this.chain,
      account: this.account!,
    });
  }

  /**
   * Verify a single receipt by its bytes32 ID
   */
  async verifyReceipt(receiptId: `0x${string}`): Promise<boolean> {
    return await this.publicClient.readContract({
      address: this.v2Addresses.ReceiptVerifier,
      abi: ReceiptVerifierV2ABI,
      functionName: "verifyReceipt",
      args: [receiptId],
    }) as boolean;
  }

  /**
   * Batch verify multiple receipts by their bytes32 IDs
   */
  async batchVerifyReceipts(receiptIds: `0x${string}`[]): Promise<boolean[]> {
    return await this.publicClient.readContract({
      address: this.v2Addresses.ReceiptVerifier,
      abi: ReceiptVerifierV2ABI,
      functionName: "batchVerifyReceipts",
      args: [receiptIds],
    }) as boolean[];
  }

  /**
   * Get full receipt details by bytes32 ID
   */
  async getReceiptV2(receiptId: `0x${string}`): Promise<ReceiptDataV2> {
    const result = await this.publicClient.readContract({
      address: this.v2Addresses.ReceiptVerifier,
      abi: ReceiptVerifierV2ABI,
      functionName: "getReceipt",
      args: [receiptId],
    });
    const data = result as unknown as Record<string, unknown>;
    return {
      receiptId: data.receiptId as `0x${string}`,
      issuer: data.issuer as Address,
      counterparty: data.counterparty as Address,
      receiptType: data.receiptType as ReceiptType,
      dataHash: data.dataHash as `0x${string}`,
      timestamp: data.timestamp as bigint,
      isValid: data.isValid as boolean,
    };
  }

  // =========================================================================
  // V2 Utility Methods
  // =========================================================================

  /**
   * Get v2 contract addresses being used
   */
  getV2Addresses(): V2ContractAddresses {
    return { ...this.v2Addresses };
  }
}

// ============================================================================
// Bytes32 Utility (standalone export)
// ============================================================================

/**
 * Convert a string (IPFS CID, capability string, etc.) to a bytes32 hash.
 * Uses keccak256 for deterministic hashing.
 *
 * @param input - The string to convert
 * @returns The bytes32 hex string (0x-prefixed, 66 chars)
 *
 * @example
 * ```typescript
 * import { toBytes32 } from "@covenant/sdk/v2";
 *
 * const hash = toBytes32("QmYwAPJzv5CZsnN625s3XfREM3zN1"); // IPFS CID
 * const cap = toBytes32("data-analysis"); // capability string
 * ```
 */
export function toBytes32(input: string): `0x${string}` {
  if (input.startsWith("0x") && input.length === 66) {
    return input as `0x${string}`;
  }
  return keccak256(toBytes(input));
}

// Re-export v2 types for convenience
export type {
  CovenantConfigV2,
  V2ContractAddresses,
  ReceiptDataV2,
  InsuranceClaimData,
  MemberInfo,
  DisputeData,
} from "./types.js";
export { ReceiptType } from "./types.js";
