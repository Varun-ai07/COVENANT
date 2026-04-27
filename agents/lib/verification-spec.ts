/**
 * Verification Specification System
 * Handles task specifications for complex deliverables as described in the optimization guide
 */

// Task specification interface matching the optimization guide
interface TaskSpec {
  partA_humanReadable: {
    title: string;
    description: string;
    resourcesProvided?: Array<{type: string; url: string}>;
    technicalRequirements?: any;
  };
  partB_acceptanceCriteria: {
    deterministicChecks: Array<{id: string; type: string; details: string}>;
    llmEvaluatedChecks: Array<{id: string; type: string; weight: number; details: string}>;
  };
  partC_scoringFormula: {
    passingThreshold: number;
    blockingCriteria: string[];
    deterministicWeight: number;
    llmWeight: number;
    finalScore: string;
  };
}

/**
 * Create a verification specification for a task
 */
export function createVerificationSpec(taskDescription: string, deliverableType: string): TaskSpec {
  // This would be a more sophisticated implementation in a real system
  // For now, we'll return a basic spec structure
  return {
    partA_humanReadable: {
      title: "Task Verification",
      description: taskDescription
    },
    partB_acceptanceCriteria: {
      deterministicChecks: [],
      llmEvaluatedChecks: []
    },
    partC_scoringFormula: {
      passingThreshold: 75,
      blockingCriteria: [],
      deterministicWeight: 0.4,
      llmWeight: 0.6,
      finalScore: "(0.4 * deterministicScore) + (0.6 * llmScore)"
    }
  };
}

/**
 * Validate a task specification
 */
export function validateSpec(spec: TaskSpec): boolean {
  // Basic validation - in a real system this would be more comprehensive
  return !!(
    spec.partA_humanReadable &&
    spec.partA_humanReadable.title &&
    spec.partA_humanReadable.description &&
    spec.partB_acceptanceCriteria &&
    spec.partC_scoringFormula
  );
}

// Export the functions
export default {
  createVerificationSpec,
  validateSpec
};