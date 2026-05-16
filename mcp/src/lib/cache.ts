/**
 * RPC Response Cache - Reduces blockchain RPC traffic with TTL-based caching
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: string;
}

export class RPCCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private stats = { hits: 0, misses: 0 };

  // Default TTLs by data type (in milliseconds)
  private defaultTTLs: Record<string, number> = {
    // Agent data changes rarely - cache longer
    agent: 5 * 60 * 1000,        // 5 minutes
    agentProfile: 5 * 60 * 1000, // 5 minutes
    agentCount: 60 * 1000,        // 1 minute

    // Task data changes frequently during execution
    task: 30 * 1000,             // 30 seconds
    taskCount: 30 * 1000,        // 30 seconds
    clientTasks: 30 * 1000,      // 30 seconds
    workerTasks: 30 * 1000,      // 30 seconds

    // Collective/insurance data
    collective: 60 * 1000,       // 1 minute
    insurance: 60 * 1000,        // 1 minute
    poolBalance: 30 * 1000,      // 30 seconds

    // Protocol stats - cache briefly
    stats: 60 * 1000,            // 1 minute
    leaderboard: 60 * 1000,      // 1 minute

    // Batch data
    batch: 30 * 1000,            // 30 seconds
    batchStatus: 30 * 1000,      // 30 seconds

    // Disputes
    dispute: 60 * 1000,          // 1 minute

    // Receipts - immutable once created
    receipt: 10 * 60 * 1000,     // 10 minutes

    // Default
    default: 30 * 1000,          // 30 seconds
  };

  /**
   * Get cached value or fetch and cache
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    category?: string
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      this.stats.hits++;
      return cached;
    }

    this.stats.misses++;
    const data = await fetcher();
    const ttl = category ? (this.defaultTTLs[category] || this.defaultTTLs.default) : this.defaultTTLs.default;
    this.set(key, data, ttl);
    return data;
  }

  /**
   * Get from cache (returns null if not found or expired)
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data;
  }

  /**
   * Set cache entry
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTLs.default
    });
  }

  /**
   * Invalidate specific key(s) by pattern
   */
  invalidate(pattern: string): number {
    let deleted = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  /**
   * Invalidate all entries matching a task (for task updates)
   */
  invalidateTask(taskId: number): void {
    this.invalidate(`task:${taskId}`);
    this.invalidate(`clientTasks`);
    this.invalidate(`workerTasks`);
    this.invalidate(`taskCount`);
    this.invalidate(`stats`);
  }

  /**
   * Invalidate all entries matching an agent (for agent updates)
   */
  invalidateAgent(address: string): void {
    this.invalidate(`agent:${address.toLowerCase()}`);
    this.invalidate(`agentCount`);
    this.invalidate(`leaderboard`);
    this.invalidate(`stats`);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: total > 0 ? `${((this.stats.hits / total) * 100).toFixed(1)}%` : "0%"
    };
  }

  /**
   * Clean expired entries (call periodically)
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }
}

// Singleton instance
export const rpcCache = new RPCCache();

// Cleanup interval (every 5 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const cleaned = rpcCache.cleanup();
    if (cleaned > 0) {
      console.error(`[Cache] Cleaned ${cleaned} expired entries`);
    }
  }, 5 * 60 * 1000);
}
