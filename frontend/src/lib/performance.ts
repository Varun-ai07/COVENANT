// Performance optimization utilities

// Lazy loading helper
export const lazyLoad = <T>(importFn: () => Promise<T>) => {
  return importFn();
};

// Memoization utility
export const memoize = <T extends (...args: any[]) => any>(
  fn: T,
  maxSize = 100
): ((...args: Parameters<T>) => ReturnType<T>) => {
  const cache = new Map<string, ReturnType<T>>();

  return (...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    cache.set(key, result);
    return result;
  };
};

// Debounce utility
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Throttle utility
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Web Worker for heavy computations
export class ComputationWorker {
  private worker: Worker;

  constructor(scriptURL: string) {
    this.worker = new Worker(scriptURL, { type: 'module' });
  }

  postMessage<T>(message: T) {
    this.worker.postMessage(message);
  }

  onMessage<T>(callback: (event: MessageEvent<T>) => void) {
    this.worker.onmessage = callback;
  }

  terminate() {
    this.worker.terminate();
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private marks: Map<string, number> = new Map();

  mark(name: string) {
    this.marks.set(name, performance.now());
  }

  measure(name: string, start: string, end: string): number {
    const startMark = this.marks.get(start);
    const endMark = this.marks.get(end);

    if (startMark && endMark) {
      return endMark - startMark;
    }
    return 0;
  }

  logPerformance(name: string, duration: number) {
    if (duration > 100) {
      console.warn(`Performance warning: ${name} took ${duration.toFixed(2)}ms`);
    }
  }
}