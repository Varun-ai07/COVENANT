/**
 * GenericChecker - LLM-based quality evaluation only
 * Used when no specific checker applies or as fallback
 */

import { generateJSON } from "../llm.js";

export interface CheckResult {
  score: number;
  maxScore: number;
  passed: boolean;
  details: string;
  evidence?: any;
}

const MAX_SCORE = 100;

/**
 * Evaluate work using only LLM judgment
 * This is the fallback when we don't have specific deterministic checks
 */
export async function check(
  deliverable: any,
  taskDescription?: string
): Promise<CheckResult> {
  console.log("[GenericChecker] Running LLM-based evaluation...");

  const prompt = `
You are a quality assurance specialist. Evaluate this work deliverable.

${taskDescription ? `Task: ${taskDescription}` : ''}

Deliverable to evaluate:
${JSON.stringify(deliverable, null, 2).slice(0, 3000)}

Assess:
1. Completeness: Does it have all expected parts? (score 0-30)
2. Quality: Is the work well done? (score 0-40)
3. Relevance: Does it address the task? (score 0-30)

Return a JSON object:
{
  "score": 0-100 (sum of above),
  "passed": true/false (score >= 70),
  "details": "Brief explanation",
  "breakdown": { "completeness": X, "quality": Y, "relevance": Z }
}
`;

  try {
    const result = await generateJSON<{
      score: number;
      passed: boolean;
      details: string;
      breakdown?: { completeness: number; quality: number; relevance: number };
    }>(prompt, { maxTokens: 500 });

    return {
      score: result.score,
      maxScore: MAX_SCORE,
      passed: result.passed,
      details: result.details,
      evidence: result.breakdown,
    };
  } catch (error) {
    console.error("[GenericChecker] LLM evaluation failed:", error);
    // Fallback: basic size-based heuristic
    const reportLength = deliverable?.report?.length || 0;
    const baseScore = reportLength > 500 ? 60 : reportLength > 200 ? 40 : 20;

    return {
      score: baseScore,
      maxScore: MAX_SCORE,
      passed: baseScore >= 70,
      details: `Fallback heuristic based on report length (${reportLength} chars)`,
      evidence: { reportLength, error: error instanceof Error ? error.message : String(error) },
    };
  }
}

/**
 * Can this checker handle this deliverable type?
 * GenericChecker handles everything
 */
export function canHandle(deliverable: any): boolean {
  return true; // Universal fallback
}
