/**
 * FullStackChecker - Validates deployed URLs and APIs
 * Checks: HTTP status, response time, content type, security headers
 */

import { CheckResult } from "./GenericChecker.js";

const MAX_SCORE = 100;

interface HttpCheckResult {
  status: number;
  responseTime: number;
  contentType?: string;
  securityHeaders: Record<string, string>;
  ok: boolean;
}

/**
 * Perform HTTP check on a URL
 */
async function checkUrl(url: string, timeoutMs: number = 10000): Promise<HttpCheckResult> {
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': 'COVENANT-VerifierBot/1.0',
      },
    });

    const responseTime = Date.now() - startTime;

    const securityHeaders: Record<string, string> = {};
    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase().startsWith('x-') || key.toLowerCase() === 'content-security-policy') {
        securityHeaders[key] = value;
      }
    }

    const contentType = response.headers.get('content-type');
    return {
      status: response.status,
      responseTime,
      contentType: contentType ?? undefined,
      securityHeaders,
      ok: response.ok,
    };
  } catch (error: any) {
    return {
      status: 0,
      responseTime: Date.now() - startTime,
      ok: false,
      securityHeaders: {},
    };
  }
}

/**
 * Score HTTP check result
 */
function scoreHttpCheck(result: HttpCheckResult): number {
  let score = 0;

  // Status code (0-30 points)
  if (result.status === 200) {
    score += 30;
  } else if (result.status >= 200 && result.status < 300) {
    score += 25;
  } else if (result.status >= 300 && result.status < 400) {
    score += 15; // Redirects are okay but not ideal
  } else if (result.status >= 400 && result.status < 500) {
    score += 5;  // Client error
  }

  // Response time (0-30 points)
  if (result.responseTime < 500) score += 30;
  else if (result.responseTime < 1000) score += 25;
  else if (result.responseTime < 2000) score += 15;
  else if (result.responseTime < 5000) score += 5;

  // Security headers (0-20 points)
  const requiredHeaders = ['x-content-type-options', 'x-frame-options', 'strict-transport-security'];
  const present = requiredHeaders.filter(h => result.securityHeaders?.[h] || result.securityHeaders?.[h.toLowerCase()]);
  score += (present.length / requiredHeaders.length) * 20;

  // Content type check (0-20 points)
  if (result.contentType && result.contentType.includes('text/html')) {
    score += 15;
  } else if (result.contentType) {
    score += 10;
  }

  return Math.min(100, score);
}

/**
 * Check for a deployed URL in the deliverable
 */
export async function check(
  deliverable: any,
  _taskDescription?: string
): Promise<CheckResult> {
  console.log("[FullStackChecker] Checking for deployable URL...");

  // Look for URL in common places
  const url = deliverable.url || deliverable.deployedUrl || deliverable.endpoint || deliverable.website;

  if (!url) {
    return {
      score: 0,
      maxScore: MAX_SCORE,
      passed: false,
      details: 'No URL found in deliverable - skip FullStackCheck',
      evidence: { url: null, reason: 'not_present' },
    };
  }

  console.log(`[FullStackChecker] Testing URL: ${url}`);

  const httpCheck = await checkUrl(url);

  const score = scoreHttpCheck(httpCheck);
  const passed = score >= 70 && httpCheck.ok;

  let details = `Status: ${httpCheck.status}, Response time: ${httpCheck.responseTime}ms`;
  if (httpCheck.contentType) {
    details += `, Content-Type: ${httpCheck.contentType}`;
  }
  if (Object.keys(httpCheck.securityHeaders).length > 0) {
    details += `, Security headers: ${Object.keys(httpCheck.securityHeaders).join(', ')}`;
  }

  if (!passed) {
    details += ` (FAILED)`;
  }

  return {
    score,
    maxScore: MAX_SCORE,
    passed,
    details,
    evidence: httpCheck,
  };
}

/**
 * Can this checker handle this deliverable?
 */
export function canHandle(deliverable: any): boolean {
  return !!(deliverable.url || deliverable.deployedUrl || deliverable.endpoint || deliverable.website);
}
