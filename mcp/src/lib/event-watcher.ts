/**
 * WebSocket-based real-time event watcher for COVENANT contracts.
 * Replaces polling with push-based subscriptions via viem's watchContractEvent.
 * Falls back to HTTP polling if WebSocket transport is unavailable.
 */
import {
  type Address,
  type PublicClient,
  formatEther,
  parseAbiItem,
  decodeEventLog,
} from "viem";
import { CONTRACTS, CHAIN, RPC_URL, loadAbi, getPublicClient } from "../config.js";
import { loadStore, saveStore } from "./store.js";

// ============================================================
// Types
// ============================================================

export interface WatcherEvent {
  eventName: string;
  contract: string;
  address: Address;
  blockNumber: bigint;
  transactionHash: string;
  logIndex: number;
  args: Record<string, unknown>;
  timestamp: number;
  id: string;
}

export interface EventFilter {
  eventName?: string;
  contract?: string;
  fromBlock?: bigint;
  toBlock?: bigint;
  limit?: number;
}

export type EventCallback = (event: WatcherEvent) => void;

interface WatcherState {
  events: WatcherEvent[];
  lastBlock: bigint;
  startedAt: number;
}

// ============================================================
// Event Definitions
// ============================================================

interface EventSubscription {
  name: string;
  contractKey: string;
  contractAddress: Address;
  abi: any[];
  eventAbi: string;
}

function buildSubscriptions(): EventSubscription[] {
  const escrowAbi = loadAbi("TaskEscrow");
  const identityAbi = loadAbi("AgentRegistry");
  const disputeAbi = loadAbi("DisputeArbitration");

  return [
    {
      name: "TaskCreated",
      contractKey: "CovenantEscrow",
      contractAddress: CONTRACTS.TaskEscrow,
      abi: escrowAbi,
      eventAbi: "event TaskCreated(uint256 indexed taskId, address indexed client, bytes32 metaHash)",
    },
    {
      name: "TaskSubmitted",
      contractKey: "CovenantEscrow",
      contractAddress: CONTRACTS.TaskEscrow,
      abi: escrowAbi,
      eventAbi: "event TaskSubmitted(uint256 indexed taskId, address indexed worker, bytes32 deliverableHash)",
    },
    {
      name: "TaskCompleted",
      contractKey: "CovenantEscrow",
      contractAddress: CONTRACTS.TaskEscrow,
      abi: escrowAbi,
      eventAbi: "event TaskCompleted(uint256 indexed taskId, uint128 payout)",
    },
    {
      name: "AgentRegistered",
      contractKey: "CovenantIdentity",
      contractAddress: CONTRACTS.AgentRegistry,
      abi: identityAbi,
      eventAbi: "event AgentRegistered(address indexed agent, uint96 stake)",
    },
    {
      name: "DisputeCreated",
      contractKey: "CovenantArbitration",
      contractAddress: CONTRACTS.DisputeArbitration,
      abi: disputeAbi,
      eventAbi: "event DisputeCreated(uint256 indexed disputeId, uint256 indexed taskId, address indexed disputant)",
    },
  ];
}

// ============================================================
// Singleton Event Watcher
// ============================================================

const STORE_NAME = "covenant-events";
const MAX_EVENTS = 5000;
const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 60000;
const POLL_FALLBACK_MS = 15000;

class EventWatcher {
  private client: PublicClient;
  private unwatchers: (() => void)[] = [];
  private callbacks: Map<string, Set<EventCallback>> = new Map();
  private globalCallbacks: Set<EventCallback> = new Set();
  private state: WatcherState;
  private isRunning = false;
  private reconnectAttempts = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private useWebSocket: boolean;

  constructor() {
    this.client = getPublicClient();
    this.state = this.loadState();
    this.useWebSocket = this.detectWebSocketSupport();
  }

  private detectWebSocketSupport(): boolean {
    const wsUrl = RPC_URL.replace(/^http/, "ws");
    if (wsUrl.startsWith("wss://") || wsUrl.startsWith("ws://")) {
      return true;
    }
    return false;
  }

  private loadState(): WatcherState {
    const saved = loadStore<WatcherState>(STORE_NAME, {
      events: [],
      lastBlock: 0n,
      startedAt: Date.now(),
    });
    // Restore bigint from JSON
    saved.lastBlock = BigInt(saved.lastBlock || 0);
    saved.events = saved.events.map((e) => ({
      ...e,
      blockNumber: BigInt(e.blockNumber || 0),
    }));
    return saved;
  }

  private saveState(): void {
    // Serialize bigint for JSON
    const serializable = {
      ...this.state,
      lastBlock: this.state.lastBlock.toString(),
      events: this.state.events.slice(-MAX_EVENTS).map((e) => ({
        ...e,
        blockNumber: e.blockNumber.toString(),
      })),
    };
    saveStore(STORE_NAME, serializable);
  }

  // ─── Public API ──────────────────────────────────────────────

  /**
   * Start watching for contract events.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.error("[EventWatcher] Already running");
      return;
    }

    console.error("[EventWatcher] Starting...");
    this.isRunning = true;
    this.reconnectAttempts = 0;

    // Catch up on missed events since last shutdown
    await this.catchUp();

    if (this.useWebSocket) {
      await this.startWebSocketWatchers();
    } else {
      console.error("[EventWatcher] No WebSocket support, using HTTP polling");
      this.startPolling();
    }

    console.error(
      `[EventWatcher] Watching ${this.unwatchers.length} event types. ` +
      `Last block: ${this.state.lastBlock}`
    );
  }

  /**
   * Stop all watchers and persist state.
   */
  stop(): void {
    if (!this.isRunning) return;

    console.error("[EventWatcher] Stopping...");

    // Unsubscribe from all WebSocket watchers
    for (const unwatch of this.unwatchers) {
      try {
        unwatch();
      } catch {}
    }
    this.unwatchers = [];

    // Stop polling fallback
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.isRunning = false;
    this.saveState();
    console.error("[EventWatcher] Stopped");
  }

  /**
   * Subscribe to a specific event type.
   */
  subscribe(eventName: string, callback: EventCallback): () => void {
    if (!this.callbacks.has(eventName)) {
      this.callbacks.set(eventName, new Set());
    }
    this.callbacks.get(eventName)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.callbacks.get(eventName)?.delete(callback);
    };
  }

  /**
   * Subscribe to all events.
   */
  subscribeAll(callback: EventCallback): () => void {
    this.globalCallbacks.add(callback);
    return () => {
      this.globalCallbacks.delete(callback);
    };
  }

  /**
   * Query events from persistent store with optional filters.
   */
  getRecentEvents(filter: EventFilter = {}): WatcherEvent[] {
    let events = [...this.state.events];

    if (filter.eventName) {
      events = events.filter((e) => e.eventName === filter.eventName);
    }
    if (filter.contract) {
      events = events.filter((e) => e.contract === filter.contract);
    }
    if (filter.fromBlock !== undefined) {
      events = events.filter((e) => e.blockNumber >= filter.fromBlock!);
    }
    if (filter.toBlock !== undefined) {
      events = events.filter((e) => e.blockNumber <= filter.toBlock!);
    }

    // Return most recent first
    events.reverse();

    if (filter.limit && filter.limit > 0) {
      events = events.slice(0, filter.limit);
    }

    return events;
  }

  /**
   * Get watcher stats.
   */
  getStats(): {
    totalEvents: number;
    lastBlock: string;
    isRunning: boolean;
    useWebSocket: boolean;
    reconnectAttempts: number;
  } {
    return {
      totalEvents: this.state.events.length,
      lastBlock: this.state.lastBlock.toString(),
      isRunning: this.isRunning,
      useWebSocket: this.useWebSocket,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  // ─── Internal ────────────────────────────────────────────────

  /**
   * Catch up on events missed while the watcher was stopped.
   */
  private async catchUp(): Promise<void> {
    try {
      const currentBlock = await this.client.getBlockNumber();

      if (this.state.lastBlock === 0n) {
        // First run — start from current block
        this.state.lastBlock = currentBlock;
        this.saveState();
        console.error(`[EventWatcher] First run, starting from block ${currentBlock}`);
        return;
      }

      if (currentBlock <= this.state.lastBlock) {
        console.error(`[EventWatcher] No missed blocks (last: ${this.state.lastBlock}, current: ${currentBlock})`);
        return;
      }

      console.error(`[EventWatcher] Catching up blocks ${this.state.lastBlock + 1n} → ${currentBlock}`);

      // Process in batches of 500 blocks
      let from = this.state.lastBlock + 1n;
      const batchSize = 500n;

      while (from <= currentBlock) {
        const to = from + batchSize > currentBlock ? currentBlock : from + batchSize - 1n;
        await this.indexBlockRange(from, to);
        from = to + 1n;
      }

      this.saveState();
      console.error(`[EventWatcher] Caught up. Total events: ${this.state.events.length}`);
    } catch (error) {
      console.error("[EventWatcher] Catch-up error:", error);
    }
  }

  /**
   * Index events in a block range using getLogs.
   */
  private async indexBlockRange(fromBlock: bigint, toBlock: bigint): Promise<number> {
    let count = 0;
    const eventDefs = buildSubscriptions();

    // Group by contract address to batch queries
    const byAddress = new Map<string, { subscription: EventSubscription; }[]>();
    for (const def of eventDefs) {
      const key = def.contractAddress.toLowerCase();
      if (!byAddress.has(key)) byAddress.set(key, []);
      byAddress.get(key)!.push({ subscription: def });
    }

    for (const [addr, defs] of byAddress) {
      try {
        const logs = await this.client.getLogs({
          address: addr as `0x${string}`,
          fromBlock,
          toBlock,
        });

        for (const log of logs) {
          // Try to match against our known events
          for (const { subscription } of defs) {
            const parsed = this.parseKnownLog(log, subscription);
            if (parsed) {
              this.pushEvent(parsed);
              count++;
              break;
            }
          }
        }
      } catch (error) {
        console.error(`[EventWatcher] Error fetching logs for ${addr}:`, error);
      }
    }

    return count;
  }

  /**
   * Parse a log against a known event subscription.
   */
  private parseKnownLog(
    log: { address: string; topics: `0x${string}`[]; data: `0x${string}`; blockNumber: bigint | null; transactionHash: string; logIndex: number | null; },
    subscription: EventSubscription
  ): WatcherEvent | null {
    // Use viem's decodeEventLog for proper decoding
    try {
      const eventAbiItem = parseAbiItem(subscription.eventAbi);
      const decoded = decodeEventLog({
        abi: [eventAbiItem],
        data: log.data,
        topics: log.topics as [signature: `0x${string}`, ...args: `0x${string}`[]],
      });

      return {
        eventName: subscription.name,
        contract: subscription.contractKey,
        address: log.address as Address,
        blockNumber: log.blockNumber ?? 0n,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex ?? 0,
        args: decoded.args as Record<string, unknown>,
        timestamp: Date.now(),
        id: `${log.transactionHash}-${log.logIndex}`,
      };
    } catch {
      // Event signature doesn't match, skip
      return null;
    }
  }

  /**
   * Push an event to the store and notify callbacks.
   */
  private pushEvent(event: WatcherEvent): void {
    // Deduplicate by id
    if (this.state.events.some((e) => e.id === event.id)) {
      return;
    }

    this.state.events.push(event);

    // Trim old events
    if (this.state.events.length > MAX_EVENTS) {
      this.state.events = this.state.events.slice(-MAX_EVENTS);
    }

    // Update last block
    if (event.blockNumber > this.state.lastBlock) {
      this.state.lastBlock = event.blockNumber;
    }

    // Notify specific callbacks
    const specificCallbacks = this.callbacks.get(event.eventName);
    if (specificCallbacks) {
      for (const cb of specificCallbacks) {
        try {
          cb(event);
        } catch (error) {
          console.error(`[EventWatcher] Callback error for ${event.eventName}:`, error);
        }
      }
    }

    // Notify global callbacks
    for (const cb of this.globalCallbacks) {
      try {
        cb(event);
      } catch (error) {
        console.error("[EventWatcher] Global callback error:", error);
      }
    }
  }

  /**
   * Start WebSocket watchers using viem's watchContractEvent.
   */
  private async startWebSocketWatchers(): Promise<void> {
    const eventDefs = buildSubscriptions();

    for (const def of eventDefs) {
      try {
        const eventAbiItem = parseAbiItem(def.eventAbi);
        const unwatch = this.client.watchContractEvent(
          {
            address: def.contractAddress,
            abi: [eventAbiItem],
            eventName: def.name as any,
            onLogs: (logs) => {
              this.reconnectAttempts = 0;
              for (const log of logs) {
                const event: WatcherEvent = {
                  eventName: def.name,
                  contract: def.contractKey,
                  address: log.address,
                  blockNumber: log.blockNumber,
                  transactionHash: log.transactionHash,
                  logIndex: log.logIndex,
                  args: log.args as Record<string, unknown>,
                  timestamp: Date.now(),
                  id: `${log.transactionHash}-${log.logIndex}`,
                };
                this.pushEvent(event);
              }
              this.saveState();
            },
            onError: (error) => {
              console.error(`[EventWatcher] WebSocket error for ${def.name}:`, error.message);
              this.handleDisconnect();
            },
          }
        );

        this.unwatchers.push(unwatch as unknown as () => void);
      } catch (error) {
        console.error(`[EventWatcher] Failed to watch ${def.name}:`, error);
      }
    }
  }

  /**
   * Handle WebSocket disconnect with exponential backoff reconnection.
   */
  private handleDisconnect(): void {
    if (!this.isRunning) return;

    this.stop();
    this.reconnectAttempts++;

    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempts - 1),
      RECONNECT_MAX_MS
    );

    console.error(
      `[EventWatcher] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`
    );

    setTimeout(async () => {
      if (this.isRunning) return;
      this.isRunning = true;
      await this.start();
    }, delay);
  }

  /**
   * Fallback HTTP polling when WebSocket is unavailable.
   */
  private startPolling(): void {
    this.pollTimer = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const currentBlock = await this.client.getBlockNumber();
        if (currentBlock <= this.state.lastBlock) return;

        await this.indexBlockRange(this.state.lastBlock + 1n, currentBlock);
        this.saveState();
      } catch (error) {
        console.error("[EventWatcher] Poll error:", error);
      }
    }, POLL_FALLBACK_MS);
  }
}

// ============================================================
// Export singleton
// ============================================================

export const eventWatcher = new EventWatcher();
