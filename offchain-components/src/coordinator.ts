/**
 * COVENANT Off-Chain Coordinator
 * Unified service with authentication, rate limiting, WebSocket updates,
 * IPFS integration, and real matching algorithm.
 */
import { EventEmitter } from "events";
import { type Address, type PublicClient, type WalletClient, keccak256, toBytes } from "viem";
import { ReceiptEngine } from "./receipt-engine.js";
import { ReputationOracle } from "./reputation-oracle.js";
import { CapabilityManager } from "./capability-manager.js";
import { InsuranceService } from "./services/insurance.service.js";
import { CollectiveService } from "./services/collective.service.js";
import { OpenTaskMarket } from "./services/task-market.service.js";
import { loadStore, saveStore } from "./persistence.js";
import type { CoordinatorConfig } from "./types.js";

// ─── Authentication ──────────────────────────────────────────

interface ApiKey {
  key: string;
  agent: Address;
  permissions: string[];
  createdAt: number;
  lastUsed: number;
  requestCount: number;
}

// ─── Rate Limiter ────────────────────────────────────────────

class RateLimiter {
  private limits: Map<string, { count: number; resetAt: number }> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  allow(key: string): boolean {
    const now = Date.now();
    const record = this.limits.get(key);
    if (!record || now > record.resetAt) {
      this.limits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (record.count >= this.maxRequests) return false;
    record.count++;
    return true;
  }
}

// ─── Coordinator ─────────────────────────────────────────────

export class CovenantCoordinator extends EventEmitter {
  public receiptEngine: ReceiptEngine;
  public reputationOracle: ReputationOracle;
  public capabilityManager: CapabilityManager;
  public insuranceService: InsuranceService;
  public collectiveService: CollectiveService;
  public taskMarket: OpenTaskMarket;

  private apiKeys: Map<string, ApiKey>;
  private rateLimiter: RateLimiter;
  private publicClient: PublicClient;

  constructor(config: CoordinatorConfig) {
    super();

    this.publicClient = config.publicClient;
    this.receiptEngine = new ReceiptEngine(config);
    this.reputationOracle = new ReputationOracle(config);
    this.capabilityManager = new CapabilityManager(config);
    this.insuranceService = new InsuranceService(config);
    this.collectiveService = new CollectiveService(config);
    this.taskMarket = new OpenTaskMarket(config);

    // Load from persistence
    this.apiKeys = new Map(Object.entries(loadStore("api_keys", {})));
    this.rateLimiter = new RateLimiter(100, 60000); // 100 requests per minute
  }

  // ─── Authentication ────────────────────────────────────────

  authenticate(apiKey: string): ApiKey | null {
    const key = this.apiKeys.get(apiKey);
    if (!key) return null;
    key.lastUsed = Date.now();
    key.requestCount++;
    saveStore("api_keys", Object.fromEntries(this.apiKeys));
    return key;
  }

  registerApiKey(agent: Address, permissions: string[]): string {
    const key = keccak256(toBytes(`${agent}-${Date.now()}`)).slice(0, 32);
    const apiKey: ApiKey = {
      key,
      agent,
      permissions,
      createdAt: Date.now(),
      lastUsed: 0,
      requestCount: 0,
    };
    this.apiKeys.set(key, apiKey);
    saveStore("api_keys", Object.fromEntries(this.apiKeys));
    return key;
  }

  revokeApiKey(key: string): boolean {
    return this.apiKeys.delete(key);
  }

  // ─── Rate Limiting ──────────────────────────────────────────

  checkRateLimit(apiKey: string): boolean {
    return this.rateLimiter.allow(apiKey);
  }

  // ─── WebSocket Events ──────────────────────────────────────

  emitTaskCreated(taskId: string, client: Address): void {
    this.emit("task:created", { taskId, client, timestamp: Date.now() });
  }

  emitTaskCompleted(taskId: string, worker: Address, payout: bigint): void {
    this.emit("task:completed", { taskId, worker, payout, timestamp: Date.now() });
  }

  emitReceiptSettled(receiptId: string, payer: Address, payee: Address, amount: bigint): void {
    this.emit("receipt:settled", { receiptId, payer, payee, amount, timestamp: Date.now() });
  }

  emitDisputeCreated(disputeId: string, taskId: string, disputant: Address): void {
    this.emit("dispute:created", { disputeId, taskId, disputant, timestamp: Date.now() });
  }

  emitReputationUpdated(agent: Address, score: number, tier: string): void {
    this.emit("reputation:updated", { agent, score, tier, timestamp: Date.now() });
  }

  // ─── IPFS Integration ──────────────────────────────────────

  async uploadToIPFS(content: string, name: string): Promise<string> {
    const pinataApiKey = process.env.PINATA_API_KEY;
    const pinataSecretKey = process.env.PINATA_SECRET_KEY;

    if (!pinataApiKey || !pinataSecretKey) {
      throw new Error("Pinata not configured. Set PINATA_API_KEY and PINATA_SECRET_KEY.");
    }

    const formData = new FormData();
    const blob = new Blob([content], { type: "text/plain" });
    formData.append("file", blob, name);

    const metadata = JSON.stringify({
      name,
      keyvalues: { project: "covenant", timestamp: Date.now().toString() },
    });
    formData.append("pinataMetadata", metadata);

    const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        pinata_api_key: pinataApiKey,
        pinata_secret_api_key: pinataSecretKey,
      },
      body: formData,
    });

    if (!response.ok) throw new Error(`IPFS upload failed: ${await response.text()}`);
    const result = await response.json();
    return result.IpinfsHash;
  }

  // ─── Real Matching Algorithm ───────────────────────────────

  async findBestWorkers(taskId: string, maxResults: number = 5): Promise<Array<{
    agent: Address;
    score: number;
    reasons: string[];
  }>> {
    const listing = this.taskMarket.getListing(taskId);
    if (!listing) throw new Error("Task not found");

    const matches: Array<{ agent: Address; score: number; reasons: string[] }> = [];

    // Get all registered agents from chain
    const totalAgents = await this.publicClient.readContract({
      address: this.capabilityManager.identityAddress,
      abi: this.capabilityManager.identityAbi,
      functionName: "totalAgents",
      args: [],
    });

    // Score each agent
    for (let i = 0; i < Math.min(Number(totalAgents), 200); i++) {
      try {
        const agentAddr = await this.publicClient.readContract({
          address: this.capabilityManager.identityAddress,
          abi: this.capabilityManager.identityAbi,
          functionName: "getAllAgents",
          args: [BigInt(i), BigInt(1)],
        }) as Address;

        if (agentAddr === ("0x0000000000000000000000000000000000000000" as Address)) continue;

        const agentData = await this.publicClient.readContract({
          address: this.capabilityManager.identityAddress,
          abi: this.capabilityManager.identityAbi,
          functionName: "getAgent",
          args: [agentAddr],
        });

        let score = 0;
        const reasons: string[] = [];

        // Capability match (40% weight)
        const hasCapability = this.capabilityManager.hasCapability(
          agentAddr,
          keccak256(toBytes(listing.category))
        );
        if (hasCapability) { score += 40; reasons.push("Capability match"); }

        // Reputation score (30% weight)
        const reputation = this.reputationOracle.getStats(agentAddr);
        if (reputation) {
          score += (reputation.score / 1000) * 30;
          reasons.push(`Reputation: ${reputation.score}/1000 (${reputation.tier})`);
        }

        // Activity recency (20% weight)
        const lastActivity = Number((agentData as any).lastActivity || 0);
        const daysSinceActivity = (Date.now() / 1000 - lastActivity) / 86400;
        if (daysSinceActivity < 7) { score += 20; reasons.push("Active recently"); }
        else if (daysSinceActivity < 30) { score += 10; reasons.push("Active this month"); }

        // Stake amount (10% weight)
        const stake = (agentData as any).stakedAmount || 0n;
        if (stake > 10000000000000000n) { score += 10; reasons.push("Well-staked"); }

        matches.push({ agent: agentAddr, score, reasons });
      } catch {}
    }

    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }
}
