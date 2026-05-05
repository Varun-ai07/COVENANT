/**
 * Checker Registry - Manages all available checkers
 */

import * as TextCheckerModule from "./TextChecker.js";
import * as DataCheckerModule from "./DataChecker.js";
import * as FullStackCheckerModule from "./FullStackChecker.js";
import * as CodeCheckerModule from "./CodeChecker.js";
import * as ResearchCheckerModule from "./ResearchChecker.js";
import * as GenericCheckerModule from "./GenericChecker.js";
import * as URLAccessibleCheckerModule from "./URLAccessibleChecker.js";
import * as APIDEndpointCheckerModule from "./APIDEndpointChecker.js";
import * as DatabaseCheckerModule from "./DatabaseChecker.js";
import * as TestCoverageCheckerModule from "./TestCoverageChecker.js";
import * as PerformanceCheckerModule from "./PerformanceChecker.js";
import * as SecurityCheckerModule from "./SecurityChecker.js";
import * as CodeQualityCheckerModule from "./CodeQualityChecker.js";
import * as ThreeJSCheckerModule from "./ThreeJSChecker.js";
import * as StripePaymentCheckerModule from "./StripePaymentChecker.js";

export type CheckerFunction = (
  deliverable: any,
  taskDescription?: string
) => Promise<{
  score: number;
  maxScore: number;
  passed: boolean;
  details: string;
  evidence?: any;
  checkerName?: string;
}>;

export interface Checker {
  name: string;
  canHandle: (deliverable: any) => boolean;
  check: CheckerFunction;
}

/**
 * All registered checkers in priority order
 * More specific checkers should come first; GenericChecker is last (fallback)
 */
export const CHECKERS: Checker[] = [
  {
    name: 'ThreeJSChecker',
    canHandle: ThreeJSCheckerModule.canHandle,
    check: ThreeJSCheckerModule.check,
  },
  {
    name: 'StripePaymentChecker',
    canHandle: StripePaymentCheckerModule.canHandle,
    check: StripePaymentCheckerModule.check,
  },
  {
    name: 'APIDEndpointChecker',
    canHandle: APIDEndpointCheckerModule.canHandle,
    check: APIDEndpointCheckerModule.check,
  },
  {
    name: 'DatabaseChecker',
    canHandle: DatabaseCheckerModule.canHandle,
    check: DatabaseCheckerModule.check,
  },
  {
    name: 'TestCoverageChecker',
    canHandle: TestCoverageCheckerModule.canHandle,
    check: TestCoverageCheckerModule.check,
  },
  {
    name: 'PerformanceChecker',
    canHandle: PerformanceCheckerModule.canHandle,
    check: PerformanceCheckerModule.check,
  },
  {
    name: 'SecurityChecker',
    canHandle: SecurityCheckerModule.canHandle,
    check: SecurityCheckerModule.check,
  },
  {
    name: 'CodeQualityChecker',
    canHandle: CodeQualityCheckerModule.canHandle,
    check: CodeQualityCheckerModule.check,
  },
  {
    name: 'FullStackChecker',
    canHandle: FullStackCheckerModule.canHandle,
    check: FullStackCheckerModule.check,
  },
  {
    name: 'CodeChecker',
    canHandle: CodeCheckerModule.canHandle,
    check: CodeCheckerModule.check,
  },
  {
    name: 'ResearchChecker',
    canHandle: ResearchCheckerModule.canHandle,
    check: ResearchCheckerModule.check,
  },
  {
    name: 'DataChecker',
    canHandle: DataCheckerModule.canHandle,
    check: DataCheckerModule.check,
  },
  {
    name: 'TextChecker',
    canHandle: TextCheckerModule.canHandle,
    check: TextCheckerModule.check,
  },
  {
    name: 'GenericChecker',
    canHandle: GenericCheckerModule.canHandle,
    check: GenericCheckerModule.check,
  },
];

/**
 * Find the best checker for a given deliverable
 */
export function getCheckerForDeliverable(deliverable: any): Checker {
  for (const checker of CHECKERS) {
    if (checker.canHandle(deliverable)) {
      return checker;
    }
  }
  // Should never happen because GenericChecker handles everything
  return CHECKERS[CHECKERS.length - 1];
}

/**
 * Run all applicable checkers on a deliverable
 */
export async function runAllCheckers(
  deliverable: any,
  taskDescription?: string
): Promise<Array<Awaited<ReturnType<typeof CHECKERS[0]['check']>>>> {
  const applicableCheckers = CHECKERS.filter(c => c.canHandle(deliverable));

  console.log(`[Checkers] Running ${applicableCheckers.length} checker(s): ${applicableCheckers.map(c => c.name).join(', ')}`);

  const results = await Promise.all(
    applicableCheckers.map(async (checker) => {
      try {
        const result = await checker.check(deliverable, taskDescription);
        console.log(`[Checkers] ${checker.name}: score=${result.score}/${result.maxScore} ${result.passed ? '✓' : '✗'}`);
        return { ...result, checkerName: checker.name };
      } catch (error) {
        console.error(`[Checkers] ${checker.name} failed:`, error);
        return {
          score: 0,
          maxScore: 100,
          passed: false,
          details: `Checker error: ${error instanceof Error ? error.message : String(error)}`,
          checkerName: checker.name,
        };
      }
    })
  );

  return results;
}

/**
 * Get a checker by name
 */
export function getChecker(name: string): Checker | undefined {
  return CHECKERS.find(c => c.name === name);
}

/**
 * List all available checkers
 */
export function listCheckers(): string[] {
  return CHECKERS.map(c => c.name);
}