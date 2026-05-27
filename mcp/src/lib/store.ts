/**
 * Local JSON file persistence for in-memory MCP stores.
 *
 * Data lives under <cwd>/.covenant-data/<name>.json so it survives server
 * restarts while keeping the in-memory Map / Set semantics during runtime.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), ".covenant-data");

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Load a persisted store by name. Returns `defaultValue` when no file exists
 * or the file cannot be parsed.
 */
export function loadStore<T>(name: string, defaultValue: T): T {
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
 * Persist a store to disk immediately. Call after every mutation.
 */
export function saveStore<T>(name: string, data: T): void {
  ensureDir();
  const filePath = join(DATA_DIR, `${name}.json`);
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}
