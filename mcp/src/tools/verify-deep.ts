/**
 * Deep Verification MCP Tools
 *
 * corven_verify_deep — Deep code analysis using GitHub repo
 * corven_get_verification_result — Retrieve stored verification results
 *
 * Off-chain analysis: clones repo, runs 8-dimension scorer, returns structured verdict.
 * No on-chain ABI required — results are advisory for the client's verify_task decision.
 */
import { z } from "zod";
import { formatReadResult, formatError } from "../handlers/transactions.js";
import { parseContractError, formatStructuredError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ─── In-memory verification store (MVP) ──────────────────────

const verificationResults = new Map<number, VerificationResult>();

interface VerificationResult {
  score: number;
  verdict: "pass" | "fail" | "partial";
  checks: Array<{
    dimension: string;
    score: number;
    details: string;
    issues: string[];
    passed: boolean;
  }>;
  summary: string;
  recommendations: string[];
  evidenceHash: string;
  repoUrl: string;
  timestamp: number;
}

// ─── Input Schemas ───────────────────────────────────────────

const verifyDeepSchema = z.object({
  repoUrl: z.string().url().describe("GitHub repository URL (e.g. https://github.com/owner/repo)"),
  taskRequirements: z.string().min(1).describe("What the task required — used to evaluate deliverable completeness"),
  verificationLevel: z.enum(["quick", "standard", "deep"]).optional().default("standard"),
  taskId: z.number().int().positive().optional().describe("Task ID to link verification to on-chain"),
});

const getVerificationSchema = z.object({
  taskId: z.number().int().positive().describe("Task ID to check verification for"),
});

// ─── Tool Registration ───────────────────────────────────────

export function registerVerifyDeepTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────
  // corven_verify_deep
  // ──────────────────────────────────────────────────────────
  server.registerTool(
    "corven_verify_deep",
    {
      title: "Deep Project Verification",
      description:
        "Verify a project by cloning from GitHub and analyzing the entire codebase across 8 dimensions.\n" +
        "USE WHEN: You need to deeply evaluate a worker's submitted project against task requirements.\n" +
        "REQUIRES: GitHub repo URL, task requirements, and verification level.\n" +
        "RETURNS: Score (0-100), verdict (pass/fail/partial), per-dimension check results, summary, and recommendations.\n" +
        "COMES AFTER: corven_submit_work (worker has submitted deliverable with a repo URL).\n" +
        "COMES BEFORE: corven_verify_task (client reviews results and makes final approve/reject decision).\n" +
        "SCORING: Code Quality 20%, Security 20%, Architecture 15%, Performance 15%, Testing 15%, Docs 5%, Deps 5%, Best Practices 5%.\n" +
        "VERDICT: pass >= 70, partial >= 40, fail < 40.\n" +
        "NOTE: This runs off-chain analysis. Results are advisory — client makes final verification decision.",
      inputSchema: {
        repoUrl: z.string().describe("GitHub repository URL (e.g. https://github.com/owner/repo)"),
        taskRequirements: z.string().describe("What the task required — used to evaluate deliverable completeness"),
        verificationLevel: z.enum(["quick", "standard", "deep"]).optional().default("standard"),
        taskId: z.number().optional().describe("Task ID to link verification to"),
      },
    },
    async (params) => {
      try {
        const parsed = verifyDeepSchema.safeParse(params);
        if (!parsed.success) return formatError(parsed.error);

        const { repoUrl, taskRequirements, verificationLevel, taskId } = parsed.data;

        // Run off-chain verification via the verify engine
        const { verifyProject } = await import("../lib/verify.js");
        const result = await verifyProject(repoUrl, taskRequirements, verificationLevel);

        // Store result if linked to a task
        if (taskId) {
          verificationResults.set(taskId, result);
        }

        const verdictEmoji = result.verdict === "pass" ? "PASS" : result.verdict === "partial" ? "PARTIAL" : "FAIL";

        return formatReadResult(
          {
            repoUrl,
            taskId: taskId || "not linked",
            verificationLevel,
            score: result.score,
            verdict: verdictEmoji,
            summary: result.summary,
            checks: result.checks.map(
              (c) =>
                `${c.dimension}: ${c.score}/100 ${c.passed ? "PASS" : "FAIL"}${c.issues.length > 0 ? ` — ${c.issues.join("; ")}` : ""}`
            ),
            recommendations: result.recommendations,
            evidenceHash: result.evidenceHash,
          },
          `Deep Verification ${verdictEmoji} — Score: ${result.score}/100`
        );
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────
  // corven_get_verification_result
  // ──────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_verification_result",
    {
      title: "Get Verification Result",
      description:
        "Get the stored result of a deep verification for a task.\n" +
        "USE WHEN: Checking if verification is complete and viewing results after corven_verify_deep ran.\n" +
        "REQUIRES: Task ID that was verified.\n" +
        "RETURNS: Verification score, verdict, detailed checks, summary, and recommendations.\n" +
        "COMES AFTER: corven_verify_deep completed for this task.\n" +
        "COMES BEFORE: corven_verify_task (client uses these results to make a decision).",
      inputSchema: {
        taskId: z.number().describe("Task ID to check verification for"),
      },
    },
    async (params) => {
      try {
        const parsed = getVerificationSchema.safeParse(params);
        if (!parsed.success) return formatError(parsed.error);

        const { taskId } = parsed.data;
        const result = verificationResults.get(taskId);

        if (!result) {
          return formatReadResult(
            {
              taskId,
              status: "not_found",
              message: `No verification result found for task #${taskId}. Run corven_verify_deep first.`,
            },
            `Verification for Task #${taskId}`
          );
        }

        const verdictEmoji = result.verdict === "pass" ? "PASS" : result.verdict === "partial" ? "PARTIAL" : "FAIL";

        return formatReadResult(
          {
            taskId,
            score: result.score,
            verdict: verdictEmoji,
            summary: result.summary,
            checks: result.checks.map(
              (c) =>
                `${c.dimension}: ${c.score}/100 ${c.passed ? "PASS" : "FAIL"}${c.issues.length > 0 ? ` — ${c.issues.join("; ")}` : ""}`
            ),
            recommendations: result.recommendations,
            evidenceHash: result.evidenceHash,
            repoUrl: result.repoUrl,
            verifiedAt: new Date(result.timestamp).toISOString(),
          },
          `Verification for Task #${taskId} — Score: ${result.score}/100 ${verdictEmoji}`
        );
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
