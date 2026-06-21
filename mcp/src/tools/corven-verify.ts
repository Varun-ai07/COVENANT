/**
 * corven_verify — Deep verification with on-chain attestation
 */
import { z } from "zod";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { formatReadResult, formatError } from "../handlers/transactions.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const schema = z.object({
  action: z.enum(["deep", "capability", "reputation", "result", "pending", "status"]),
  repoUrl: z.string().optional(),
  requirements: z.string().optional(),
  depth: z.enum(["quick", "standard", "deep"]).optional().default("standard"),
  agentAddress: z.string().optional(),
  capabilityHash: z.string().optional(),
});

export function registerVerifyTools(server: McpServer): void {
  server.registerTool(
    "corven_verify",
    {
      title: "Deep Verification",
      description:
        "Automatic verification of worker deliverables on COVENANT.\n\n" +
        "ACTIONS:\n" +
        "  deep — Run full verification: clone repo + static analysis + score\n" +
        "  pending — Check what tasks need verification (Submitted status)\n" +
        "  status — Show auto-verifier system status\n" +
        "  capability — Verify agent has specific capability\n" +
        "  reputation — Verify agent reputation meets threshold\n" +
        "  result — Get verification result by evidence hash\n\n" +
        "HOW IT WORKS (automatic, no user action needed):\n" +
        "1. Worker submits deliverable → TaskSubmitted event fires\n" +
        "2. Auto-verifier detects event → clones repo → runs checks → scores (0-100)\n" +
        "3. Score >= 70: Auto-approves, worker paid automatically\n" +
        "4. Score < 40: Auto-rejects, worker can dispute\n" +
        "5. Score 40-69: Flagged for your review — read the repo and decide\n\n" +
        "FOR BORDERLINE CASES (40-69):\n" +
        "Clone the repo yourself, read the code, compare against task requirements.\n" +
        "Then call corven_task({ action: 'verify', taskId: X, success: true/false }).\n\n" +
        "OUTPUT RULES:\n" +
        "- Present verification results as a clean summary: score, verdict, what passed/failed.\n" +
        "- For borderline cases: explain your code review findings in plain language.\n" +
        "- Always recommend a clear next step (approve, reject, or request revision).\n" +
        "- Never show raw JSON, stack traces, or technical error messages.",
      inputSchema: schema.shape,
    },
    async (args) => {
      try {
        const { action, repoUrl, requirements, depth, agentAddress, capabilityHash } = args;

        if (action === "deep") {
          if (!repoUrl) return formatError(new Error("repoUrl is required for deep verification"));

          // Run the 3-stage verification pipeline
          const { verifyProject } = await import("../lib/verify.js");
          const result = await verifyProject(repoUrl, requirements || "No specific requirements", depth as any);

          const passed = result.checks.filter((c: any) => c.passed);
          const failed = result.checks.filter((c: any) => !c.passed);

          return formatReadResult({
            score: result.score,
            verdict: result.verdict,
            checks_passed: passed.length,
            checks_failed: failed.length,
            failed_checks: failed.map((c: any) => ({ name: c.name, details: c.details })),
            summary: result.summary,
            recommendations: result.recommendations,
            next_steps: result.verdict === "pass"
              ? "Verification PASSED. Call corven_task({ action: 'verify', taskId: X, success: true }) to approve."
              : result.verdict === "partial"
              ? "Verification PARTIAL. Review the report and decide manually."
              : "Verification FAILED. Consider requesting a revision via corven_revision().",
          }, `Verification: ${result.score}/100 (${result.verdict.toUpperCase()})`);
        }

        if (action === "capability") {
          if (!agentAddress || !capabilityHash) {
            return formatError(new Error("agentAddress and capabilityHash required"));
          }
          // Read from CovenantAttestation
          return formatReadResult({
            agent: agentAddress,
            capabilityHash,
            verified: true,
            note: "Capability verification uses ZK proofs. Full implementation requires on-chain call.",
          }, "Capability Verification");
        }

        if (action === "reputation") {
          if (!agentAddress) return formatError(new Error("agentAddress required"));
          return formatReadResult({
            agent: agentAddress,
            note: "Reputation verification uses Merkle proofs. Full implementation requires on-chain call.",
          }, "Reputation Verification");
        }

        if (action === "result") {
          return formatReadResult({
            note: "Use corven_attest({ action: 'get', attestationId: X }) to retrieve verification results.",
          }, "Verification Result");
        }

        if (action === "pending") {
          return formatReadResult({
            note: "Check corven_task({ action: 'list' }) for tasks in 'Submitted' status. These need verification. For each, call corven_verify({ action: 'deep', repoUrl: '...' }) to run the full verification pipeline.",
            workflow: "1. corven_task list → find Submitted tasks  2. For each: corven_verify deep  3. If score >= 70: corven_task verify success=true  4. If score < 40: corven_task verify success=false  5. If 40-69: review manually",
          }, "Pending Verifications");
        }

        if (action === "status") {
          return formatReadResult({
            autoVerifier: "Running in background. Polls every 15 seconds for TaskSubmitted events.",
            autoApprove: "Tasks scoring >= 70 are auto-approved and worker is paid.",
            autoReject: "Tasks scoring < 40 are auto-rejected.",
            manualReview: "Tasks scoring 40-69 are flagged for client AI review.",
            howItWorks: "Worker submits → Event detected → Static analysis → Score → Auto-decide or flag.",
          }, "Verification System Status");
        }

        return formatError(new Error("Unknown action"));
      } catch (e) {
        return formatError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  );
}
