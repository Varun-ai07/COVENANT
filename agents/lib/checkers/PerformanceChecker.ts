/**
 * PerformanceChecker - Validates API response time under load
 * For criterion type: "performance"
 */

import { CheckResult } from "./GenericChecker.js";

const MAX_SCORE = 100;

/**
 * Perform load test on an endpoint
 * This is a simplified version - in production, you'd use k6 or artillery
 */
async function loadTest(
  url: string,
  requests: number,
  concurrency: number,
  maxAvgResponseMs: number,
  timeoutSeconds: number = 30
): Promise<{
  success: boolean;
  avgResponseMs: number;
  p95ResponseMs: number;
  error?: string
}> {
  const startTime = Date.now();
  const timeoutMs = timeoutSeconds * 1000;

  // Simplified load test - make requests sequentially with concurrency simulation
  // In reality, this would be much more sophisticated
  const responseTimes: number[] = [];
  let failedRequests = 0;

  try {
    // Create batches of concurrent requests
    for (let batchStart = 0; batchStart < requests; batchStart += concurrency) {
      const batchEnd = Math.min(batchStart + concurrency, requests);
      const batchSize = batchEnd - batchStart;

      // Fire off batchSize requests concurrently
      const batchPromises = Array.from({ length: batchSize }, (_, i) =>
        fetch(url + (url.includes('?') ? '&' : '?') + `req=${batchStart + i}`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000), // 5s per request timeout
          headers: {
            'User-Agent': 'COVENANT-VerifierBot/1.0',
          },
        })
      );

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          try {
            const response = await result.value;
            const responseTime = Date.now() - startTime - (batchStart * 10); // Rough estimate
            responseTimes.push(responseTime);
          } catch (e) {
            failedRequests++;
          }
        } else {
          failedRequests++;
        }
      }

      // Small delay between batches to avoid overwhelming
      if (batchEnd < requests) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  } catch (error: any) {
    return {
      success: false,
      avgResponseMs: 0,
      p95ResponseMs: 0,
      error: error.message || 'Load test failed'
    };
  }

  const totalTime = Date.now() - startTime;
  if (responseTimes.length === 0) {
    return {
      success: false,
      avgResponseMs: 0,
      p95ResponseMs: 0,
      error: 'No successful requests'
    };
  }

  // Calculate average response time
  const avgResponseMs = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;

  // Calculate P95 response time
  const sortedTimes = [...responseTimes].sort((a, b) => a - b);
  const p95Index = Math.ceil(0.95 * sortedTimes.length) - 1;
  const p95ResponseMs = sortedTimes[Math.max(0, p95Index)];

  const success = avgResponseMs <= maxAvgResponseMs && failedRequests === 0;

  return {
    success,
    avgResponseMs,
    p95ResponseMs,
    error: !success ? `Avg response ${avgResponseMs.toFixed(0)}ms > ${maxAvgResponseMs}ms` : undefined
  };
}

/**
 * Score performance check result
 */
function scorePerformanceCheck(
  result: {
    success: boolean;
    avgResponseMs: number;
    p95ResponseMs: number;
    error?: string
  },
  maxAvgResponseMs: number
): number {
  let score = 0;

  // Success/failure (0-50 points)
  if (result.success) {
    score += 50;
  } else if (result.avgResponseMs > 0) {
    // Partial credit for having some response
    score += 25;
  }

  // Response time score (0-50 points)
  if (result.avgResponseMs <= maxAvgResponseMs) {
    score += 50;
  } else {
    // Linear scaling: 0 points at 2x max, 50 points at max
    const ratio = Math.min(2, result.avgResponseMs / maxAvgResponseMs);
    score += Math.max(0, 50 * (2 - ratio));
  }

  return Math.min(100, score);
}

/**
 * Check API performance under load
 */
export async function check(
  deliverable: any,
  taskDescription?: string
): Promise<CheckResult> {
  // Extract performance check details from deliverable
  const url = deliverable.url;
  const requests = deliverable.requests ?? 100;
  const concurrency = deliverable.concurrency ?? 10;
  const maxAvgResponseMs = deliverable.max_avg_response_ms ?? 500;
  const timeoutSeconds = deliverable.timeout_seconds ?? 30;

  if (!url) {
    return {
      score: 0,
      maxScore: MAX_SCORE,
      passed: false,
      details: 'No URL provided for performance check',
      evidence: { url: null }
    };
  }

  console.log(`[PerformanceChecker] Load testing ${url} (${requests} reqs, ${concurrency} concurrency, max ${maxAvgResponseMs}ms)`);

  const result = await loadTest(
    url,
    requests,
    concurrency,
    maxAvgResponseMs,
    timeoutSeconds
  );

  const score = scorePerformanceCheck(result, maxAvgResponseMs);

  let details = `Avg response: ${result.avgResponseMs.toFixed(0)}ms`;
  if (result.p95ResponseMs > 0) {
    details += `, P95: ${result.p95ResponseMs.toFixed(0)}ms`;
  }
  if (result.error) {
    details += `, Error: ${result.error}`;
  }
  details += `, Target: <${maxAvgResponseMs}ms`;

  const passed = result.success && score >= 70;

  if (!passed) {
    details += ` (FAILED)`;
  }

  return {
    score,
    maxScore: MAX_SCORE,
    passed,
    details,
    evidence: {
      success: result.success,
      avgResponseMs: result.avgResponseMs,
      p95ResponseMs: result.p95ResponseMs,
      requests,
      concurrency
    }
  };
}

/**
 * Can this checker handle this deliverable?
 */
export function canHandle(deliverable: any): boolean {
  return !!(deliverable.url);
}