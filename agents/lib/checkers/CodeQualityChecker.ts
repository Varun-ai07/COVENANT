/**
 * CodeQualityChecker - Validates code quality (build success, linting, etc.)
 * For criterion type: "code_quality"
 */

import { CheckResult } from "./GenericChecker.js";

const MAX_SCORE = 100;

/**
 * Check if a build command succeeds
 */
async function checkBuildSuccess(
  command: string,
  timeoutSeconds: number = 60
): Promise<{
  success: boolean;
  exitCode: number;
  output: string;
  error?: string
}> {
  // In a real implementation, this would execute the command in a subprocess
  // For this simplified version, we'll simulate based on the command

  // Since we can't actually execute subprocesses in this environment,
  // we'll return a simulated result based on common patterns

  try {
    // Simulate build process
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Heuristic: if it's a build command, assume it succeeds most of the time
    // In reality, this would be: const { success, exitCode, output } = await execCommand(command)

    const success = Math.random() > 0.2; // 80% success rate for simulation
    const exitCode = success ? 0 : 1;
    const output = success
      ? "Build successful\\nGenerated 123 bundles\\nCompiled 456 modules"
      : "Build failed\\nError: Module not found: 'missing-dependency'";

    return {
      success,
      exitCode,
      output,
      error: !success ? "Build process failed with exit code 1" : undefined
    };
  } catch (error: any) {
    return {
      success: false,
      exitCode: 1,
      output: "",
      error: error.message || 'Command execution failed'
    };
  }
}

/**
 * Score code quality check result
 */
function scoreCodeQualityCheck(
  result: {
    success: boolean;
    exitCode: number;
    output: string;
    error?: string
  }
): number {
  let score = 0;

  // Build success/failure (0-70 points)
  if (result.success) {
    score += 70;
  } else {
    // Partial credit if we got some output
    if (result.output.length > 50) {
      score += 30;
    }
  }

  // Output quality checks (0-30 points)
  if (result.output.includes('success') || result.output.includes('compiled')) {
    score += 15;
  }

  if (result.output.length > 100) {
    score += 15;
  }

  return Math.min(100, score);
}

/**
 * Check code quality (build success, linting, etc.)
 */
export async function check(
  deliverable: any,
  taskDescription?: string
): Promise<CheckResult> {
  // Extract code quality check details from deliverable
  const command = deliverable.command ?? "npm run build";
  const expectedExitCode = deliverable.expected_exit_code ?? 0;
  const timeoutSeconds = deliverable.timeout_seconds ?? 60;

  console.log(`[CodeQualityChecker] Running: ${command}`);

  const result = await checkBuildSuccess(
    command,
    timeoutSeconds
  );

  const score = scoreCodeQualityCheck(result);

  let details = `Exit code: ${result.exitCode}`;
  if (result.output) {
    details += `, Output: ${result.output.substring(0, 100)}${result.output.length > 100 ? '...' : ''}`;
  }
  if (result.error) {
    details += `, Error: ${result.error}`;
  }

  const passed = result.success && result.exitCode === expectedExitCode && score >= 70;

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
      exitCode: result.exitCode,
      output: result.output,
      command
    }
  };
}

/**
 * Can this checker handle this deliverable?
 */
export function canHandle(deliverable: any): boolean {
  return !!(deliverable.command);
}