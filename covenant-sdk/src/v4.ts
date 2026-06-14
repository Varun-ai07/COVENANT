import { type Address, type Hash } from "viem";
import { CovenantSDK } from "./index.js";
import { getV4ContractAddresses } from "./config.js";
import { CovenantIdentityABI } from "./contracts/CovenantIdentity.js";
import { CovenantEscrowABI } from "./contracts/CovenantEscrow.js";
import { CovenantSettlementABI } from "./contracts/CovenantSettlement.js";
import { CovenantArbitrationABI } from "./contracts/CovenantArbitration.js";
import { CovenantGovernanceABI } from "./contracts/CovenantGovernance.js";
import { CovenantAttestationABI } from "./contracts/CovenantAttestation.js";
import type {
  V4Config,
  V4ContractAddresses,
} from "./types.js";

export class CovenantSDKV4 extends CovenantSDK {
  private v4Addresses: V4ContractAddresses;

  constructor(config: V4Config) {
    super(config);
    this.v4Addresses = getV4ContractAddresses(
      config.chainId,
      config.v4ContractAddresses
    );
  }

  // =========================================================================
  // Identity Methods
  // =========================================================================

  async getV4Agent(address: Address) {
    return await this.publicClient.readContract({
      address: this.v4Addresses.CovenantIdentity,
      abi: CovenantIdentityABI,
      functionName: "getAgent",
      args: [address],
    });
  }

  async register(stake: bigint, metadataRoot: `0x${string}`): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.v4Addresses.CovenantIdentity,
      abi: CovenantIdentityABI,
      functionName: "register",
      args: [stake, metadataRoot],
      value: stake,
      chain: this.chain,
      account: this.account!,
    });
  }

  async increaseStake(): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.v4Addresses.CovenantIdentity,
      abi: CovenantIdentityABI,
      functionName: "increaseStake",
      chain: this.chain,
      account: this.account!,
    });
  }

  async deactivate(): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.v4Addresses.CovenantIdentity,
      abi: CovenantIdentityABI,
      functionName: "deactivate",
      chain: this.chain,
      account: this.account!,
    });
  }

  async grantCapability(
    agent: Address,
    capabilityHash: `0x${string}`,
    expiry: number,
    valueLimit: bigint
  ): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.v4Addresses.CovenantIdentity,
      abi: CovenantIdentityABI,
      functionName: "grantCapability",
      args: [agent, capabilityHash, expiry, valueLimit],
      chain: this.chain,
      account: this.account!,
    });
  }

  async revokeCapability(
    agent: Address,
    capabilityHash: `0x${string}`
  ): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.v4Addresses.CovenantIdentity,
      abi: CovenantIdentityABI,
      functionName: "revokeCapability",
      args: [agent, capabilityHash],
      chain: this.chain,
      account: this.account!,
    });
  }

  async hasCapability(
    agent: Address,
    capabilityHash: `0x${string}`
  ): Promise<boolean> {
    return await this.publicClient.readContract({
      address: this.v4Addresses.CovenantIdentity,
      abi: CovenantIdentityABI,
      functionName: "hasCapability",
      args: [agent, capabilityHash],
    }) as boolean;
  }

  async getCapability(
    agent: Address,
    capabilityHash: `0x${string}`
  ) {
    return await this.publicClient.readContract({
      address: this.v4Addresses.CovenantIdentity,
      abi: CovenantIdentityABI,
      functionName: "getCapability",
      args: [agent, capabilityHash],
    });
  }

  // =========================================================================
  // Escrow Methods
  // =========================================================================

  async createV4Task(
    worker: Address,
    amount: bigint,
    deadline: number,
    metaHash: `0x${string}`
  ): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.v4Addresses.CovenantEscrow,
      abi: CovenantEscrowABI,
      functionName: "createTask",
      args: [worker, amount, deadline, metaHash],
      value: amount,
      chain: this.chain,
      account: this.account!,
    });
  }

  async fundTask(taskId: bigint): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.v4Addresses.CovenantEscrow,
      abi: CovenantEscrowABI,
      functionName: "fundTask",
      args: [taskId],
      chain: this.chain,
      account: this.account!,
    });
  }

  async submitWorkV4(
    taskId: bigint,
    deliverableHash: `0x${string}`
  ): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.v4Addresses.CovenantEscrow,
      abi: CovenantEscrowABI,
      functionName: "submitWork",
      args: [taskId, deliverableHash],
      chain: this.chain,
      account: this.account!,
    });
  }

  async completeTask(
    taskId: bigint,
    clientSignature: `0x${string}`
  ): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.v4Addresses.CovenantEscrow,
      abi: CovenantEscrowABI,
      functionName: "completeTask",
      args: [taskId, clientSignature],
      chain: this.chain,
      account: this.account!,
    });
  }

  async disputeTaskV4(taskId: bigint): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.v4Addresses.CovenantEscrow,
      abi: CovenantEscrowABI,
      functionName: "disputeTask",
      args: [taskId],
      chain: this.chain,
      account: this.account!,
    });
  }

  async getV4Task(taskId: bigint) {
    return await this.publicClient.readContract({
      address: this.v4Addresses.CovenantEscrow,
      abi: CovenantEscrowABI,
      functionName: "getTask",
      args: [taskId],
    });
  }

  async getV4TaskCount(): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.v4Addresses.CovenantEscrow,
      abi: CovenantEscrowABI,
      functionName: "taskCount",
    }) as bigint;
  }

  // =========================================================================
  // Settlement Methods
  // =========================================================================

  async settleReceipt(
    payer: Address,
    payee: Address,
    amount: bigint,
    nonce: bigint,
    payerSignature: `0x${string}`
  ): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.v4Addresses.CovenantSettlement,
      abi: CovenantSettlementABI,
      functionName: "settleReceipt",
      args: [payer, payee, amount, nonce, payerSignature],
      chain: this.chain,
      account: this.account!,
    });
  }

  async batchSettle(
    payers: Address[],
    payees: Address[],
    amounts: bigint[],
    nonces: bigint[],
    payerSignatures: `0x${string}`[]
  ): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.v4Addresses.CovenantSettlement,
      abi: CovenantSettlementABI,
      functionName: "batchSettleReceipts",
      args: [payers, payees, amounts, nonces, payerSignatures],
      chain: this.chain,
      account: this.account!,
    });
  }

  async getSettlementCount(): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.v4Addresses.CovenantSettlement,
      abi: CovenantSettlementABI,
      functionName: "receiptCount",
    }) as bigint;
  }

  // =========================================================================
  // Arbitration Methods
  // =========================================================================

  async createDispute(
    taskId: bigint,
    evidenceHash: `0x${string}`
  ): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.v4Addresses.CovenantArbitration,
      abi: CovenantArbitrationABI,
      functionName: "createDispute",
      args: [taskId, evidenceHash],
      chain: this.chain,
      account: this.account!,
    });
  }

  async stakeForDispute(disputeId: bigint): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.v4Addresses.CovenantArbitration,
      abi: CovenantArbitrationABI,
      functionName: "stakeForDispute",
      args: [disputeId],
      chain: this.chain,
      account: this.account!,
    });
  }

  async submitRuling(
    disputeId: bigint,
    ruling: number,
    splitBps: number,
    arbiterSignature: `0x${string}`
  ): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.v4Addresses.CovenantArbitration,
      abi: CovenantArbitrationABI,
      functionName: "submitRuling",
      args: [disputeId, ruling, splitBps, arbiterSignature],
      chain: this.chain,
      account: this.account!,
    });
  }

  async settleDispute(disputeId: bigint): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.v4Addresses.CovenantArbitration,
      abi: CovenantArbitrationABI,
      functionName: "settleDispute",
      args: [disputeId],
      chain: this.chain,
      account: this.account!,
    });
  }

  async getDispute(disputeId: bigint) {
    return await this.publicClient.readContract({
      address: this.v4Addresses.CovenantArbitration,
      abi: CovenantArbitrationABI,
      functionName: "getDispute",
      args: [disputeId],
    });
  }

  async getDisputeCount(): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.v4Addresses.CovenantArbitration,
      abi: CovenantArbitrationABI,
      functionName: "disputeCount",
    }) as bigint;
  }

  // =========================================================================
  // Governance Methods
  // =========================================================================

  async createProposal(
    target: Address,
    callData: `0x${string}`,
    descriptionHash: `0x${string}`,
    votingPeriod: number
  ): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.v4Addresses.CovenantGovernance,
      abi: CovenantGovernanceABI,
      functionName: "propose",
      args: [target, callData, descriptionHash, votingPeriod],
      chain: this.chain,
      account: this.account!,
    });
  }

  async castVote(
    proposalId: bigint,
    forVotes: bigint,
    againstVotes: bigint,
    guardianSignature: `0x${string}`
  ): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.v4Addresses.CovenantGovernance,
      abi: CovenantGovernanceABI,
      functionName: "submitVotes",
      args: [proposalId, forVotes, againstVotes, guardianSignature],
      chain: this.chain,
      account: this.account!,
    });
  }

  async executeProposal(proposalId: bigint): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.v4Addresses.CovenantGovernance,
      abi: CovenantGovernanceABI,
      functionName: "executeProposal",
      args: [proposalId],
      chain: this.chain,
      account: this.account!,
    });
  }

  async getProposal(proposalId: bigint) {
    return await this.publicClient.readContract({
      address: this.v4Addresses.CovenantGovernance,
      abi: CovenantGovernanceABI,
      functionName: "getProposal",
      args: [proposalId],
    });
  }

  // =========================================================================
  // Attestation Methods
  // =========================================================================

  async createAttestation(
    subject: Address,
    schemaHash: `0x${string}`,
    dataHash: `0x${string}`,
    expiresAt: number
  ): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.v4Addresses.CovenantAttestation,
      abi: CovenantAttestationABI,
      functionName: "attest",
      args: [subject, schemaHash, dataHash, expiresAt],
      chain: this.chain,
      account: this.account!,
    });
  }

  async verifyAttestation(attestationId: `0x${string}`) {
    return await this.publicClient.readContract({
      address: this.v4Addresses.CovenantAttestation,
      abi: CovenantAttestationABI,
      functionName: "verify",
      args: [attestationId],
    });
  }

  async getAttestation(agent: Address) {
    return await this.publicClient.readContract({
      address: this.v4Addresses.CovenantAttestation,
      abi: CovenantAttestationABI,
      functionName: "getAgentAttestations",
      args: [agent],
    });
  }

  // =========================================================================
  // V4 Utility Methods
  // =========================================================================

  getV4Addresses(): V4ContractAddresses {
    return { ...this.v4Addresses };
  }
}

export type {
  V4Config,
  V4ContractAddresses,
} from "./types.js";
export {
  V4_SEPOLIA_ADDRESSES,
  V4_TASK_STATUS,
  V4_RULING,
} from "@covenant/shared-types";
export type {
  V4AgentIdentity,
  V4Task,
  V4Dispute,
  V4Attestation,
  V4Proposal,
  V4TaskStatus,
  V4Ruling,
} from "@covenant/shared-types";
