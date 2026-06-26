/**
 * corven_version — Track, browse, and diff deliverable versions for tasks.
 */
import { z } from "zod";
import { loadStore, saveStore } from "../lib/store.js";
import { formatReadResult, formatError } from "../handlers/transactions.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface VersionEntry {
  hash: string;
  version: string;
  description: string;
  timestamp: number;
  submittedBy: string;
}

interface TaskVersions {
  taskId: string;
  versions: VersionEntry[];
}

const schema = z.object({
  action: z
    .enum(["track", "history", "diff"])
    .describe(
      "track: record a new version. history: list all versions for a task. diff: compare two versions."
    ),
  taskId: z.string().describe("Task ID"),
  deliverableHash: z.string().optional().describe("IPFS CID or content hash of the deliverable (required for track)"),
  version: z.string().optional().describe("Semantic version label, e.g. v1.0 (optional, auto-assigned if omitted)"),
  description: z.string().optional().describe("Human-readable description of this version"),
  confirm: z.boolean().optional().describe("Confirm overwrite if version label already exists"),
  versionA: z.string().optional().describe("First version hash for diff"),
  versionB: z.string().optional().describe("Second version hash for diff"),
});

function getVersions(taskId: string): TaskVersions {
  const store = loadStore<TaskVersions[]>("deliverable_versions", []);
  return store.find((v) => v.taskId === taskId) || { taskId, versions: [] };
}

function saveVersions(entry: TaskVersions): void {
  const store = loadStore<TaskVersions[]>("deliverable_versions", []);
  const idx = store.findIndex((v) => v.taskId === entry.taskId);
  if (idx >= 0) store[idx] = entry;
  else store.push(entry);
  saveStore("deliverable_versions", store);
}

export function registerVersionTools(server: McpServer): void {
  server.registerTool(
    "corven_version",
    {
      title: "Deliverable Version Tracking",
      description:
        "Track, browse, and diff deliverable versions for tasks on COVENANT.\n\n" +
        "ACTIONS:\n" +
        "  track — Record a new version for a task's deliverable\n" +
        "  history — List all recorded versions for a task\n" +
        "  diff — Compare two versions by hash and timestamp\n\n" +
        "USE WHEN: A task deliverable has been updated and you need to version it,\n" +
        "or when reviewing the version history of a deliverable.\n\n" +
        "WORKFLOW: track each submission → history to review → diff to compare\n\n" +
        "OUTPUT RULES:\n" +
        "- Present results as clean, readable text. Never show raw JSON.\n" +
        "- On error: Explain in plain language what went wrong and suggest next step.",
      inputSchema: schema.shape,
    },
    async (args) => {
      try {
        const { action, taskId, deliverableHash, version, description, confirm, versionA, versionB } = args;

        if (action === "track") {
          if (!deliverableHash) {
            return formatError(new Error("deliverableHash is required for track action"));
          }

          const entry = getVersions(taskId);
          const versionLabel = version || `v${entry.versions.length + 1}.0`;

          // Check for duplicate version label
          const existing = entry.versions.find((v) => v.version === versionLabel);
          if (existing && !confirm) {
            return formatError(
              new Error(
                `Version "${versionLabel}" already exists (hash: ${existing.hash}). ` +
                `Set confirm=true to overwrite, or provide a different version label.`
              )
            );
          }

          const newVersion: VersionEntry = {
            hash: deliverableHash,
            version: versionLabel,
            description: description || "",
            timestamp: Date.now(),
            submittedBy: "current-agent",
          };

          if (existing) {
            const idx = entry.versions.indexOf(existing);
            entry.versions[idx] = newVersion;
          } else {
            entry.versions.push(newVersion);
          }

          saveVersions(entry);

          return formatReadResult(
            {
              taskId,
              version: versionLabel,
              hash: deliverableHash,
              totalVersions: entry.versions.length,
              tracked: true,
            },
            `Version Tracked: ${versionLabel}`
          );
        }

        if (action === "history") {
          const entry = getVersions(taskId);
          if (entry.versions.length === 0) {
            return formatReadResult(
              { taskId, versions: [], message: "No versions tracked for this task yet." },
              `Version History: ${taskId}`
            );
          }

          return formatReadResult(
            {
              taskId,
              totalVersions: entry.versions.length,
              versions: entry.versions.map((v) => ({
                version: v.version,
                hash: v.hash,
                description: v.description,
                timestamp: new Date(v.timestamp).toISOString(),
              })),
            },
            `Version History: ${taskId}`
          );
        }

        if (action === "diff") {
          if (!versionA || !versionB) {
            return formatError(new Error("Both versionA and versionB are required for diff action"));
          }

          const entry = getVersions(taskId);
          const verA = entry.versions.find((v) => v.hash === versionA || v.version === versionA);
          const verB = entry.versions.find((v) => v.hash === versionB || v.version === versionB);

          if (!verA) return formatError(new Error(`Version "${versionA}" not found for task ${taskId}`));
          if (!verB) return formatError(new Error(`Version "${versionB}" not found for task ${taskId}`));

          const hashMatch = verA.hash === verB.hash;
          const timeDiff = Math.abs(verA.timestamp - verB.timestamp);

          return formatReadResult(
            {
              taskId,
              versionA: { version: verA.version, hash: verA.hash, timestamp: new Date(verA.timestamp).toISOString(), description: verA.description },
              versionB: { version: verB.version, hash: verB.hash, timestamp: new Date(verB.timestamp).toISOString(), description: verB.description },
              identical: hashMatch,
              timeBetween: `${Math.round(timeDiff / 1000)}s`,
            },
            `Diff: ${verA.version} vs ${verB.version}`
          );
        }

        return formatError(new Error(`Unknown action: ${action}`));
      } catch (e) {
        return formatError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  );
}
