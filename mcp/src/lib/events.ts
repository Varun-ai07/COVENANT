/**
 * Event Indexer - Listens to contract events and stores for efficient querying
 * Reduces RPC polling by maintaining a local event cache
 */

import { type Address, type Hash, type Log, parseAbiItem, type PublicClient } from "viem";
import { getPublicClient, CONTRACTS, CHAIN } from "../config.js";
import { rpcCache } from "./cache.js";

// ============================================================
// Event Types
// ============================================================

export interface IndexedEvent {
  address: Address;
  blockNumber: bigint;
  transactionHash: Hash;
  logIndex: number;
  eventName: string;
  args: Record<string, unknown>;
  timestamp?: number;
}

export interface EventFilter {
  address?: Address;
  eventName?: string;
  fromBlock?: bigint;
  toBlock?: bigint;
  args?: Record<string, unknown>;
}

// ============================================================
// Event Indexer Class
// ============================================================

export class EventIndexer {
  private client: PublicClient;
  private events: IndexedEvent[] = [];
  private lastIndexedBlock: bigint = 0n;
  private isIndexing = false;
  private pollInterval: NodeJS.Timeout | null = null;

  // Contract addresses to index
  private contracts: Record<string, Address> = {};

  // Event definitions (simplified for common events)
  private eventSignatures = {
    TaskCreated: "TaskCreated(uint256,address,address,uint256,bytes32)",
    TaskSubmitted: "TaskSubmitted(uint256,bytes32)",
    TaskVerified: "TaskVerified(uint256,bool)",
    TaskDisputed: "TaskDisputed(uint256,address)",
    AgentRegistered: "AgentRegistered(address,string,bytes32)",
    AgentDeactivated: "AgentDeactivated(address)",
    ReputationUpdated: "ReputationUpdated(address,int256,uint256)",
    BatchCreated: "BatchCreated(uint256,address,uint256[])",
    BatchAggregated: "BatchAggregated(uint256,bytes32)",
    CollectiveCreated: "CollectiveCreated(uint256,address,uint256)",
    BidSubmitted: "BidSubmitted(uint256,address,uint256,uint256)",
    WorkerSelected: "WorkerSelected(uint256,address,uint256)",
    MilestoneSubmitted: "MilestoneSubmitted(uint256,uint256,bytes32)",
    MilestoneVerified: "MilestoneVerified(uint256,uint256,bool)",
  };

  constructor() {
    this.client = getPublicClient();
    this.contracts = {
      TaskEscrow: CONTRACTS.TaskEscrow,
      AgentRegistry: CONTRACTS.AgentRegistry,
      OpenTaskMarket: CONTRACTS.OpenTaskMarket,
      ParallelTaskBatch: CONTRACTS.ParallelTaskBatch,
      AgentCollective: CONTRACTS.AgentCollective,
    } as Record<string, Address>;
  }

  /**
   * Start indexing events from current block
   */
  async start(pollIntervalMs = 15000): Promise<void> {
    if (this.isIndexing) return;

    console.error("[EventIndexer] Starting event indexer...");

    // Get current block
    this.lastIndexedBlock = await this.client.getBlockNumber();
    console.error(`[EventIndexer] Starting from block ${this.lastIndexedBlock}`);

    this.isIndexing = true;

    // Poll for new events
    this.pollInterval = setInterval(() => this.poll(), pollIntervalMs);
  }

  /**
   * Stop indexing
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isIndexing = false;
    console.error("[EventIndexer] Stopped");
  }

  /**
   * Poll for new events
   */
  private async poll(): Promise<void> {
    try {
      const currentBlock = await this.client.getBlockNumber();

      if (currentBlock <= this.lastIndexedBlock) return;

      // Index events in batches of 1000 blocks
      const fromBlock = this.lastIndexedBlock + 1n;
      const toBlock = currentBlock > fromBlock + 1000n ? fromBlock + 1000n : currentBlock;

      await this.indexRange(fromBlock, toBlock);
      this.lastIndexedBlock = toBlock;

      // Keep only last 10000 events in memory
      if (this.events.length > 10000) {
        this.events = this.events.slice(-10000);
      }
    } catch (error) {
      console.error("[EventIndexer] Poll error:", error);
    }
  }

  /**
   * Index events in a block range
   */
  private async indexRange(fromBlock: bigint, toBlock: bigint): Promise<number> {
    let count = 0;

    for (const [name, address] of Object.entries(this.contracts)) {
      if (!address) continue;

      try {
        // Get logs for this contract
        const logs = await this.client.getLogs({
          address,
          fromBlock,
          toBlock,
        });

        for (const log of logs) {
          const event = this.parseLog(log, name);
          if (event) {
            this.events.push(event);
            count++;
          }
        }
      } catch (error) {
        console.error(`[EventIndexer] Error indexing ${name}:`, error);
      }
    }

    if (count > 0) {
      console.error(`[EventIndexer] Indexed ${count} events from blocks ${fromBlock}-${toBlock}`);
    }

    return count;
  }

  /**
   * Parse a log into an indexed event
   */
  private parseLog(log: Log, contractName: string): IndexedEvent | null {
    // Try to match event by topic
    const eventTopics = log.topics;
    if (!eventTopics.length) return null;

    // Simplified parsing - in production would use full ABI decoding
    return {
      address: log.address,
      blockNumber: log.blockNumber ?? 0n,
      transactionHash: log.transactionHash ?? "0x",
      logIndex: log.logIndex ?? 0,
      eventName: eventTopics[0]?.slice(0, 10) || "Unknown",
      args: { raw: log.data },
    };
  }

  /**
   * Query indexed events
   */
  query(filter: EventFilter): IndexedEvent[] {
    let results = this.events;

    if (filter.address) {
      results = results.filter(e => e.address.toLowerCase() === filter.address!.toLowerCase());
    }

    if (filter.eventName) {
      results = results.filter(e => e.eventName.includes(filter.eventName!));
    }

    if (filter.fromBlock) {
      results = results.filter(e => e.blockNumber >= filter.fromBlock!);
    }

    if (filter.toBlock) {
      results = results.filter(e => e.blockNumber <= filter.toBlock!);
    }

    return results;
  }

  /**
   * Get events for a specific task
   */
  getTaskEvents(taskId: number): IndexedEvent[] {
    return this.events.filter(e =>
      e.args?.taskId === BigInt(taskId) ||
      JSON.stringify(e.args).includes(`"taskId":"${taskId}"`)
    );
  }

  /**
   * Get events for a specific agent
   */
  getAgentEvents(address: Address): IndexedEvent[] {
    const addr = address.toLowerCase();
    return this.events.filter(e =>
      e.address.toLowerCase() === addr ||
      JSON.stringify(e.args).toLowerCase().includes(addr.slice(2))
    );
  }

  /**
   * Get event counts by type
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {
      total: this.events.length,
      lastBlock: Number(this.lastIndexedBlock),
    };

    for (const event of this.events) {
      stats[event.eventName] = (stats[event.eventName] || 0) + 1;
    }

    return stats;
  }

  /**
   * Clear indexed events
   */
  clear(): void {
    this.events = [];
    console.error("[EventIndexer] Cleared all events");
  }
}

// Singleton instance
export const eventIndexer = new EventIndexer();

// Auto-start if enabled
const AUTO_START_INDEXER = process.env.COVENANT_INDEX_EVENTS === "true";
if (AUTO_START_INDEXER) {
  eventIndexer.start().catch(console.error);
}
