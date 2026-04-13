/**
 * StripeIntegrationChecker - Validates Stripe test checkout works
 * For criterion type: "stripe_integration"
 */

import { CheckResult } from "./GenericChecker.js";

const MAX_SCORE = 100;

/**
 * Check Stripe test checkout session creation
 */
async function checkStripeCheckout(
  url: string,
  body: any,
  expectedStatus: number,
  expectedBodyContains: string[] | string,
  timeoutSeconds: number = 10
): Promise<{
  status: number;
  responseTime: number;
  ok: boolean;
  body: any;
  error?: string
}> {
  const startTime = Date.now();
  const timeoutMs = timeoutSeconds * 1000;
  const headers: HeadersInit = {
    'User-Agent': 'COVENANT-VerifierBot/1.0',
    'Content-Type': 'application/json'
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers,
      body: JSON.stringify(body)
    });

    const responseTime = Date.now() - startTime;

    let responseBody: any = null;
    try {
      responseBody = await response.json();
    } catch (e) {
      // Not JSON, try text
      responseBody = await response.text();
    }

    return {
      status: response.status,
      responseTime,
      ok: response.status === expectedStatus,
      body: responseBody,
      error: response.status !== expectedStatus
        ? `Expected status ${expectedStatus}, got ${response.status}`
        : undefined
    };
  } catch (error: any) {
    return {
      status: 0,
      responseTime: Date.now() - startTime,
      ok: false,
      body: null,
      error: error.message || 'Request failed'
    };
  }
}

/**
 * Score Stripe checkout check result
 */
function scoreStripeCheck(
  result: {
    status: number;
    responseTime: number;
    ok: boolean;
    body: any;
    error?: string
  },
  containsCheck: { found: boolean; missing: string[] }
): number {
  let score = 0;

  // Status code match (0-50 points)
  if (result.ok) {
    score += 50;
  } else if (result.status >= 200 && result.status < 400) {
    // Partial credit for valid HTTP status
    score += 25;
  }

  // Response time (0-20 points)
  if (result.responseTime < 500) {
    score += 20;
  } else if (result.responseTime < 1000) {
    score += 15;
  } else if (result.responseTime < 2000) {
    score += 10;
  } else if (result.responseTime < 5000) {
    score += 5;
  }

  // Body content check (0-30 points)
  if (containsCheck.found) {
    score += 30;
  } else if (containsCheck.missing.length > 0) {
    // Partial credit for some matches
    score += Math.max(0, 30 - (containsCheck.missing.length * 6));
  }

  return Math.min(100, score);
}

/**
 * Check Stripe test checkout works
 */
export async function check(
  deliverable: any,
  taskDescription?: string
): Promise<CheckResult> {
  // Extract Stripe checkout details from deliverable
  const url = deliverable.url;
  const body = deliverable.body;
  const expectedStatus = deliverable.expected_status ?? 200;
  const expectedBodyContains = deliverable.expected_body_contains;
  const timeoutSeconds = deliverable.timeout_seconds ?? 10;

  if (!url) {
    return {
      score: 0,
      maxScore: MAX_SCORE,
      passed: false,
      details: 'No URL provided for Stripe checkout check',
      evidence: { url: null }
    };
  }

  console.log(`[StripeIntegrationChecker] Checking Stripe checkout at: ${url}`);

  const result = await checkStripeCheckout(
    url,
    body,
    expectedStatus,
    expectedBodyContains,
    timeoutSeconds
  );

  const containsCheck = expectedBodyContains
    ? checkBodyContains(result.body, expectedBodyContains)
    : { found: true, missing: [] };

  const score = scoreStripeCheck(result, containsCheck);

  let details = `Status: ${result.status}`;
  if (result.error) {
    details += `, Error: ${result.error}`;
  }
  details += `, Response time: ${result.responseTime}ms`;

  if (!containsCheck.found) {
    details += `, Missing: ${containsCheck.missing.join(', ')}`;
  }

  const passed = result.ok && containsCheck.found && score >= 70;

  if (!passed) {
    details += ` (FAILED)`;
  }

  return {
    score,
    maxScore: MAX_SCORE,
    passed,
    details,
    evidence: {
      status: result.status,
      responseTime: result.responseTime,
      body: result.body,
      containsCheck
    }
  };
}

/**
 * Helper function to check if body contains expected strings/arrays
 */
function checkBodyContains(body: any, expected: string[] | string): { found: boolean; missing: string[] } {
  if (typeof expected === 'string') {
    expected = [expected];
  }

  const missing: string[] = [];
  const bodyStr = JSON.stringify(body);

  for (const str of expected) {
    if (!bodyStr.includes(str)) {
      missing.push(str);
    }
  }

  return { found: missing.length === 0, missing };
}

/**
 * Can this checker handle this deliverable?
 */
export function canHandle(deliverable: any): boolean {
  return !!(deliverable.url);
}