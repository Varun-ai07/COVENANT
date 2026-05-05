export interface VerificationResult {
  engine: string;
  taskId: number;
  success: boolean;
  score: number;
  deterministicScore: number;
  llmScore: number;
  feedback: string;
  criteria: Criterion[];
  pipeline: PipelineStatus;
  evaluatedAt: string;
}

export interface Criterion {
  id: string;
  label: string;
  stage: 1 | 2 | 3;
  weight: number;
  passed: boolean;
  details: string;
}

export interface PipelineStatus {
  stage1Passed: boolean;
  stage2Passed: boolean;
  stage3Assessed: boolean;
  threshold: number;
}
