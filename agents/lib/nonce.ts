/**
 * NonceManager - Manages nonces for parallel transaction submission
 * Allows sending multiple transactions without waiting for confirmations
 */

export class NonceManager {
  private nonce: bigint | null = null;
  private initialized = false;

  /**
   * Get the next nonce, initializing if needed
   */
  async getNextNonce(publicClient: any, address: string): Promise<bigint> {
    if (!this.initialized) {
      const currentNonce = await publicClient.getNonce({ address });
      this.nonce = BigInt(currentNonce);
      this.initialized = true;
    }

    if (this.nonce === null) {
      throw new Error("NonceManager not initialized");
    }

    const current = this.nonce;
    this.nonce++;
    return current;
  }

  /**
   * Reset nonce to current on-chain value (useful after errors)
   */
  async reset(publicClient: any, address: string): Promise<void> {
    const currentNonce = await publicClient.getNonce({ address });
    this.nonce = BigInt(currentNonce);
  }

  /**
   * Peek at the next nonce without incrementing
   */
  peek(): bigint {
    if (this.nonce === null) {
      throw new Error("NonceManager not initialized");
    }
    return this.nonce;
  }

  /**
   * Force set nonce (for recovery scenarios)
   */
  forceSet(nonce: bigint): void {
    this.nonce = nonce;
  }
}
