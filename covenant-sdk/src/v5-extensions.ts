/**
 * COVENANT SDK V5 — Extension methods for all V5 contracts
 *
 * Covers: CovenantSettlement, CovenantArbitration, CovenantAttestation,
 * CovenantGovernance, InsurancePool, TrainingMarketplace, GrantProgram,
 * RevisionManager, ParallelTaskBatch, AgentCollective, MultiTokenEscrow,
 * COVENANTRouter
 */
import type { Address, Hash, PublicClient, WalletClient, Chain, Account } from "viem";
import { getContractAddresses, CHAIN_CONFIGS } from "./config.js";

// V5 ABIs (all functions)
import CovenantSettlementABI from "./contracts/CovenantSettlement.json" with { type: "json" };
import CovenantArbitrationABI from "./contracts/CovenantArbitration.json" with { type: "json" };
import CovenantAttestationABI from "./contracts/CovenantAttestation.json" with { type: "json" };
import CovenantGovernanceABI from "./contracts/CovenantGovernance.json" with { type: "json" };
import InsurancePoolABI from "./contracts/InsurancePool.json" with { type: "json" };
import TrainingMarketplaceABI from "./contracts/TrainingMarketplace.json" with { type: "json" };
import GrantProgramABI from "./contracts/GrantProgram.json" with { type: "json" };
import RevisionManagerABI from "./contracts/RevisionManager.json" with { type: "json" };
import ParallelTaskBatchABI from "./contracts/ParallelTaskBatch.json" with { type: "json" };
import AgentCollectiveABI from "./contracts/AgentCollective.json" with { type: "json" };
import MultiTokenEscrowABI from "./contracts/MultiTokenEscrow.json" with { type: "json" };
import COVENANTRouterABI from "./contracts/COVENANTRouter.json" with { type: "json" };
import type { ContractAddresses } from "./types.js";

export interface V5Config {
  chainId: number;
  publicClient: PublicClient;
  walletClient?: WalletClient;
  contractAddresses?: Partial<ContractAddresses>;
}

export class CovenantSDKV5 {
  protected publicClient: PublicClient;
  protected walletClient?: WalletClient;
  protected chain: Chain;
  protected account?: Account;
  private addresses: ContractAddresses;

  constructor(config: V5Config) {
    this.publicClient = config.publicClient;
    this.walletClient = config.walletClient;
    this.account = config.walletClient?.account;
    this.addresses = getContractAddresses(config.chainId, config.contractAddresses);
    this.chain = CHAIN_CONFIGS[config.chainId as keyof typeof CHAIN_CONFIGS]?.chain ?? {
      id: config.chainId,
      name: `Chain ${config.chainId}`,
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [] } },
    };
  }

  private requireWallet(): void {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations. Pass walletClient in config.");
    }
  }

  getAddresses(): ContractAddresses {
    return { ...this.addresses };
  }

  async waitForTransaction(hash: Hash) {
    return await this.publicClient.waitForTransactionReceipt({ hash });
  }

  // ═══════════════════════════════════════════════════════════════
  // CovenantSettlement (17 functions)
  // ═══════════════════════════════════════════════════════════════

  async createStream(payee: Address, ratePerSecond: bigint, duration: number): Promise<Hash> {
    this.requireWallet();
    const totalCost = ratePerSecond * BigInt(duration);
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantSettlement,
      abi: CovenantSettlementABI.abi,
      functionName: "createStream",
      args: [payee, ratePerSecond, duration],
      value: totalCost,
      chain: this.chain,
      account: this.account!,
    });
  }

  async withdrawStream(streamId: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantSettlement,
      abi: CovenantSettlementABI.abi,
      functionName: "withdrawStream",
      args: [streamId],
      chain: this.chain,
      account: this.account!,
    });
  }

  async cancelStream(streamId: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantSettlement,
      abi: CovenantSettlementABI.abi,
      functionName: "cancelStream",
      args: [streamId],
      chain: this.chain,
      account: this.account!,
    });
  }

  async getStream(streamId: bigint): Promise<any> {
    return this.publicClient.readContract({
      address: this.addresses.CovenantSettlement,
      abi: CovenantSettlementABI.abi,
      functionName: "getStream",
      args: [streamId],
    });
  }

  async streamCount(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.CovenantSettlement,
      abi: CovenantSettlementABI.abi,
      functionName: "streamCount",
      args: [],
    }) as Promise<bigint>;
  }

  async claimableAmount(streamId: bigint): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.CovenantSettlement,
      abi: CovenantSettlementABI.abi,
      functionName: "claimableAmount",
      args: [streamId],
    }) as Promise<bigint>;
  }

  async settleReceipt(payer: Address, payee: Address, amount: bigint, nonce: bigint, payerSignature: `0x${string}`): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantSettlement,
      abi: CovenantSettlementABI.abi,
      functionName: "settleReceipt",
      args: [payer, payee, amount, nonce, payerSignature],
      chain: this.chain,
      account: this.account!,
    });
  }

  async batchSettleReceipts(payers: Address[], payees: Address[], amounts: bigint[], nonces: bigint[], payerSignatures: `0x${string}`[]): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantSettlement,
      abi: CovenantSettlementABI.abi,
      functionName: "batchSettleReceipts",
      args: [payers, payees, amounts, nonces, payerSignatures],
      chain: this.chain,
      account: this.account!,
    });
  }

  async receiptCount(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.CovenantSettlement,
      abi: CovenantSettlementABI.abi,
      functionName: "receiptCount",
      args: [],
    }) as Promise<bigint>;
  }

  async batchCount(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.CovenantSettlement,
      abi: CovenantSettlementABI.abi,
      functionName: "batchCount",
      args: [],
    }) as Promise<bigint>;
  }

  // ═══════════════════════════════════════════════════════════════
  // CovenantArbitration (17 functions)
  // ═══════════════════════════════════════════════════════════════

  async createDispute(taskId: bigint, evidenceHash: `0x${string}`): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantArbitration,
      abi: CovenantArbitrationABI.abi,
      functionName: "createDispute",
      args: [taskId, evidenceHash],
      chain: this.chain,
      account: this.account!,
    });
  }

  async stakeForDispute(disputeId: bigint, amount: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantArbitration,
      abi: CovenantArbitrationABI.abi,
      functionName: "stakeForDispute",
      args: [disputeId],
      value: amount,
      chain: this.chain,
      account: this.account!,
    });
  }

  async settleDispute(disputeId: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantArbitration,
      abi: CovenantArbitrationABI.abi,
      functionName: "settleDispute",
      args: [disputeId],
      chain: this.chain,
      account: this.account!,
    });
  }

  async submitRuling(disputeId: bigint, ruling: number, splitBps: number, arbiterSignature: `0x${string}`): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantArbitration,
      abi: CovenantArbitrationABI.abi,
      functionName: "submitRuling",
      args: [disputeId, ruling, splitBps, arbiterSignature],
      chain: this.chain,
      account: this.account!,
    });
  }

  async getDispute(disputeId: bigint): Promise<any> {
    return this.publicClient.readContract({
      address: this.addresses.CovenantArbitration,
      abi: CovenantArbitrationABI.abi,
      functionName: "getDispute",
      args: [disputeId],
    });
  }

  async disputeCount(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.CovenantArbitration,
      abi: CovenantArbitrationABI.abi,
      functionName: "disputeCount",
      args: [],
    }) as Promise<bigint>;
  }

  async arbiter(): Promise<Address> {
    return this.publicClient.readContract({
      address: this.addresses.CovenantArbitration,
      abi: CovenantArbitrationABI.abi,
      functionName: "arbiter",
      args: [],
    }) as Promise<Address>;
  }

  // ═══════════════════════════════════════════════════════════════
  // CovenantAttestation (15 functions)
  // ═══════════════════════════════════════════════════════════════

  async attest(subject: Address, schemaHash: `0x${string}`, dataHash: `0x${string}`, expiresAt: number): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantAttestation,
      abi: CovenantAttestationABI.abi,
      functionName: "attest",
      args: [subject, schemaHash, dataHash, expiresAt],
      chain: this.chain,
      account: this.account!,
    });
  }

  async attestBatch(subjects: Address[], schemaHash: `0x${string}`, dataHashes: `0x${string}`[], expiresAt: number): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantAttestation,
      abi: CovenantAttestationABI.abi,
      functionName: "attestBatch",
      args: [subjects, schemaHash, dataHashes, expiresAt],
      chain: this.chain,
      account: this.account!,
    });
  }

  async verifyAttestation(attestationId: `0x${string}`): Promise<{ valid: boolean; attestation: any }> {
    const result = await this.publicClient.readContract({
      address: this.addresses.CovenantAttestation,
      abi: CovenantAttestationABI.abi,
      functionName: "verify",
      args: [attestationId],
    });
    return result as { valid: boolean; attestation: any };
  }

  async attestationCount(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.CovenantAttestation,
      abi: CovenantAttestationABI.abi,
      functionName: "attestationCount",
      args: [],
    }) as Promise<bigint>;
  }

  async getAgentAttestations(agent: Address): Promise<`0x${string}`[]> {
    return this.publicClient.readContract({
      address: this.addresses.CovenantAttestation,
      abi: CovenantAttestationABI.abi,
      functionName: "getAgentAttestations",
      args: [agent],
    }) as Promise<`0x${string}`[]>;
  }

  async registerIssuer(issuer: Address, name: string): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantAttestation,
      abi: CovenantAttestationABI.abi,
      functionName: "registerIssuer",
      args: [issuer, name],
      chain: this.chain,
      account: this.account!,
    });
  }

  async registerSchema(schemaHash: `0x${string}`, name: string): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantAttestation,
      abi: CovenantAttestationABI.abi,
      functionName: "registerSchema",
      args: [schemaHash, name],
      chain: this.chain,
      account: this.account!,
    });
  }

  async revokeAttestation(attestationId: `0x${string}`): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantAttestation,
      abi: CovenantAttestationABI.abi,
      functionName: "revoke",
      args: [attestationId],
      chain: this.chain,
      account: this.account!,
    });
  }

  async isIssuer(address: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.addresses.CovenantAttestation,
      abi: CovenantAttestationABI.abi,
      functionName: "isIssuer",
      args: [address],
    }) as Promise<boolean>;
  }

  async schemaExists(schemaHash: `0x${string}`): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.addresses.CovenantAttestation,
      abi: CovenantAttestationABI.abi,
      functionName: "schemas",
      args: [schemaHash],
    }) as Promise<boolean>;
  }

  // ═══════════════════════════════════════════════════════════════
  // CovenantGovernance (26 functions)
  // ═══════════════════════════════════════════════════════════════

  async propose(target: Address, callData: `0x${string}`, descriptionHash: `0x${string}`, votingPeriod: number): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantGovernance,
      abi: CovenantGovernanceABI.abi,
      functionName: "propose",
      args: [target, callData, descriptionHash, votingPeriod],
      chain: this.chain,
      account: this.account!,
    });
  }

  async submitVotes(proposalId: bigint, forVotes: bigint, againstVotes: bigint, guardianSignature: `0x${string}`): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantGovernance,
      abi: CovenantGovernanceABI.abi,
      functionName: "submitVotes",
      args: [proposalId, forVotes, againstVotes, guardianSignature],
      chain: this.chain,
      account: this.account!,
    });
  }

  async executeProposal(proposalId: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantGovernance,
      abi: CovenantGovernanceABI.abi,
      functionName: "executeProposal",
      args: [proposalId],
      chain: this.chain,
      account: this.account!,
    });
  }

  async vetoProposal(proposalId: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantGovernance,
      abi: CovenantGovernanceABI.abi,
      functionName: "vetoProposal",
      args: [proposalId],
      chain: this.chain,
      account: this.account!,
    });
  }

  async emergencyPause(target: Address, paused: boolean): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantGovernance,
      abi: CovenantGovernanceABI.abi,
      functionName: "emergencyPause",
      args: [target, paused],
      chain: this.chain,
      account: this.account!,
    });
  }

  async getProposal(proposalId: bigint): Promise<any> {
    return this.publicClient.readContract({
      address: this.addresses.CovenantGovernance,
      abi: CovenantGovernanceABI.abi,
      functionName: "getProposal",
      args: [proposalId],
    });
  }

  async proposalCount(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.CovenantGovernance,
      abi: CovenantGovernanceABI.abi,
      functionName: "proposalCount",
      args: [],
    }) as Promise<bigint>;
  }

  async quorum(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.CovenantGovernance,
      abi: CovenantGovernanceABI.abi,
      functionName: "quorum",
      args: [],
    }) as Promise<bigint>;
  }

  async guardian(): Promise<Address> {
    return this.publicClient.readContract({
      address: this.addresses.CovenantGovernance,
      abi: CovenantGovernanceABI.abi,
      functionName: "guardian",
      args: [],
    }) as Promise<Address>;
  }

  async vetoer(): Promise<Address> {
    return this.publicClient.readContract({
      address: this.addresses.CovenantGovernance,
      abi: CovenantGovernanceABI.abi,
      functionName: "vetoer",
      args: [],
    }) as Promise<Address>;
  }

  async isPaused(target: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.addresses.CovenantGovernance,
      abi: CovenantGovernanceABI.abi,
      functionName: "isPaused",
      args: [target],
    }) as Promise<boolean>;
  }

  async setGuardian(newGuardian: Address): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantGovernance,
      abi: CovenantGovernanceABI.abi,
      functionName: "setGuardian",
      args: [newGuardian],
      chain: this.chain,
      account: this.account!,
    });
  }

  async setVetoer(newVetoer: Address): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantGovernance,
      abi: CovenantGovernanceABI.abi,
      functionName: "setVetoer",
      args: [newVetoer],
      chain: this.chain,
      account: this.account!,
    });
  }

  async setQuorum(newQuorum: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantGovernance,
      abi: CovenantGovernanceABI.abi,
      functionName: "setQuorum",
      args: [newQuorum],
      chain: this.chain,
      account: this.account!,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // InsurancePool (19 functions)
  // ═══════════════════════════════════════════════════════════════

  async joinPool(amount: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.InsurancePool,
      abi: InsurancePoolABI.abi,
      functionName: "joinPool",
      args: [],
      value: amount,
      chain: this.chain,
      account: this.account!,
    });
  }

  async fileClaim(taskId: bigint, amount: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.InsurancePool,
      abi: InsurancePoolABI.abi,
      functionName: "fileClaim",
      args: [taskId, amount],
      chain: this.chain,
      account: this.account!,
    });
  }

  async voteOnClaim(claimId: bigint, inFavor: boolean): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.InsurancePool,
      abi: InsurancePoolABI.abi,
      functionName: "voteOnClaim",
      args: [claimId, inFavor],
      chain: this.chain,
      account: this.account!,
    });
  }

  async approveClaim(claimId: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.InsurancePool,
      abi: InsurancePoolABI.abi,
      functionName: "approveClaim",
      args: [claimId],
      chain: this.chain,
      account: this.account!,
    });
  }

  async payClaim(claimId: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.InsurancePool,
      abi: InsurancePoolABI.abi,
      functionName: "payClaim",
      args: [claimId],
      chain: this.chain,
      account: this.account!,
    });
  }

  async withdrawPool(): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.InsurancePool,
      abi: InsurancePoolABI.abi,
      functionName: "withdraw",
      args: [],
      chain: this.chain,
      account: this.account!,
    });
  }

  async getPoolBalance(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.InsurancePool,
      abi: InsurancePoolABI.abi,
      functionName: "getPoolBalance",
      args: [],
    }) as Promise<bigint>;
  }

  async getMemberInfo(address: Address): Promise<any> {
    return this.publicClient.readContract({
      address: this.addresses.InsurancePool,
      abi: InsurancePoolABI.abi,
      functionName: "members",
      args: [address],
    });
  }

  async getClaim(claimId: bigint): Promise<any> {
    return this.publicClient.readContract({
      address: this.addresses.InsurancePool,
      abi: InsurancePoolABI.abi,
      functionName: "claims",
      args: [claimId],
    });
  }

  async claimCount(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.InsurancePool,
      abi: InsurancePoolABI.abi,
      functionName: "claimCount",
      args: [],
    }) as Promise<bigint>;
  }

  async memberCount(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.InsurancePool,
      abi: InsurancePoolABI.abi,
      functionName: "memberCount",
      args: [],
    }) as Promise<bigint>;
  }

  // ═══════════════════════════════════════════════════════════════
  // TrainingMarketplace (13 functions)
  // ═══════════════════════════════════════════════════════════════

  async createTraining(title: string, price: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.TrainingMarketplace,
      abi: TrainingMarketplaceABI.abi,
      functionName: "createTraining",
      args: [title, price],
      chain: this.chain,
      account: this.account!,
    });
  }

  async enroll(trainingId: bigint, price: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.TrainingMarketplace,
      abi: TrainingMarketplaceABI.abi,
      functionName: "enroll",
      args: [trainingId],
      value: price,
      chain: this.chain,
      account: this.account!,
    });
  }

  async getTraining(trainingId: bigint): Promise<any> {
    return this.publicClient.readContract({
      address: this.addresses.TrainingMarketplace,
      abi: TrainingMarketplaceABI.abi,
      functionName: "trainings",
      args: [trainingId],
    });
  }

  async trainingCount(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.TrainingMarketplace,
      abi: TrainingMarketplaceABI.abi,
      functionName: "trainingCount",
      args: [],
    }) as Promise<bigint>;
  }

  async platformFeeBps(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.TrainingMarketplace,
      abi: TrainingMarketplaceABI.abi,
      functionName: "platformFeeBps",
      args: [],
    }) as Promise<bigint>;
  }

  async feeRecipient(): Promise<Address> {
    return this.publicClient.readContract({
      address: this.addresses.TrainingMarketplace,
      abi: TrainingMarketplaceABI.abi,
      functionName: "feeRecipient",
      args: [],
    }) as Promise<Address>;
  }

  // ═══════════════════════════════════════════════════════════════
  // GrantProgram (14 functions)
  // ═══════════════════════════════════════════════════════════════

  async depositToGrants(amount: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.GrantProgram,
      abi: GrantProgramABI.abi,
      functionName: "deposit",
      args: [],
      value: amount,
      chain: this.chain,
      account: this.account!,
    });
  }

  async applyGrant(amount: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.GrantProgram,
      abi: GrantProgramABI.abi,
      functionName: "applyGrant",
      args: [amount],
      chain: this.chain,
      account: this.account!,
    });
  }

  async voteGrant(grantId: bigint, inFavor: boolean): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.GrantProgram,
      abi: GrantProgramABI.abi,
      functionName: "voteGrant",
      args: [grantId, inFavor],
      chain: this.chain,
      account: this.account!,
    });
  }

  async disburseGrant(grantId: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.GrantProgram,
      abi: GrantProgramABI.abi,
      functionName: "disburseGrant",
      args: [grantId],
      chain: this.chain,
      account: this.account!,
    });
  }

  async getGrant(grantId: bigint): Promise<any> {
    return this.publicClient.readContract({
      address: this.addresses.GrantProgram,
      abi: GrantProgramABI.abi,
      functionName: "grants",
      args: [grantId],
    });
  }

  async grantCount(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.GrantProgram,
      abi: GrantProgramABI.abi,
      functionName: "grantCount",
      args: [],
    }) as Promise<bigint>;
  }

  async treasury(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.GrantProgram,
      abi: GrantProgramABI.abi,
      functionName: "treasury",
      args: [],
    }) as Promise<bigint>;
  }

  async votingPeriod(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.GrantProgram,
      abi: GrantProgramABI.abi,
      functionName: "votingPeriod",
      args: [],
    }) as Promise<bigint>;
  }

  // ═══════════════════════════════════════════════════════════════
  // RevisionManager (17 functions)
  // ═══════════════════════════════════════════════════════════════

  async requestRevision(taskId: bigint, feedbackHash: string): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.RevisionManager,
      abi: RevisionManagerABI.abi,
      functionName: "requestRevision",
      args: [taskId, feedbackHash],
      chain: this.chain,
      account: this.account!,
    });
  }

  async submitRevision(taskId: bigint, newHash: `0x${string}`): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.RevisionManager,
      abi: RevisionManagerABI.abi,
      functionName: "submitRevision",
      args: [taskId, newHash],
      chain: this.chain,
      account: this.account!,
    });
  }

  async getRevisionCount(taskId: bigint): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.RevisionManager,
      abi: RevisionManagerABI.abi,
      functionName: "getRevisionCount",
      args: [taskId],
    }) as Promise<bigint>;
  }

  async getLatestRevision(taskId: bigint): Promise<any> {
    return this.publicClient.readContract({
      address: this.addresses.RevisionManager,
      abi: RevisionManagerABI.abi,
      functionName: "getLatestRevision",
      args: [taskId],
    });
  }

  async getRevision(taskId: bigint, revisionNumber: bigint): Promise<any> {
    return this.publicClient.readContract({
      address: this.addresses.RevisionManager,
      abi: RevisionManagerABI.abi,
      functionName: "revisions",
      args: [taskId, revisionNumber],
    });
  }

  async revisionAllowed(taskId: bigint): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.addresses.RevisionManager,
      abi: RevisionManagerABI.abi,
      functionName: "revisionAllowed",
      args: [taskId],
    }) as Promise<boolean>;
  }

  async taskClient(taskId: bigint): Promise<Address> {
    return this.publicClient.readContract({
      address: this.addresses.RevisionManager,
      abi: RevisionManagerABI.abi,
      functionName: "taskClient",
      args: [taskId],
    }) as Promise<Address>;
  }

  async setTaskClient(taskId: bigint, client: Address): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.RevisionManager,
      abi: RevisionManagerABI.abi,
      functionName: "setTaskClient",
      args: [taskId, client],
      chain: this.chain,
      account: this.account!,
    });
  }

  async setMaxRevisions(taskId: bigint, max: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.RevisionManager,
      abi: RevisionManagerABI.abi,
      functionName: "setMaxRevisions",
      args: [taskId, max],
      chain: this.chain,
      account: this.account!,
    });
  }

  async setRevisionAllowed(taskId: bigint, allowed: boolean): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.RevisionManager,
      abi: RevisionManagerABI.abi,
      functionName: "setRevisionAllowed",
      args: [taskId, allowed],
      chain: this.chain,
      account: this.account!,
    });
  }

  async defaultMaxRevisions(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.RevisionManager,
      abi: RevisionManagerABI.abi,
      functionName: "defaultMaxRevisions",
      args: [],
    }) as Promise<bigint>;
  }

  // ═══════════════════════════════════════════════════════════════
  // ParallelTaskBatch (15 functions)
  // ═══════════════════════════════════════════════════════════════

  async createBatch(workers: Address[], payments: bigint[], deadlines: bigint[], descriptionHashes: `0x${string}`[], aggregationSpec: `0x${string}`): Promise<Hash> {
    this.requireWallet();
    const totalBudget = payments.reduce((a, b) => a + b, 0n);
    return this.walletClient!.writeContract({
      address: this.addresses.ParallelTaskBatch,
      abi: ParallelTaskBatchABI.abi,
      functionName: "createBatch",
      args: [workers, payments, deadlines, descriptionHashes, aggregationSpec],
      value: totalBudget,
      chain: this.chain,
      account: this.account!,
    });
  }

  async aggregateResults(batchId: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.ParallelTaskBatch,
      abi: ParallelTaskBatchABI.abi,
      functionName: "aggregateResults",
      args: [batchId],
      chain: this.chain,
      account: this.account!,
    });
  }

  async getBatch(batchId: bigint): Promise<any> {
    return this.publicClient.readContract({
      address: this.addresses.ParallelTaskBatch,
      abi: ParallelTaskBatchABI.abi,
      functionName: "getBatch",
      args: [batchId],
    });
  }

  async batchCounter(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.ParallelTaskBatch,
      abi: ParallelTaskBatchABI.abi,
      functionName: "batchCounter",
      args: [],
    }) as Promise<bigint>;
  }

  // ═══════════════════════════════════════════════════════════════
  // AgentCollective (15 functions)
  // ═══════════════════════════════════════════════════════════════

  async createCollective(minContribution: bigint, maxMembers: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.AgentCollective,
      abi: AgentCollectiveABI.abi,
      functionName: "createCollective",
      args: [minContribution, maxMembers],
      chain: this.chain,
      account: this.account!,
    });
  }

  async joinCollective(collectiveId: bigint, amount: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.AgentCollective,
      abi: AgentCollectiveABI.abi,
      functionName: "joinCollective",
      args: [collectiveId],
      value: amount,
      chain: this.chain,
      account: this.account!,
    });
  }

  async launchCollectiveTask(collectiveId: bigint, worker: Address, payment: bigint, deadline: bigint, descriptionHash: `0x${string}`): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.AgentCollective,
      abi: AgentCollectiveABI.abi,
      functionName: "launchCollectiveTask",
      args: [collectiveId, worker, payment, deadline, descriptionHash],
      chain: this.chain,
      account: this.account!,
    });
  }

  async getCollective(collectiveId: bigint): Promise<{ memberCount: bigint; totalFund: bigint; launched: boolean }> {
    return this.publicClient.readContract({
      address: this.addresses.AgentCollective,
      abi: AgentCollectiveABI.abi,
      functionName: "getCollective",
      args: [collectiveId],
    }) as Promise<{ memberCount: bigint; totalFund: bigint; launched: boolean }>;
  }

  async collectiveCounter(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.AgentCollective,
      abi: AgentCollectiveABI.abi,
      functionName: "collectiveCounter",
      args: [],
    }) as Promise<bigint>;
  }

  // ═══════════════════════════════════════════════════════════════
  // MultiTokenEscrow (16 functions)
  // ═══════════════════════════════════════════════════════════════

  async createTaskERC20(worker: Address, token: Address, amount: bigint, deadline: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.MultiTokenEscrow,
      abi: MultiTokenEscrowABI.abi,
      functionName: "createTaskERC20",
      args: [worker, token, amount, deadline],
      chain: this.chain,
      account: this.account!,
    });
  }

  async verifyTask(taskId: bigint, success: boolean): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.MultiTokenEscrow,
      abi: MultiTokenEscrowABI.abi,
      functionName: "verifyTask",
      args: [taskId, success],
      chain: this.chain,
      account: this.account!,
    });
  }

  async multiTokenTaskCount(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.MultiTokenEscrow,
      abi: MultiTokenEscrowABI.abi,
      functionName: "taskCount",
      args: [],
    }) as Promise<bigint>;
  }

  async isAcceptedToken(token: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.addresses.MultiTokenEscrow,
      abi: MultiTokenEscrowABI.abi,
      functionName: "acceptedTokens",
      args: [token],
    }) as Promise<boolean>;
  }

  async tokenFee(token: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.MultiTokenEscrow,
      abi: MultiTokenEscrowABI.abi,
      functionName: "tokenFees",
      args: [token],
    }) as Promise<bigint>;
  }

  async setAcceptedToken(token: Address, accepted: boolean): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.MultiTokenEscrow,
      abi: MultiTokenEscrowABI.abi,
      functionName: "setAcceptedToken",
      args: [token, accepted],
      chain: this.chain,
      account: this.account!,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // COVENANTRouter (7 functions)
  // ═══════════════════════════════════════════════════════════════

  async multicall(calls: Array<{ target: Address; data: `0x${string}`; value: bigint }>): Promise<Hash> {
    this.requireWallet();
    const totalValue = calls.reduce((a, b) => a + b.value, 0n);
    return this.walletClient!.writeContract({
      address: this.addresses.COVENANTRouter,
      abi: COVENANTRouterABI.abi,
      functionName: "multicall",
      args: [calls],
      value: totalValue,
      chain: this.chain,
      account: this.account!,
    });
  }

  async registerAndCreateTask(
    agentRegistry: Address,
    taskEscrow: Address,
    name: string,
    capabilities: string[],
    worker: Address,
    payment: bigint,
    deadline: bigint,
    descriptionHash: string
  ): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.COVENANTRouter,
      abi: COVENANTRouterABI.abi,
      functionName: "registerAndCreateTask",
      args: [agentRegistry, taskEscrow, name, capabilities, worker, payment, deadline, descriptionHash],
      value: payment,
      chain: this.chain,
      account: this.account!,
    });
  }
}
