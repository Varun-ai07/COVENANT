import { createPublicClient, webSocket, Address } from 'viem';
import { Abi } from 'viem';

export type EventHandler = (event: {
  eventName: string;
  args: any;
  transactionHash: `0x${string}`;
  blockNumber: number;
  logIndex: number;
  address: Address;
}) => void;

/**
 * EventListener - Sets up WebSocket connection to listen for contract events
 * Replaces polling-based monitoring with event-driven architecture
 */
export class EventListener {
  private publicClient: any;
  private subscriptions: Array<() => void> = [];

  constructor(rpcUrl: string) {
    this.publicClient = createPublicClient({
      transport: webSocket(rpcUrl),
    });
  }

  /**
   * Subscribe to events from a contract
   * @param address Contract address
   * @param abi Contract ABI
   * @param eventName Name of the event to listen for
   * @param handler Callback function to handle the event
   */
  subscribe(
    address: Address,
    abi: Abi,
    eventName: string,
    handler: EventHandler
  ): void {
    console.log(`[EventListener] Subscribing to ${eventName} on ${address}`);

    const unsubscribe = this.publicClient.watchContractEvent(
      {
        address,
        abi,
        eventName,
        onEvent: (event: any) => {
          // Normalize event structure
          handler({
            eventName: event.eventName,
            args: event.args,
            transactionHash: event.transactionHash,
            blockNumber: event.blockNumber,
            logIndex: event.logIndex,
            address: event.address,
          });
        },
      },
      (error: any) => {
        console.error(`[EventListener] Error watching ${eventName}:`, error);
        // Could implement reconnection logic here
      }
    );

    this.subscriptions.push(unsubscribe);
  }

  /**
   * Stop all event subscriptions
   */
  stop(): void {
    console.log('[EventListener] Stopping all subscriptions');
    this.subscriptions.forEach(unsub => unsub());
    this.subscriptions = [];
  }
}
