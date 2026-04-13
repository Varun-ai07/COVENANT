/**
 * Scoring system for VerifierBot
 * Combines deterministic checks (70%) with LLM evaluation (30%)
 */

import { Evidence, CheckResult } from "./evidence.js";
import { generateJSON } from "./llm.js";

export interface ScoringConfig {
  deterministicWeight: number;  // Default 70%
  llmWeight: number;            // Default 30%
  passingThreshold: number;     // Minimum score to pass (default 70)
}

const DEFAULT_CONFIG: ScoringConfig = {
  deterministicWeight: 0.7,
  llmWeight: 0.3,
  passingThreshold: 70,
};

/**
 * Calculate final score from deterministic and LLM scores
 */
export function calculateScore(
  deterministicScore: number,
  llmScore: number,
  config: Partial<ScoringConfig> = {}
): number {
  const { deterministicWeight, llmWeight } = { ...DEFAULT_CONFIG, ...config };

  const finalScore = Math.round(
    deterministicScore * deterministicWeight +
    llmScore * llmWeight
  );

  return Math.min(100, Math.max(0, finalScore)); // Clamp to 0-100
}

/**
 * Evaluate deliverable using LLM for quality assessment (30% weight)
 * This is a fallback/base quality score that supplements deterministic checks.
 */
export async function evaluateWithLLM(
  deliverable: any,
  taskDescription?: string,
  llmPrompt?: string
): Promise<{ score: number; feedback: string }> {
  const defaultPrompt = `
Evaluate the following work deliverable for quality, completeness, and relevance.

Task Description:
${taskDescription || "No task description available"}

Deliverable:
${JSON.stringify(deliverable, null, 2)}

Score dimensions (0-100):
- Completeness: All required elements present?
- Quality: Work is well-executed, professional, no errors?
- Relevance: Matches the task requirements?
- Clarity: Easy to understand, well-structured?

Return a JSON object with:
- score: number (0-100)
- feedback: string (brief explanation, max 200 chars)
`;

  const prompt = llmPrompt || defaultPrompt;

  try {
    const evaluation = await generateJSON<{ score: number; feedback: string }>(prompt, {
      maxTokens: 500,
    });

    // Clamp score
    evaluation.score = Math.min(100, Math.max(0, evaluation.score));
    return evaluation;
  } catch (error) {
    console.error("[Scoring] LLM evaluation failed:", error);
    // Fallback: guess based on basic properties
    const fallbackScore = deliverable?.report?.length > 500 ? 75 : 50;
    return {
      score: fallbackScore,
      feedback: "LLM evaluation failed, using fallback heuristics"
    };
  }
}

/**
 * Combine all check results into a deterministic score
 */
export function aggregateDeterministicScore(
  checkResults: CheckResult[],
  weights?: Record<string, number>
): number {
  if (checkResults.length === 0) {
    return 0;
  }

  // Default equal weights if not specified
  const totalMaxScore = checkResults.reduce((sum, r) => sum + r.maxScore, 0);
  const weightedSum = checkResults.reduce((sum, r) => {
    const weight = weights?.[r.checkerName] ?? 1;
    return sum + (r.score / r.maxScore) * 100 * weight;
  }, 0);

  const totalWeight = checkResults.reduce((sum, r) => sum + (weights?.[r.checkerName] ?? 1), 0);

  const finalScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  return Math.round(finalScore);
}

/**
 * Determine if the work passes based on final score and optional extra criteria
 */
export function passesVerification(
  finalScore: number,
  checkResults: CheckResult[],
  config: Partial<ScoringConfig> = {}
): boolean {
  const { passingThreshold } = { ...DEFAULT_CONFIG, ...config };

  // Must meet minimum score
  if (finalScore < passingThreshold) {
    return false;
  }

  // All critical checks must pass
  const criticalFailures = checkResults.filter(r => !r.passed && r.score === 0);
  if (criticalFailures.length > 0) {
    console.log(`[Scoring] Critical failures in: ${criticalFailures.map(r => r.checkerName).join(', ')}`);
    return false;
  }

  return true;
}

/**
 * Generate final verification result with full audit trail
 */
export function finalizeVerification(
  taskId: bigint,
  verifierAddress: string,
  checkResults: CheckResult[],
  deterministicScore: number,
  llmScore: number,
  finalScore: number,
  success: boolean,
  feedback: string,
  deliverableHash?: string,
  txHash?: string
): Evidence {
  return {
    taskId,
    verifierAddress,
    timestamp: new Date().toISOString(),
    checkResults,
    deterministicScore,
    llmScore,
    finalScore,
    success,
    feedback,
    deliverableHash,
    transactionHash: txHash,
  };
}
