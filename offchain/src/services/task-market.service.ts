import { type Address, type PublicClient, keccak256, toBytes } from "viem";
import type {
  TaskListing,
  Bid,
  TaskMatch,
  TaskMetadata,
} from "../types.js";

export class OpenTaskMarket {
  private listings: Map<string, TaskListing> = new Map();
  private bids: Map<string, Bid[]> = new Map();
  private listingCounter = 0;
  private bidCounter = 0;

  private publicClient: PublicClient;
  private identityAddress: Address;
  private identityAbi: any;

  static CATEGORIES = [
    "development",
    "data-analysis",
    "content-creation",
    "design",
    "testing",
    "research",
    "translation",
    "marketing",
  ];

  static MIN_BID_DURATION = 24 * 60 * 60; // 1 day
  static MAX_BID_DURATION = 90 * 24 * 60 * 60; // 90 days

  constructor(config: {
    identityAddress: Address;
    identityAbi: any;
    publicClient: PublicClient;
  }) {
    this.identityAddress = config.identityAddress;
    this.identityAbi = config.identityAbi;
    this.publicClient = config.publicClient;
  }

  async postTask(
    client: Address,
    title: string,
    description: string,
    category: string,
    budget: bigint,
    deadline: number,
    requiredCapabilities: string[],
    metadata: TaskMetadata
  ): Promise<TaskListing> {
    if (!OpenTaskMarket.CATEGORIES.includes(category)) {
      throw new Error(`Invalid category: ${category}`);
    }

    const isRegistered = await this.publicClient.readContract({
      address: this.identityAddress,
      abi: this.identityAbi,
      functionName: "isRegistered",
      args: [client],
    });

    if (!isRegistered) {
      throw new Error("Client not registered on-chain");
    }

    this.listingCounter++;
    const id = `task-${this.listingCounter}`;

    const listing: TaskListing = {
      id,
      title,
      description,
      category,
      budget,
      deadline,
      requiredCapabilities,
      client,
      status: "open",
      selectedWorker: null,
      createdAt: Math.floor(Date.now() / 1000),
      escrowTaskId: null,
      metadata,
    };

    this.listings.set(id, listing);
    return listing;
  }

  submitBid(
    taskId: string,
    worker: Address,
    price: bigint,
    proposal: string,
    estimatedDuration: number
  ): Bid {
    const listing = this.listings.get(taskId);
    if (!listing) throw new Error("Task not found");
    if (listing.status !== "open") throw new Error("Task not open");
    if (price > listing.budget) throw new Error("Bid exceeds budget");

    if (estimatedDuration < OpenTaskMarket.MIN_BID_DURATION) {
      throw new Error("Duration too short");
    }
    if (estimatedDuration > OpenTaskMarket.MAX_BID_DURATION) {
      throw new Error("Duration too long");
    }

    // Check max bids
    const existingBids = this.bids.get(taskId) || [];
    if (listing.metadata.maxBids > 0 && existingBids.length >= listing.metadata.maxBids) {
      throw new Error("Max bids reached");
    }

    // Check for duplicate bid
    if (existingBids.some(b => b.worker === worker)) {
      throw new Error("Already bid on this task");
    }

    this.bidCounter++;
    const bidId = `bid-${this.bidCounter}`;

    const bid: Bid = {
      id: bidId,
      taskId,
      worker,
      price,
      proposal,
      estimatedDuration,
      status: "pending",
      createdAt: Math.floor(Date.now() / 1000),
    };

    if (!this.bids.has(taskId)) {
      this.bids.set(taskId, []);
    }
    this.bids.get(taskId)!.push(bid);

    return bid;
  }

  acceptBid(taskId: string, bidId: string, client: Address): void {
    const listing = this.listings.get(taskId);
    if (!listing) throw new Error("Task not found");
    if (listing.client !== client) throw new Error("Not the client");
    if (listing.status !== "open") throw new Error("Task not open");

    const taskBids = this.bids.get(taskId) || [];
    const bid = taskBids.find(b => b.id === bidId);
    if (!bid) throw new Error("Bid not found");

    bid.status = "accepted";
    listing.selectedWorker = bid.worker;
    listing.status = "in-progress";

    // Reject all other bids
    for (const otherBid of taskBids) {
      if (otherBid.id !== bidId && otherBid.status === "pending") {
        otherBid.status = "rejected";
      }
    }
  }

  rejectBid(taskId: string, bidId: string, client: Address): void {
    const listing = this.listings.get(taskId);
    if (!listing) throw new Error("Task not found");
    if (listing.client !== client) throw new Error("Not the client");

    const taskBids = this.bids.get(taskId) || [];
    const bid = taskBids.find(b => b.id === bidId);
    if (!bid) throw new Error("Bid not found");
    if (bid.status !== "pending") throw new Error("Bid not pending");

    bid.status = "rejected";
  }

  withdrawBid(taskId: string, bidId: string, worker: Address): void {
    const taskBids = this.bids.get(taskId) || [];
    const bid = taskBids.find(b => b.id === bidId);
    if (!bid) throw new Error("Bid not found");
    if (bid.worker !== worker) throw new Error("Not your bid");
    if (bid.status !== "pending") throw new Error("Bid not pending");

    bid.status = "withdrawn";
  }

  completeTask(taskId: string): void {
    const listing = this.listings.get(taskId);
    if (!listing) throw new Error("Task not found");
    if (listing.status !== "in-progress") throw new Error("Task not in progress");

    listing.status = "completed";
  }

  cancelTask(taskId: string, client: Address): void {
    const listing = this.listings.get(taskId);
    if (!listing) throw new Error("Task not found");
    if (listing.client !== client) throw new Error("Not the client");
    if (listing.status !== "open" && listing.status !== "in-progress") {
      throw new Error("Cannot cancel");
    }

    listing.status = "cancelled";

    // Reject all pending bids
    const taskBids = this.bids.get(taskId) || [];
    for (const bid of taskBids) {
      if (bid.status === "pending") {
        bid.status = "rejected";
      }
    }
  }

  // ─── Search & Match ────────────────────────────────────────────

  searchTasks(
    query: string,
    category?: string,
    minBudget?: bigint,
    maxBudget?: bigint
  ): TaskListing[] {
    return Array.from(this.listings.values()).filter(listing => {
      if (listing.status !== "open") return false;
      if (category && listing.category !== category) return false;
      if (minBudget && listing.budget < minBudget) return false;
      if (maxBudget && listing.budget > maxBudget) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          listing.title.toLowerCase().includes(q) ||
          listing.description.toLowerCase().includes(q) ||
          listing.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }

  async findWorkers(
    taskId: string,
    maxResults: number = 5
  ): Promise<TaskMatch[]> {
    const listing = this.listings.get(taskId);
    if (!listing) throw new Error("Task not found");

    const matches: TaskMatch[] = [];

    // Get all registered agents
    const totalAgents = await this.publicClient.readContract({
      address: this.identityAddress,
      abi: this.identityAbi,
      functionName: "totalAgents",
      args: [],
    });

    // Score each agent based on capabilities and reputation
    for (let i = 0; i < Math.min(Number(totalAgents), 100); i++) {
      // This is a simplified matching — in production you'd query agent capabilities
      const score = Math.random(); // placeholder
      if (score > 0.5) {
        matches.push({
          taskId,
          worker: `0x${"0".repeat(40)}`, // placeholder
          score,
          reasons: ["Capability match", "Reputation score"],
        });
      }
    }

    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  // ─── Getters ──────────────────────────────────────────────────

  getListing(taskId: string): TaskListing | undefined {
    return this.listings.get(taskId);
  }

  getBids(taskId: string): Bid[] {
    return this.bids.get(taskId) || [];
  }

  getPendingBids(taskId: string): Bid[] {
    return this.getBids(taskId).filter(b => b.status === "pending");
  }

  getOpenTasks(): TaskListing[] {
    return Array.from(this.listings.values()).filter(l => l.status === "open");
  }

  getTasksByClient(client: Address): TaskListing[] {
    return Array.from(this.listings.values()).filter(l => l.client === client);
  }

  getTasksByWorker(worker: Address): TaskListing[] {
    return Array.from(this.listings.values()).filter(l => l.selectedWorker === worker);
  }

  getMarketStats(): {
    totalTasks: number;
    openTasks: number;
    completedTasks: number;
    totalBids: number;
    averageBidsPerTask: number;
  } {
    const listings = Array.from(this.listings.values());
    const allBids = Array.from(this.bids.values()).flat();
    const openTasks = listings.filter(l => l.status === "open").length;
    const completedTasks = listings.filter(l => l.status === "completed").length;

    return {
      totalTasks: listings.length,
      openTasks,
      completedTasks,
      totalBids: allBids.length,
      averageBidsPerTask: listings.length > 0
        ? Math.round(allBids.length / listings.length * 10) / 10
        : 0,
    };
  }
}
