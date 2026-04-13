/**
 * DataChecker - Validates structured data (JSON, CSV, arrays)
 * Checks: schema compliance, value ranges, required fields
 */

import { CheckResult } from "./GenericChecker.js";

const MAX_SCORE = 100;

/**
 * Schema definition for data validation
 */
interface DataSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  required?: string[];  // for objects
  properties?: Record<string, DataSchema>;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;    // regex pattern for strings
}

/**
 * Simple data validator
 */
function validateAgainstSchema(data: any, schema: DataSchema): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Type check
  const dataType = Array.isArray(data) ? 'array' : typeof data;
  if (schema.type && dataType !== schema.type) {
    errors.push(`Expected type ${schema.type}, got ${dataType}`);
  }

  // Object-specific checks
  if (schema.type === 'object' && typeof data === 'object' && !Array.isArray(data)) {
    // Required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in data)) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    // Property schemas
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in data) {
          const nestedResult = validateAgainstSchema(data[key], propSchema);
          errors.push(...nestedResult.errors.map(e => `${key}.${e}`));
        }
      }
    }
  }

  // Array-specific checks
  if (schema.type === 'array' && Array.isArray(data)) {
    if (schema.minItems && data.length < schema.minItems) {
      errors.push(`Array has ${data.length} items, need at least ${schema.minItems}`);
    }
    if (schema.maxItems && data.length > schema.maxItems) {
      errors.push(`Array has ${data.length} items, max is ${schema.maxItems}`);
    }
  }

  // Number range checks
  if (schema.type === 'number' && typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push(`Value ${data} is below minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push(`Value ${data} exceeds maximum ${schema.maximum}`);
    }
  }

  // String pattern check
  if (schema.type === 'string' && typeof data === 'string' && schema.pattern) {
    const regex = new RegExp(schema.pattern);
    if (!regex.test(data)) {
      errors.push(`String does not match pattern ${schema.pattern}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Default schema for COVENANT deliverable structure
 */
const DEFAULT_DELIVERABLE_SCHEMA: DataSchema = {
  type: 'object',
  required: ['task', 'report', 'completedAt', 'workerAddress'],
  properties: {
    task: { type: 'string' },
    report: { type: 'string' },
    completedAt: { type: 'string' }, // ISO date
    workerAddress: { type: 'string' },
  },
};

/**
 * Validate deliverable structure
 */
export async function check(
  deliverable: any,
  taskDescription?: string
): Promise<CheckResult> {
  console.log("[DataChecker] Validating data structure...");

  const schema = DEFAULT_DELIVERABLE_SCHEMA;
  const validation = validateAgainstSchema(deliverable, schema);

  let score = 0;
  let passed = false;
  let details = '';

  if (validation.valid) {
    score = 100;
    passed = true;
    details = 'Deliverable structure is valid and complete';

    // Bonus checks
    if (deliverable.report && deliverable.report.length > 500) {
      score += 10; // Exceed length expectation
    }
    if (deliverable.completedAt) {
      const completed = new Date(deliverable.completedAt);
      const now = new Date();
      if (completed > now) {
        score -= 20; // Future completion time is suspicious
        details += ' (warning: completion time in future)';
      }
    }
  } else {
    score = Math.max(0, 100 - validation.errors.length * 20);
    passed = score >= 70;
    details = `Structure validation failed: ${validation.errors.join(', ')}`;
  }

  return {
    score: Math.min(100, score),
    maxScore: MAX_SCORE,
    passed,
    details,
    evidence: { errors: validation.errors, schema },
  };
}

/**
 * Can this checker handle this deliverable?
 */
export function canHandle(deliverable: any): boolean {
  // Can handle any deliverable with any structure
  return typeof deliverable === 'object' && deliverable !== null;
}
