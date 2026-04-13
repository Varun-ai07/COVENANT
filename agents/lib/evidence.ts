/**
 * Evidence management for VerifierBot
 * Stores verification results, logs, and provides audit trail
 */

import * as fs from "fs";
import * as path from "path";
import { uploadToIPFS, downloadFromIPFS } from "./ipfs.js";

// Local storage directory match ipfs.ts
const LOCAL_STORAGE_DIR = path.join(process.cwd(), ".ipfs-cache");

export interface CheckResult {
  checkerName: string;
  score: number;
  maxScore: number;
  passed: boolean;
  details: string;
  evidence?: any;
}

export interface Evidence {
  taskId: bigint;
  verifierAddress: string;
  timestamp: string;
  checkResults: CheckResult[];
  finalScore: number;
  success: boolean;
  feedback: string;
  deliverableHash?: string;
  deterministicScore: number;
  llmScore: number;
  transactionHash?: string;
}

const EVIDENCE_DIR = path.join(process.cwd(), ".verifier-evidence");

function ensureEvidenceDir() {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
}

/**
 * Save verification evidence to local storage and optionally IPFS
 */
export async function saveEvidence(evidence: Evidence): Promise<string> {
  ensureEvidenceDir();

  // Save locally
  const fileName = `evidence-${evidence.taskId}.json`;
  const filePath = path.join(EVIDENCE_DIR, fileName);
  const content = JSON.stringify(evidence, null, 2);
  fs.writeFileSync(filePath, content);
  console.log(`[Evidence] Saved to ${filePath}`);

  // Also pin to IPFS if configured
  try {
    const ipfsResult = await uploadToIPFS(evidence);
    console.log(`[Evidence] Pinned to IPFS: ${ipfsResult}`);
    return ipfsResult;
  } catch (error) {
    console.warn(`[Evidence] IPFS pinning failed, using local only: ${error}`);
    return filePath;
  }
}

/**
 * Load evidence for a specific task
 */
export function loadEvidence(taskId: bigint): Evidence | null {
  const fileName = `evidence-${taskId}.json`;
  const filePath = path.join(EVIDENCE_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as Evidence;
  } catch (error) {
    console.error(`[Evidence] Failed to load evidence for task ${taskId}:`, error);
    return null;
  }
}

/**
 * Check if evidence exists for a task (already verified)
 */
export function hasEvidence(taskId: bigint): boolean {
  const fileName = `evidence-${taskId}.json`;
  const filePath = path.join(EVIDENCE_DIR, fileName);
  return fs.existsSync(filePath);
}

/**
 * List all evidence files
 */
export function listEvidence(): string[] {
  ensureEvidenceDir();
  const files = fs.readdirSync(EVIDENCE_DIR).filter(f => f.startsWith('evidence-') && f.endsWith('.json'));
  return files.map(f => f.replace('evidence-', '').replace('.json', ''));
}

/**
 * Clean up old evidence files (keep last N)
 */
export function cleanupOldEvidence(keepCount: number = 100): void {
  ensureEvidenceDir();
  const files = fs.readdirSync(EVIDENCE_DIR)
    .filter(f => f.startsWith('evidence-') && f.endsWith('.json'))
    .map(f => ({
      name: f,
      mtime: fs.statSync(path.join(EVIDENCE_DIR, f)).mtime
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  const toDelete = files.slice(keepCount);
  for (const file of toDelete) {
    fs.unlinkSync(path.join(EVIDENCE_DIR, file.name));
    console.log(`[Evidence] Cleaned up old evidence: ${file.name}`);
  }
}
