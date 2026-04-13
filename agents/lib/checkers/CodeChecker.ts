/**
 * CodeChecker - Validates code deliverables
 * Checks: syntax, test results, coverage, build success
 */

import { CheckResult } from "./GenericChecker.js";

const MAX_SCORE = 100;

/**
 * Check code quality indicators in the deliverable
 */
export async function check(
  deliverable: any,
  _taskDescription?: string
): Promise<CheckResult> {
  console.log("[CodeChecker] Analyzing code deliverable...");

  const report = deliverable.report || '';
  const code = deliverable.code || deliverable.files || {};

  let score = 0;
  let details = [];
  const evidence: any = {};

  // 1. Check for test results
  const hasTestResults = /test/i.test(report) || /passed|failed/i.test(report);
  if (hasTestResults) {
    score += 25;
    details.push('Test results present');
    evidence.testResults = true;
  } else {
    evidence.testResults = false;
  }

  // 2. Extract coverage if mentioned
  const coverageMatch = report.match(/coverage[:\s]*([\d.]+)%/i) || report.match(/coverage[:\s]*([\d.]+)/i);
  if (coverageMatch) {
    const coverage = parseFloat(coverageMatch[1]);
    evidence.coverage = coverage;
    if (coverage >= 80) {
      score += 30;
      details.push(`High coverage: ${coverage}%`);
    } else if (coverage >= 50) {
      score += 15;
      details.push(`Moderate coverage: ${coverage}%`);
    } else {
      score += 5;
      details.push(`Low coverage: ${coverage}%`);
    }
  } else {
    evidence.coverage = null;
  }

  // 3. Check for build success indication
  const buildSuccess = /build (successful|passed|complete)/i.test(report);
  if (buildSuccess) {
    score += 25;
    details.push('Build reported as successful');
    evidence.buildSuccess = true;
  } else {
    evidence.buildSuccess = false;
  }

  // 4. Check for linting/review
  const hasLintCheck = /eslint|lint|code quality|static analysis/i.test(report);
  if (hasLintCheck) {
    score += 10;
    details.push('Linting/quality check mentioned');
    evidence.lintCheck = true;
  } else {
    evidence.lintCheck = false;
  }

  // 5. Check for explicit code files provided
  const fileCount = typeof code === 'object' ? Object.keys(code).length : 0;
  evidence.fileCount = fileCount;
  if (fileCount > 0) {
    score += 10;
    details.push(`Includes ${fileCount} code file(s)`);
  }

  // Normalize to 0-100
  score = Math.min(100, score);

  const passed = score >= 70;

  return {
    score,
    maxScore: MAX_SCORE,
    passed,
    details: details.length > 0 ? details.join(', ') : 'No code quality indicators found',
    evidence,
  };
}

/**
 * Can this checker handle this deliverable?
 */
export function canHandle(deliverable: any): boolean {
  const hasCode = deliverable.code || deliverable.files;
  const report = deliverable.report || '';
  return !!(hasCode || /code|build|test|coverage|lint/i.test(report));
}
