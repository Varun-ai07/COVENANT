import { type Address, type PublicClient, keccak256, toBytes } from "viem";
import type { InsurancePolicy, InsuranceClaim, InsurancePoolStats } from "../types.js";

export class InsuranceService {
  private policies: Map<Address, InsurancePolicy> = new Map();
  private claims: Map<string, InsuranceClaim> = new Map();
  private claimCounter = 0;

  private publicClient: PublicClient;
  private identityAddress: Address;
  private identityAbi: any;

  static PREMIUM_RATE_BPS = 200; // 2% of coverage
  static COVERAGE_MULTIPLIER = 50; // 50x premium = max coverage
  static CLAIM_COOLDOWN = 7 * 24 * 60 * 60; // 7 days in seconds
  static MIN_PREMIUM = 1000000000000000n; // 0.001 ETH

  // For testing: override current time
  private _now: number | null = null;

  now(): number {
    return this._now ?? Math.floor(Date.now() / 1000);
  }

  setNow(t: number) { this._now = t; }

  constructor(config: {
    identityAddress: Address;
    identityAbi: any;
    publicClient: PublicClient;
  }) {
    this.identityAddress = config.identityAddress;
    this.identityAbi = config.identityAbi;
    this.publicClient = config.publicClient;
  }

  async enroll(agent: Address, premium: bigint): Promise<InsurancePolicy> {
    if (premium < InsuranceService.MIN_PREMIUM) {
      throw new Error("Premium below minimum");
    }

    const enrolledAt = this.now();

    const isRegistered = await this.publicClient.readContract({
      address: this.identityAddress,
      abi: this.identityAbi,
      functionName: "isRegistered",
      args: [agent],
    });

    if (!isRegistered) {
      throw new Error("Agent not registered on-chain");
    }

    const policy: InsurancePolicy = {
      agent,
      premiumPaid: premium,
      enrolledAt,
      expiresAt: enrolledAt + 365 * 24 * 60 * 60,
      active: true,
    };

    this.policies.set(agent, policy);
    return policy;
  }

  /**
   * Synchronous enroll for testing — skips async RPC check.
   */
  enrollSync(agent: Address, premium: bigint): InsurancePolicy {
    if (premium < InsuranceService.MIN_PREMIUM) {
      throw new Error("Premium below minimum");
    }

    const policy: InsurancePolicy = {
      agent,
      premiumPaid: premium,
      enrolledAt: this.now(),
      expiresAt: this.now() + 365 * 24 * 60 * 60,
      active: true,
    };

    this.policies.set(agent, policy);
    return policy;
  }

  submitClaim(
    taskId: string,
    agent: Address,
    amount: bigint,
    evidence: string[]
  ): InsuranceClaim {
    const policy = this.policies.get(agent);
    if (!policy || !policy.active) {
      throw new Error("No active policy");
    }

    const maxCoverage = policy.premiumPaid * BigInt(InsuranceService.COVERAGE_MULTIPLIER);
    if (amount > maxCoverage) {
      throw new Error(`Amount exceeds coverage: ${maxCoverage}`);
    }

    if (this.now() < policy.enrolledAt + InsuranceService.CLAIM_COOLDOWN) {
      throw new Error("Claim cooldown active");
    }

    this.claimCounter++;
    const claimId = keccak256(
      toBytes(`claim-${this.claimCounter}-${taskId}-${agent}`)
    );

    const claim: InsuranceClaim = {
      id: claimId,
      taskId,
      agent,
      amountRequested: amount,
      evidence,
      status: "submitted",
      createdAt: Math.floor(Date.now() / 1000),
      reviewedBy: null,
      reviewNotes: "",
      paidAt: null,
    };

    this.claims.set(claimId, claim);
    return claim;
  }

  reviewClaim(
    claimId: string,
    reviewer: Address,
    approved: boolean,
    notes: string
  ): InsuranceClaim {
    const claim = this.claims.get(claimId);
    if (!claim) throw new Error("Claim not found");
    if (claim.status !== "submitted") throw new Error("Claim not in reviewable state");

    claim.status = approved ? "approved" : "rejected";
    claim.reviewedBy = reviewer;
    claim.reviewNotes = notes;

    return claim;
  }

  getClaim(claimId: string): InsuranceClaim | undefined {
    return this.claims.get(claimId);
  }

  getClaimsByAgent(agent: Address): InsuranceClaim[] {
    return Array.from(this.claims.values()).filter(c => c.agent === agent);
  }

  getPendingClaims(): InsuranceClaim[] {
    return Array.from(this.claims.values()).filter(c => c.status === "submitted");
  }

  getPolicy(agent: Address): InsurancePolicy | undefined {
    return this.policies.get(agent);
  }

  getPoolStats(): InsurancePoolStats {
    const policies = Array.from(this.policies.values());
    const claims = Array.from(this.claims.values());
    const activePolicies = policies.filter(p => p.active).length;
    const pendingClaims = claims.filter(c => c.status === "submitted").length;
    const approvedClaims = claims.filter(c => c.status === "approved" || c.status === "paid");

    const totalPremiums = policies.reduce((sum, p) => sum + p.premiumPaid, 0n);
    const totalClaimsPaid = approvedClaims.reduce((sum, c) => sum + c.amountRequested, 0n);

    return {
      totalPremiums,
      totalClaimsPaid,
      activePolicies,
      pendingClaims,
      poolBalance: totalPremiums - totalClaimsPaid,
      claimSuccessRate: claims.length > 0
        ? Math.round((approvedClaims.length / claims.length) * 100)
        : 0,
    };
  }

  calculatePremium(coverageAmount: bigint): bigint {
    return (coverageAmount * BigInt(InsuranceService.PREMIUM_RATE_BPS)) / 10000n;
  }

  calculateCoverage(premium: bigint): bigint {
    return premium * BigInt(InsuranceService.COVERAGE_MULTIPLIER);
  }
}
