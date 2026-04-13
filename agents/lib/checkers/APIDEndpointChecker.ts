/**
 * APIDEndpointChecker - Validates API endpoints and their responses
 * For criterion type: "api_endpoint"
 */

import { CheckResult } from "./GenericChecker.js";

const MAX_SCORE = 100;

/**
 * Perform HTTP request to API endpoint with specific expectations
 */
async function checkApiEndpoint(
  method: string,
  url: string,
  body: any | undefined,
  authRequired: boolean,
  expectedStatus: number,
  expectedBodySchema: any | undefined,
  expectedBodyContains: string[] | string | undefined,
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

  // Note: In a real implementation, we would handle authentication here
  // For now, we'll skip auth as it would require specific token handling

  try {
    const requestInit: RequestInit = {
      method,
      signal: AbortSignal.timeout(timeoutMs),
      headers
    };

    if (body !== undefined && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestInit);
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
 * Validate response body against expected schema
 */
function validateBodySchema(body: any, schema: any): { valid: boolean; error?: string } {
  // Simple schema validation - in production, use a proper JSON schema validator
  if (!schema) return { valid: true };

  // Handle basic type checks
  if (schema.type === 'array') {
    if (!Array.isArray(body)) {
      return { valid: false, error: `Expected array, got ${typeof body}` };
    }
    if (schema.minItems !== undefined && body.length < schema.minItems) {
      return { valid: false, error: `Expected at least ${schema.minItems} items, got ${body.length}` };
    }
    return { valid: true };
  }

  if (schema.type === 'object') {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return { valid: false, error: `Expected object, got ${typeof body}` };
    }
    // Could add more specific property validation here
    return { valid: true };
  }

  // For simplicity, accept other types as valid
  return { valid: true };
}

/**
 * Check if body contains expected strings/arrays
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
 * Score API endpoint check result
 */
function scoreApiCheck(
  result: {
    status: number;
    responseTime: number;
    ok: boolean;
    body: any;
    error?: string
  },
  schemaValid: { valid: boolean; error?: string },
  containsCheck: { found: boolean; missing: string[] }
): number {
  let score = 0;

  // Status code match (0-40 points)
  if (result.ok) {
    score += 40;
  } else if (result.status >= 200 && result.status < 400) {
    // Partial credit for valid HTTP status
    score += 20;
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

  // Schema validation (0-20 points)
  if (schemaValid.valid) {
    score += 20;
  } else if (schemaValid.error) {
    // Partial credit if we got a response
    if (result.body !== null) {
      score += 10;
    }
  }

  // Body content check (0-20 points)
  if (containsCheck.found) {
    score += 20;
  } else if (containsCheck.missing.length > 0) {
    // Partial credit for some matches
    score += Math.max(0, 20 - (containsCheck.missing.length * 5));
  }

  return Math.min(100, score);
}

/**
 * Check API endpoint against specification
 */
export async function check(
  deliverable: any,
  taskDescription?: string
): Promise<CheckResult> {
  // Extract API endpoint details from deliverable
  // In practice, these would come from the criterion config
  // For this implementation, we expect them to be in the deliverable

  const method = deliverable.method ?? 'GET';
  const url = deliverable.url || deliverable.endpoint;
  const body = deliverable.body;
  const authRequired = deliverable.auth_required ?? false;
  const expectedStatus = deliverable.expected_status ?? 200;
  const expectedBodySchema = deliverable.expected_body_schema;
  const expectedBodyContains = deliverable.expected_body_contains;
  const timeoutSeconds = deliverable.timeout_seconds ?? 10;

  if (!url) {
    return {
      score: 0,
      maxScore: MAX_SCORE,
      passed: false,
      details: 'No URL provided for API endpoint check',
      evidence: { url: null }
    };
  }

  console.log(`[APIDEndpointChecker] Checking ${method} ${url} (expected status: ${expectedStatus})`);

  const result = await checkApiEndpoint(
    method,
    url,
    body,
    authRequired,
    expectedStatus,
    expectedBodySchema,
    expectedBodyContains,
    timeoutSeconds
  );

  const schemaValid = expectedBodySchema
    ? validateBodySchema(result.body, expectedBodySchema)
    : { valid: true };

  const containsCheck = expectedBodyContains
    ? checkBodyContains(result.body, expectedBodyContains)
    : { found: true, missing: [] };

  const score = scoreApiCheck(result, schemaValid, containsCheck);

  let details = `Status: ${result.status}`;
  if (result.error) {
    details += `, Error: ${result.error}`;
  }
  details += `, Response time: ${result.responseTime}ms`;

  if (!schemaValid.valid) {
    details += `, Schema: ${schemaValid.error}`;
  }

  if (!containsCheck.found) {
    details += `, Missing: ${containsCheck.missing.join(', ')}`;
  }

  const passed = result.ok && schemaValid.valid && containsCheck.found && score >= 70;

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
      schemaValid,
      containsCheck
    }
  };
}

/**
 * Can this checker handle this deliverable?
 */
export function canHandle(deliverable: any): boolean {
  return !!(deliverable.url || deliverable.endpoint);
}