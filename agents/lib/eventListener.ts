import { createPublicClient, webSocket, Address, type Abi } from 'viem';

export type EventHandler = (event: {
  eventName: string;
  args: any;
  transactionHash: `0x${string}`;
  blockNumber: number;
  logIndex: number;
  address: Address;
}) => void;

interface Subscription {
  address: Address;
  abi: Abi;
  eventName: string;
  handler: EventHandler;
}

/**
 * EventListener - Sets up WebSocket connection to listen for contract events
 * with automatic reconnection, historical replay, and graceful shutdown.
 */
export class EventListener {
  private publicClient: ReturnType<typeof createPublicClient>;
  private subscriptions: Array<() => void> = [];
  private pendingSubscriptions: Subscription[] = [];
  private rpcUrl: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000; // 1 second
  private maxReconnectDelay = 30000; // 30 seconds
  private isConnecting = false;
  private stopped = false;

  constructor(rpcUrl: string) {
    this.rpcUrl = rpcUrl;
    this.publicClient = createPublicClient({
      transport: webSocket(rpcUrl),
    });
  }

  /**
   * Subscribe to events from a contract.
   * If the WebSocket is disconnected, the subscription is queued
   * and re-established automatically on reconnect.
   */
  subscribe(
    address: Address,
    abi: Abi,
    eventName: string,
    handler: EventHandler
  ): void {
    const sub: Subscription = { address, abi, eventName, handler };
    this.pendingSubscriptions.push(sub);

    if (!this.isConnecting && !this.stopped) {
      this._subscribe(sub);
    }
  }

  /**
   * Fetch historical events since a given block and replay them through the handler.
   * Useful for catching up after downtime or on startup.
   */
  async replayHistorical(
    address: Address,
    abi: Abi,
    eventName: string,
    handler: EventHandler,
    fromBlock: bigint
  ): Promise<void> {
    try {
      const logs = await this.publicClient.getLogs({
        address,
        event: abi.find((item: any) => item.type === 'event' && item.name === eventName) as any,
        fromBlock,
        toBlock: 'latest',
      });

      for (const log of logs) {
        handler({
          eventName,
          args: (log as any).args || {},
          transactionHash: log.transactionHash,
          blockNumber: Number(log.blockNumber),
          logIndex: Number(log.logIndex),
          address: log.address,
        });
      }

      console.log(`[EventListener] Replayed ${logs.length} historical ${eventName} events from block ${fromBlock}`);
    } catch (error) {
      console.error(`[EventListener] Error replaying historical ${eventName}:`, error);
    }
  }

  /**
   * Stop all event subscriptions and cancel reconnection.
   */
  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    console.log('[EventListener] Stopping all subscriptions');
    this.subscriptions.forEach(unsub => unsub());
    this.subscriptions = [];
  }

  // ---- internals ----

  private _subscribe(sub: Subscription): void {
    console.log(`[EventListener] Subscribing to ${sub.eventName} on ${sub.address}`);

    const unsubscribe = this.publicClient.watchContractEvent(
      {
        address: sub.address,
        abi: sub.abi,
        eventName: sub.eventName,
        onLogs: (logs: any[]) => {
          // Successful connection — reset reconnect state
          this.reconnectAttempts = 0;
          this.isConnecting = false;

          for (const log of logs) {
            sub.handler({
              eventName: (log as any).eventName || sub.eventName,
              args: (log as any).args || {},
              transactionHash: (log as any).transactionHash,
              blockNumber: Number((log as any).blockNumber),
              logIndex: Number((log as any).logIndex),
              address: (log as any).address,
            });
          }
        },
        onError: (error: any) => {
          console.error(`[EventListener] Error watching ${sub.eventName}:`, error);
          this._handleDisconnect();
        },
      },
    );

    this.subscriptions.push(unsubscribe);
  }

  private _handleDisconnect(): void {
    if (this.stopped || this.isConnecting) return;
    this.isConnecting = true;

    // Tear down current subscriptions
    this.subscriptions.forEach(unsub => unsub());
    this.subscriptions = [];

    this.reconnectAttempts++;
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error(`[EventListener] Max reconnect attempts (${this.maxReconnectAttempts}) reached. Giving up.`);
      this.isConnecting = false;
      return;
    }

    // Exponential backoff with jitter
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );
    const jitter = Math.random() * delay * 0.2;
    const wait = Math.round(delay + jitter);

    console.log(`[EventListener] Reconnecting in ${wait}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      if (this.stopped) return;

      // Recreate the transport
      this.publicClient = createPublicClient({
        transport: webSocket(this.rpcUrl),
      });

      // Re-establish all queued subscriptions
      for (const sub of this.pendingSubscriptions) {
        this._subscribe(sub);
      }
      this.isConnecting = false;
    }, wait);
  }
}
