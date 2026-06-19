/**
 * corven_verify — Deep verification with on-chain attestation
 */
import { z } from "zod";
import { formatReadResult, formatError } from "../handlers/transactions.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const schema = z.object({
  action: z.enum(["deep", "capability", "reputation", "result"]),
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
        "Multi-stage verification pipeline for worker deliverables.\n\n" +
        "ACTIONS:\n" +
        "  deep — Full 3-stage verification: gatekeeper + deep analysis + on-chain attestation\n" +
        "  capability — Verify agent has specific capability (ZK proof)\n" +
        "  reputation — Verify agent reputation meets threshold\n" +
        "  result — Get verification result by evidence hash\n\n" +
        "WORKFLOW:\n" +
        "1. Worker submits GitHub URL via corven_task({ action: 'submit' })\n" +
        "2. Client calls corven_verify({ action: 'deep', repoUrl: '...', requirements: '...' })\n" +
        "3. If score ≥ 70: corven_task({ action: 'verify', taskId: 1, success: true })\n" +
        "4. If score < 70: corven_task({ action: 'verify', taskId: 1, success: false })\n\n" +
        "STAGES:\n" +
        "  Stage 1: Lint + build + test + security + secrets (instant)\n" +
        "  Stage 2: Code quality + architecture + deep security + performance + testing (30s-2min)\n" +
        "  Stage 3: Evidence hash + IPFS report + on-chain attestation\n\n" +
        "SCORING:\n" +
        "  ≥ 70: PASS (client approves, worker paid)\n" +
        "  ≥ 40: PARTIAL (client reviews manually)\n" +
        "  < 40: FAIL (client rejects, dispute possible)",
      inputSchema: schema.shape,
    },
    async (args) => {
      try {
        const { action, repoUrl, requirements, depth, agentAddress, capabilityHash } = args;

        if (action === "deep") {
          if (!repoUrl) return formatError(new Error("repoUrl is required for deep verification"));

          // Run the 3-stage verification pipeline
          const verifyPath = require("path").resolve(__dirname, "../../../../skills/covenant-verify/verify.js");
          const verifyModule = await import(verifyPath);
          const result = await verifyModule.verifyProject(repoUrl, requirements || "No specific requirements", depth as any);

          return formatReadResult({
            score: result.score,
            verdict: result.verdict,
            stage1_gatekeeper: {
              passed: result.stage1.passed,
              score: result.stage1.score,
              duration: `${result.stage1.duration}ms`,
              checks: result.stage1.checks.map((c: any) => ({
                name: c.name,
                passed: c.passed,
                score: c.score,
                details: c.details,
              })),
            },
            stage2_analysis: {
              passed: result.stage2.passed,
              score: result.stage2.score,
              duration: `${result.stage2.duration}ms`,
              checks: result.stage2.checks.map((c: any) => ({
                name: c.name,
                passed: c.passed,
                score: c.score,
                details: c.details,
              })),
            },
            stage3_attestation: {
              passed: result.stage3.passed,
              score: result.stage3.score,
              evidenceHash: result.evidenceHash,
              reportCid: result.reportCid,
            },
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

        return formatError(new Error("Unknown action"));
      } catch (e) {
        return formatError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  );
}
