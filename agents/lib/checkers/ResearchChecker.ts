/**
 * ResearchChecker - Validates research and analytical deliverables
 * Checks: citations, source credibility, depth, methodology, conclusions
 */

import { CheckResult } from "./GenericChecker.js";

const MAX_SCORE = 100;

function extractCitations(text: string): string[] {
  const citations: string[] = [];
  const urlRegex = /https?:\/\/[^\s)]+/g;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    citations.push(match[0]);
  }
  const bracketRegex = /\[\d+\]/g;
  while ((match = bracketRegex.exec(text)) !== null) {
    citations.push(match[0]);
  }
  return [...new Set(citations)];
}

function assessSourceQuality(url: string): 'high' | 'medium' | 'low' {
  const high = ['arxiv.org', 'ieee.org', 'acm.org', 'nature.com', 'science.org', 'gov', 'edu', '.scholar.'];
  const medium = ['medium.com', 'dev.to', 'substack.com', 'github.com', 'docs.google.com', 'notion.so'];
  try {
    const hostname = new URL(url).hostname;
    if (high.some(d => hostname.includes(d))) return 'high';
    if (medium.some(d => hostname.includes(d))) return 'medium';
  } catch { }
  return 'low';
}

function analyzeStructure(text: string): { sections: string[]; paragraphCount: number } {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const sections = [
    'introduction', 'method', 'methodology', 'approach',
    'result', 'finding', 'outcome',
    'conclusion', 'summary', 'discussion', 'future work'
  ].filter(s => text.toLowerCase().includes(s));
  return { sections, paragraphCount: paragraphs.length };
}

export async function check(
  deliverable: any,
  _taskDesc?: string
): Promise<CheckResult> {
  console.log("[ResearchChecker] Evaluating research quality...");

  const report = deliverable?.report || '';

  const citations = extractCitations(report);
  const { sections, paragraphCount } = analyzeStructure(report);
  const lower = report.toLowerCase();

  let score = 0;
  const evidence: any = { citationCount: citations.length, sections, paragraphCount };

  // Citations (0-30 points)
  if (citations.length >= 10) {
    score += 30;
    evidence.citationLevel = 'excellent';
  } else if (citations.length >= 5) {
    score += 20;
    evidence.citationLevel = 'good';
  } else if (citations.length >= 1) {
    score += 10;
    evidence.citationLevel = 'minimal';
  } else {
    evidence.citationLevel = 'none';
  }

  // Source quality (0-20 points) only for URL citations
  const urls = citations.filter(c => c.startsWith('http'));
  if (urls.length > 0) {
    const qualities = urls.map(assessSourceQuality);
    const high = qualities.filter(q => q === 'high').length;
    const medium = qualities.filter(q => q === 'medium').length;
    const qualityScore = (high * 2 + medium) / urls.length;
    score += qualityScore * 10; // 0-20
    evidence.sourceQuality = { high, medium, low: urls.length - high - medium };
  }

  // Depth (paragraphs) (0-20 points)
  if (paragraphCount >= 15) score += 20;
  else if (paragraphCount >= 8) score += 15;
  else if (paragraphCount >= 3) score += 5;

  // Structure (sections) (0-30 points)
  const structureWeight = sections.length / 4; // expect at least 4 sections for full score
  score += Math.min(30, structureWeight * 30);

  // Critical thinking indicators (depth) - check for analysis words
  const analysisKeywords = ['analyze', 'evaluate', 'compare', 'contrast', 'implication', 'impact', 'trend', 'pattern', 'correlation'];
  const depthScore = analysisKeywords.filter(k => lower.includes(k)).length * 2;
  score += Math.min(10, depthScore);

  score = Math.min(100, score);

  const passed = score >= 70;

  return {
    score,
    maxScore: MAX_SCORE,
    passed,
    details: `Citations: ${citations.length}, Sections: ${sections.join(', ') || 'none'}, Paragraphs: ${paragraphCount}`,
    evidence,
  };
}

export function canHandle(deliverable: any): boolean {
  return !!deliverable?.report && /research|analysis|report|investigation/i.test(deliverable.report);
}
