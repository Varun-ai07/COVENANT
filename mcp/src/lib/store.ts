/**
 * Persistent store for MCP tools.
 * Uses SQLite (via better-sqlite3) for crash-safe storage.
 * Falls back to JSON files if SQLite is unavailable.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), ".covenant-data");

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Try to load SQLite store
let sqliteStore: any = null;
try {
  sqliteStore = require("./sqlite-store.js");
} catch {
  // SQLite not available, use JSON fallback
}

/**
 * Load a persisted store by name.
 */
export function loadStore<T>(name: string, defaultValue: T): T {
  if (sqliteStore) {
    return sqliteStore.loadStore(name, defaultValue);
  }

  // JSON fallback
  ensureDir();
  const filePath = join(DATA_DIR, `${name}.json`);
  if (!existsSync(filePath)) return defaultValue;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Persist a store to disk atomically.
 */
export function saveStore<T>(name: string, data: T): void {
  if (sqliteStore) {
    sqliteStore.saveStore(name, data);
    return;
  }

  // JSON fallback with atomic write
  ensureDir();
  const filePath = join(DATA_DIR, `${name}.json`);
  const tmpPath = `${filePath}.tmp.${Date.now()}`;
  try {
    writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    renameSync(tmpPath, filePath);
  } catch (e) {
    try { unlinkSync(tmpPath); } catch {}
    throw e;
  }
}
