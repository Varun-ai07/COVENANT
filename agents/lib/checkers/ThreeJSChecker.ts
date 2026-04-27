import { CheckResult } from "../GenericChecker.js";

const MAX_SCORE = 100;

/**
 * ThreeJSChecker - Validates Three.js/3D graphics deliverables
 * Checks: Three.js integration, model loading, rendering performance
 */
export async function check(
  deliverable: any,
  _taskDescription?: string
): Promise<CheckResult> {
  console.log("[ThreeJSChecker] Analyzing 3D graphics deliverable...");

  const report = deliverable.report || '';
  const code = deliverable.code || deliverable.files || {};

  let score = 0;
  let details = [];
  const evidence: any = {};

  // 1. Check for Three.js framework usage
  const hasThreeJS = /three\.js|threejs/i.test(report) || /three\.js|threejs/i.test(JSON.stringify(code));
  if (hasThreeJS) {
    score += 20;
    details.push('Three.js framework detected');
    evidence.hasThreeJS = true;
  } else {
    evidence.hasThreeJS = false;
  }

  // 2. Check for 3D models
  const hasModels = /model|geometry|mesh|scene/i.test(report) || /model|geometry|mesh|scene/i.test(JSON.stringify(code));
  if (hasModels) {
    score += 20;
    details.push('3D models detected');
    evidence.hasModels = true;
  } else {
    evidence.hasModels = false;
  }

  // 3. Check for rendering capabilities
  const hasRendering = /renderer|render|camera|scene/i.test(report) || /renderer|render|camera|scene/i.test(JSON.stringify(code));
  if (hasRendering) {
    score += 20;
    details.push('Rendering capabilities detected');
    evidence.hasRendering = true;
  } else {
    evidence.hasRendering = false;
  }

  // 4. Check for interactivity
  const hasInteractivity = /interaction|interactive|controls|orbit/i.test(report) || /interaction|interactive|controls|orbit/i.test(JSON.stringify(code));
  if (hasInteractivity) {
    score += 15;
    details.push('Interactivity features detected');
    evidence.hasInteractivity = true;
  } else {
    evidence.hasInteractivity = false;
  }

  // 5. Check for performance optimization
  const hasPerformance = /performance|optimization|fps|frame/i.test(report) || /performance|optimization|fps|frame/i.test(JSON.stringify(code));
  if (hasPerformance) {
    score += 15;
    details.push('Performance optimizations detected');
    evidence.hasPerformance = true;
  } else {
    evidence.hasPerformance = false;
  }

  // 6. Check for documentation
  const hasDocumentation = /documentation|docs|readme|instructions/i.test(report) || /documentation|docs|readme|instructions/i.test(JSON.stringify(code));
  if (hasDocumentation) {
    score += 10;
    details.push('Documentation present');
    evidence.hasDocumentation = true;
  } else {
    evidence.hasDocumentation = false;
  }

  // Normalize to 0-100
  score = Math.min(100, score);

  const passed = score >= 70;

  return {
    score,
    maxScore: MAX_SCORE,
    passed,
    details: details.length > 0 ? details.join(', ') : 'No 3D graphics indicators found',
    evidence,
  };
}

/**
 * Can this checker handle this deliverable?
 */
export function canHandle(deliverable: any): boolean {
  const has3D = deliverable.threejs || deliverable.models || deliverable.scene;
  const report = deliverable.report || '';
  return !!(has3D || /three\.js|3d|webgl|model|geometry|mesh|scene/i.test(report));
}