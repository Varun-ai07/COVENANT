/**
 * TextChecker - Validates text-based deliverables
 * Checks: word count, readability, structure, proper formatting
 */

import { CheckResult } from "./GenericChecker.js";

const MAX_SCORE = 100;

/**
 * Types of structured elements to look for in a good deliverable
 */
interface TextMetrics {
  wordCount: number;
  sentenceCount: number;
  avgWordsPerSentence: number;
  hasSections: boolean;
  hasBulletPoints: boolean;
  hasCodeBlocks: boolean;
  readability: 'low' | 'medium' | 'high';
}

/**
 * Analyze text metrics from a report
 */
function analyzeText(text: string): TextMetrics {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const hasBulletPoints = /^[\s]*[-*•]/.test(text);
  const hasCodeBlocks = /```/.test(text);
  const hasSections = /^#{1,6}\s/.test(text) || /^[A-Z][A-Za-z\s]+:/.test(text);

  const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;
  let readability: TextMetrics['readability'] = 'medium';
  if (avgWordsPerSentence < 10) readability = 'low'; // Too choppy
  if (avgWordsPerSentence > 25) readability = 'high'; // Complex sentences

  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    avgWordsPerSentence,
    hasSections,
    hasBulletPoints,
    hasCodeBlocks,
    readability,
  };
}

/**
 * Score text quality based on metrics
 */
function scoreMetrics(metrics: TextMetrics): number {
  let score = 0;

  // Word count (0-25 points)
  if (metrics.wordCount >= 300) score += 25;
  else if (metrics.wordCount >= 150) score += 15;
  else if (metrics.wordCount >= 50) score += 5;

  // Sentences (0-15 points)
  if (metrics.sentenceCount >= 10) score += 15;
  else if (metrics.sentenceCount >= 5) score += 8;

  // Structure (0-30 points)
  const structureScore = (metrics.hasSections ? 10 : 0) +
                        (metrics.hasBulletPoints ? 10 : 0) +
                        (metrics.hasCodeBlocks ? 10 : 0);
  score += structureScore;

  // Readability (0-30 points)
  if (metrics.readability === 'high') score += 30;
  else if (metrics.readability === 'medium') score += 15;

  return score;
}

/**
 * Check the text deliverable
 */
export async function check(
  deliverable: any,
  _taskDescription?: string
): Promise<CheckResult> {
  console.log("[TextChecker] Analyzing text quality...");

  const report = deliverable?.report || '';
  const metrics = analyzeText(report);
  const score = scoreMetrics(metrics);
  const passed = score >= 70; // 70% of text quality score threshold

  let details = `Words: ${metrics.wordCount}, Sentences: ${metrics.sentenceCount}, Readability: ${metrics.readability}`;
  if (metrics.hasSections) details += ", Has sections";
  if (metrics.hasBulletPoints) details += ", Bullet points";
  if (metrics.hasCodeBlocks) details += ", Code blocks";

  return {
    score,
    maxScore: MAX_SCORE,
    passed,
    details,
    evidence: metrics,
  };
}

/**
 * Can this checker handle this deliverable?
 */
export function canHandle(deliverable: any): boolean {
  return !!deliverable?.report && typeof deliverable.report === 'string';
}
