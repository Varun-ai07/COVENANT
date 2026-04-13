/**
 * Machine-Verifiable Spec Format for COVENANT Verification Engine
 * Updated to match the format from Second_COVENANT_complete_system.txt
 *
 * This module defines a standard format for describing task specifications
 * and verification criteria in a machine-readable way. It enables automated
 * verification, reproducibility, and composable checking modules.
 */

export type DeliverableType = "code" | "report" | "data" | "analysis" | "design" | "generic";

export interface CheckConfig {
  /** HTTP method for API checks */
  method?: "HTTP_GET" | "HTTP_POST" | "HTTP_PUT" | "HTTP_DELETE";
  /** URL to check (can use template variables like ${FRONTEND_URL}) */
  url?: string;
  /** Expected HTTP status code */
  expected_status?: number;
  /** Timeout in seconds for HTTP requests */
  timeout_seconds?: number;
  /** Expected body schema (for API endpoint checks) */
  expected_body_schema?: any;
  /** Expected body to contain specific strings/arrays */
  expected_body_contains?: string[] | string;
  /** Whether authentication is required for the request */
  auth_required?: boolean;
  /** Path to file for file existence checks */
  path?: string;
  /** Assertion to evaluate (for test coverage, etc.) */
  assertion?: string;
  /** Load test parameters */
  requests?: number;
  concurrency?: number;
  max_avg_response_ms?: number;
  /** Security scan configuration */
  tool?: string; // e.g., "zap_baseline"
  target?: string; // URL to scan
  max_critical?: number;
  max_high?: number;
  /** Build/test command configuration */
  command?: string;
  expected_exit_code?: number;
  /** Database health check */
  expected_body_contains_array?: string[]; // Alternative to expected_body_contains
}

export interface Criterion {
  /** Unique identifier for this criterion */
  id: string;
  /** Type of check to perform */
  type:
    | "url_accessible"
    | "api_endpoint"
    | "database_check"
    | "test_coverage"
    | "performance"
    | "security"
    | "code_quality"
    | "stripe_integration"
    | "custom";
  /** Human-readable description */
  description: string;
  /** Configuration for the check */
  check: CheckConfig;
  /** Weight in scoring (0-100) */
  weight: number;
  /** Whether this criterion is blocking (must pass for overall success) */
  blocking: boolean;
}

export interface DeliverableRequirements {
  /** Whether a GitHub repository is required */
  github_repo: boolean;
  /** Whether a README with setup instructions is required */
  readme_with_setup: boolean;
  /** Whether an example environment file is required */
  env_example_file: boolean;
  /** Whether docker-compose.yml is required */
  docker_compose: boolean;
  /** Whether a deployed URL is required */
  deployed_url: boolean;
}

export interface VerificationSpec {
  /** Unique spec identifier (e.g., "task.fullstack-web-app") */
  specId: string;
  /** Human-readable name */
  name: string;
  /** Version of the spec format */
  version: string;
  /** Part A: Human description (for the worker to understand) */
  partA_description: string;
  /** Part B: Acceptance criteria (machine-checkable) */
  partB_criteria: Criterion[];
  /** Part C: Scoring formula configuration */
  partC_scoring: {
    /** Minimum overall score to pass (0-100) */
    minimum_pass_score: number;
    /** Whether all blocking criteria must pass */
    blocking_criteria_must_all_pass: boolean;
  };
  /** Deliverable requirements */
  deliverable_requirements: DeliverableRequirements;
  /** Optional custom evaluation prompt for LLM (if needed) */
  llmPrompt?: string;
}

// Example predefined spec for a full-stack e-commerce platform (from the document)
export const PREDEFINED_SPECS: Record<string, VerificationSpec> = {
  "task.fullstack-ecommerce": {
    specId: "task.fullstack-ecommerce",
    name: "Full-Stack E-Commerce Platform",
    version: "2.0.0",
    partA_description: "Build a full-stack e-commerce platform with product listings, cart, auth, Stripe payments, PostgreSQL, Node.js backend, React frontend, deployed publicly",
    partB_criteria: [
      {
        id: "C001",
        type: "url_accessible",
        description: "Frontend URL returns HTTP 200",
        check: {
          method: "HTTP_GET",
          url: "${FRONTEND_URL}",
          expected_status: 200,
          timeout_seconds: 10
        },
        weight: 5,
        blocking: true
      },
      {
        id: "C002",
        type: "api_endpoint",
        description: "GET /api/products returns array",
        check: {
          method: "HTTP_GET",
          url: "${API_URL}/api/products",
          expected_status: 200,
          expected_body_schema: {
            type: "array",
            minItems: 1
          }
        },
        weight: 10,
        blocking: true
      },
      {
        id: "C003",
        type: "api_endpoint",
        description: "POST /api/auth/register creates user",
        check: {
          method: "HTTP_POST",
          url: "${API_URL}/api/auth/register",
          body: {
            email: "test@covenant.eth",
            password: "Test@12345"
          },
          expected_status: 201,
          expected_body_contains: ["userId", "token"]
        },
        weight: 10,
        blocking: true
      },
      {
        id: "C004",
        type: "api_endpoint",
        description: "POST /api/cart/add adds item to cart",
        check: {
          method: "HTTP_POST",
          url: "${API_URL}/api/cart/add",
          auth_required: true,
          body: {
            productId: 1,
            quantity: 2
          },
          expected_status: 200,
          expected_body_contains: ["cartId", "items"]
        },
        weight: 10,
        blocking: true
      },
      {
        id: "C005",
        type: "database_check",
        description: "PostgreSQL connection works",
        check: {
          method: "API_HEALTHCHECK",
          url: "${API_URL}/api/health",
          expected_body_contains: ["database: connected"]
        },
        weight: 5,
        blocking: true
      },
      {
        id: "C006",
        type: "test_coverage",
        description: "Test coverage above 90%",
        check: {
          method: "FILE_EXISTS",
          path: "coverage/coverage-summary.json",
          assertion: "data.total.lines.pct >= 90"
        },
        weight: 15,
        blocking: false
      },
      {
        id: "C007",
        type: "performance",
        description: "API responds under 500ms",
        check: {
          method: "LOAD_TEST",
          url: "${API_URL}/api/products",
          requests: 100,
          concurrency: 10,
          max_avg_response_ms: 500
        },
        weight: 10,
        blocking: false
      },
      {
        id: "C008",
        type: "security",
        description: "No critical OWASP vulnerabilities",
        check: {
          method: "SECURITY_SCAN",
          tool: "zap_baseline",
          target: "${FRONTEND_URL}",
          max_critical: 0,
          max_high: 2
        },
        weight: 15,
        blocking: false
      },
      {
        id: "C009",
        type: "code_quality",
        description: "No TypeScript errors",
        check: {
          method: "BUILD_SUCCESS",
          command: "npm run build",
          expected_exit_code: 0
        },
        weight: 10,
        blocking: true
      },
      {
        id: "C010",
        type: "stripe_integration",
        description: "Stripe test checkout works",
        check: {
          method: "HTTP_POST",
          url: "${API_URL}/api/checkout/session",
          body: {
            items: [{"productId": 1, "quantity": 1}],
            mode: "test"
          },
          expected_status: 200,
          expected_body_contains: ["sessionId"]
        },
        weight: 10,
        blocking: false
      }
    ],
    partC_scoring: {
      minimum_pass_score: 75,
      blocking_criteria_must_all_pass: true
    },
    deliverable_requirements: {
      github_repo: true,
      readme_with_setup: true,
      env_example_file: true,
      docker_compose: true,
      deployed_url: true
    }
  }
};

/**
 * Get a predefined spec by ID
 */
export function getSpec(specId: string): VerificationSpec | undefined {
  return PREDEFINED_SPECS[specId];
}

/**
 * Register a custom spec
 */
export function registerSpec(spec: VerificationSpec): void {
  PREDEFINED_SPECS[spec.specId] = spec;
}

/**
 * Validate a spec structure (self-checking)
 */
export function validateSpec(spec: VerificationSpec): boolean {
  if (!spec.specId || !spec.name || !spec.version) return false;
  if (!spec.partA_description) return false;
  if (spec.partB_criteria.length === 0) return false;
  if (!spec.partC_scoring) return false;

  // Validate scoring config
  const { minimum_pass_score, blocking_criteria_must_all_pass } = spec.partC_scoring;
  if (minimum_pass_score < 0 || minimum_pass_score > 100) return false;

  // Validate criteria
  let totalWeight = 0;
  for (const criterion of spec.partB_criteria) {
    if (!criterion.id || !criterion.type || !criterion.description || !criterion.check) return false;
    if (criterion.weight < 0 || criterion.weight > 100) return false;
    totalWeight += criterion.weight;
  }

  // Allow 5% tolerance for weight total (like in original specs.ts)
  if (Math.abs(totalWeight - 100) > 5) return false;

  return true;
}

/**
 * Serialize spec to JSON for storage/transmission (to IPFS)
 */
export function serializeSpec(spec: VerificationSpec): string {
  return JSON.stringify(spec, null, 2);
}

/**
 * Deserialize spec from JSON (from IPFS)
 */
export function deserializeSpec(json: string): VerificationSpec | null {
  try {
    const spec = JSON.parse(json);
    if (validateSpec(spec)) {
      return spec;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Calculate score based on criterion results
 * Implements the scoring formula from Part C of the spec
 */
export function calculateScore(criterionResults: { id: string; passed: boolean; weight: number }[]): number {
  let totalScore = 0;
  let totalWeight = 0;

  for (const result of criterionResults) {
    totalWeight += result.weight;
    if (result.passed) {
      totalScore += result.weight;
    }
  }

  // Return percentage score
  return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;
}

/**
 * Check if a spec passes based on results and scoring rules
 */
export function passesVerification(
  score: number,
  criterionResults: { id: string; passed: boolean; weight: number; blocking: boolean }[],
  spec: VerificationSpec
): boolean {
  // Check blocking criteria first
  if (spec.partC_scoring.blocking_criteria_must_all_pass) {
    for (const result of criterionResults) {
      if (result.blocking && !result.passed) {
        return false; // Any blocking criterion failed means overall failure
      }
    }
  }

  // Check minimum score
  const minScore = spec.partC_scoring.minimum_pass_score;
  return score >= minScore;
}

/**
 * Get the list of blocking criteria IDs that failed
 */
export function getFailedBlockingCriteria(
  criterionResults: { id: string; passed: boolean; weight: number; blocking: boolean }[]
): string[] {
  return criterionResults
    .filter(result => result.blocking && !result.passed)
    .map(result => result.id);
}

/**
 * Get the list of all criteria IDs that failed
 */
export function getFailedCriteria(
  criterionResults: { id: string; passed: boolean; weight: number }[]
): string[] {
  return criterionResults
    .filter(result => !result.passed)
    .map(result => result.id);
}