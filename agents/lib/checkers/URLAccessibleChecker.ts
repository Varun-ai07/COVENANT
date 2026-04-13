/**
 * URLAccessibleChecker - Validates URL accessibility and HTTP status
 * For criterion type: "url_accessible"
 */

import { CheckResult } from "./GenericChecker.js";

const MAX_SCORE = 100;

/**
 * Perform HTTP check on a URL with specific expectations
 */
async function checkUrl(
  url: string,
  expectedStatus: number,
  timeoutSeconds: number = 10
): Promise<{ status: number; responseTime: number; ok: boolean; error?: string }> {
  const startTime = Date.now();
  const timeoutMs = timeoutSeconds * 1000;

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': 'COVENANT-VerifierBot/1.0',
      },
    });

    const responseTime = Date.now() - startTime;
    return {
      status: response.status,
      responseTime,
      ok: response.status === expectedStatus,
      error: response.status !== expectedStatus
        ? `Expected status ${expectedStatus}, got ${response.status}`
        : undefined
    };
  } catch (error: any) {
    return {
      status: 0,
      responseTime: Date.now() - startTime,
      ok: false,
      error: error.message || 'Request failed'
    };
  }
}

/**
 * Score URL check result
 */
function scoreUrlCheck(result: { status: number; responseTime: number; ok: boolean; error?: string }): number {
  let score = 0;

  // Status code match (0-60 points)
  if (result.ok) {
    score += 60;
  } else if (result.status >= 200 && result.status < 400) {
    // Partial credit for valid HTTP status
    score += 30;
  }

  // Response time (0-40 points)
  if (result.responseTime < 500) {
    score += 40;
  } else if (result.responseTime < 1000) {
    score += 30;
  } else if (result.responseTime < 2000) {
    score += 20;
  } else if (result.responseTime < 5000) {
    score += 10;
  }

  return Math.min(100, score);
}

/**
 * Check if a URL is accessible with expected status
 */
export async function check(
  deliverable: any,
  taskDescription?: string
): Promise<CheckResult> {
  // Extract URL from deliverable or task description
  // The spec check.config should have the URL, but we need to get it from the criterion
  // This checker will be called with the criterion config embedded in the deliverable context
  // For now, we'll expect the URL to be in deliverable.url or similar

  // Actually, the criterion config will be passed separately in the verification flow
  // This checker needs to be adapted to receive the criterion config

  // For now, let's make a simplified version that expects the criterion data in the deliverable
  // In practice, the verifier will pass the criterion config to the checker

  const url = deliverable.url || deliverable.endpoint || deliverable.website;
  const expectedStatus = deliverable.expected_status ?? 200;
  const timeoutSeconds = deliverable.timeout_seconds ?? 10;

  if (!url) {
    return {
      score: 0,
      maxScore: MAX_SCORE,
      passed: false,
      details: 'No URL provided for URL accessibility check',
      evidence: { url: null }
    };
  }

  console.log(`[URLAccessibleChecker] Checking URL: ${url} (expected status: ${expectedStatus})`);

  const result = await checkUrl(url, expectedStatus, timeoutSeconds);
  const score = scoreUrlCheck(result);

  let details = `Status: ${result.status}`;
  if (result.error) {
    details += `, Error: ${result.error}`;
  }
  details += `, Response time: ${result.responseTime}ms`;

  const passed = result.ok && score >= 70; // Must have correct status and decent score

  if (!passed) {
    details += ` (FAILED)`;
  }

  return {
    score,
    maxScore: MAX_SCORE,
    passed,
    details,
    evidence: result
  };
}

/**
 * Can this checker handle this deliverable?
 */
export function canHandle(deliverable: any): boolean {
  return !!(deliverable.url || deliverable.endpoint || deliverable.website);
}