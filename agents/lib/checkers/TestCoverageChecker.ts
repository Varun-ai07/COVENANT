/**
 * TestCoverageChecker - Validates test coverage percentage
 * For criterion type: "test_coverage"
 */

import { CheckResult } from "./GenericChecker.js";

const MAX_SCORE = 100;

/**
 * Check test coverage from coverage report file
 * This assumes the coverage report is accessible via URL or local file
 * For simplicity, we'll check if a coverage file exists and parse it
 */
async function fetchCoverageReport(
  url: string,
  timeoutSeconds: number = 10
): Promise<{ status: number; coverageData: any; error?: string }> {
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

    let coverageData: any = null;
    try {
      coverageData = await response.json();
    } catch (e) {
      // Not JSON, try text
      coverageData = await response.text();
    }

    return {
      status: response.status,
      coverageData,
      error: response.status !== 200
        ? `Expected status 200, got ${response.status}`
        : undefined
    };
  } catch (error: any) {
    return {
      status: 0,
      coverageData: null,
      error: error.message || 'Request failed'
    };
  }
}

/**
 * Extract coverage percentage from coverage data
 */
function extractCoveragePercentage(data: any): number {
  // Try common coverage report formats
  if (!data) return 0;

  // Istanbul/nyc format: coverage-summary.json
  if (data.total && data.total.lines && data.total.lines.pct !== undefined) {
    return data.total.lines.pct;
  }

  // Alternative format
  if (data.lines && data.lines.pct !== undefined) {
    return data.lines.pct;
  }

  // Direct percentage
  if (typeof data === 'number') {
    return data;
  }

  // String percentage
  if (typeof data === 'string') {
    const match = data.match(/(\d+(?:\.\d+)?)\s*%/);
    if (match) {
      return parseFloat(match[1]);
    }
  }

  return 0;
}

/**
 * Score test coverage check
 */
function scoreCoverageCheck(coveragePercent: number, requiredPercent: number): number {
  if (coveragePercent >= requiredPercent) {
    return 100;
  }

  // Linear scaling: 0% coverage = 0 score, required% = 100 score
  return Math.round((coveragePercent / requiredPercent) * 100);
}

/**
 * Check test coverage
 */
export async function check(
  deliverable: any,
  taskDescription?: string
): Promise<CheckResult> {
  // Extract test coverage check details from deliverable
  const url = deliverable.url || deliverable.path;
  const assertion = deliverable.assertion; // e.g., "data.total.lines.pct >= 90"
  const timeoutSeconds = deliverable.timeout_seconds ?? 10;

  // Parse required percentage from assertion (simplified)
  let requiredPercent = 90; // default
  if (assertion) {
    const match = assertion.match(/>=?\s*(\d+(?:\.\d+)?)/);
    if (match) {
      requiredPercent = parseFloat(match[1]);
    }
  }

  if (!url) {
    return {
      score: 0,
      maxScore: MAX_SCORE,
      passed: false,
      details: 'No URL or path provided for test coverage check',
      evidence: { url: null }
    };
  }

  console.log(`[TestCoverageChecker] Fetching coverage report from: ${url}`);

  const result = await fetchCoverageReport(url, timeoutSeconds);
  const coveragePercent = extractCoveragePercentage(result.coverageData);
  const score = scoreCoverageCheck(coveragePercent, requiredPercent);

  let details = `Coverage: ${coveragePercent.toFixed(2)}%`;
  if (result.error) {
    details += `, Error: ${result.error}`;
  }
  details += `, Required: ${requiredPercent}%`;

  const passed = coveragePercent >= requiredPercent && score >= 70;

  if (!passed) {
    details += ` (FAILED)`;
  }

  return {
    score,
    maxScore: MAX_SCORE,
    passed,
    details,
    evidence: {
      coveragePercent,
      requiredPercent,
      status: result.status
    }
  };
}

/**
 * Can this checker handle this deliverable?
 */
export function canHandle(deliverable: any): boolean {
  return !!(deliverable.url || deliverable.path);
}