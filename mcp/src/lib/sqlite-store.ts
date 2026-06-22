/**
 * SQLite-backed persistent store for MCP tools.
 *
 * Uses better-sqlite3 with WAL mode for:
 * - Crash-safe atomic writes
 * - Concurrent read safety
 * - Better performance on large datasets
 * - Automatic recovery
 */
import Database from "better-sqlite3";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";

const DATA_DIR = join(homedir(), ".covenant-data");
const DB_PATH = join(DATA_DIR, "covenant.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
    db.exec(`
      CREATE TABLE IF NOT EXISTS kv (
        store TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (store, key)
      )
    `);
  }
  return db;
}

/**
 * Load a value from the store. Returns defaultValue if not found.
 */
export function loadStore<T>(name: string, defaultValue: T): T {
  try {
    const d = getDb();
    const row = d.prepare("SELECT value FROM kv WHERE store = ? AND key = ?").get(name, "_data_") as any;
    if (!row) return defaultValue;
    return JSON.parse(row.value) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Save a value to the store atomically.
 */
export function saveStore<T>(name: string, data: T): void {
  const d = getDb();
  d.prepare("INSERT OR REPLACE INTO kv (store, key, value) VALUES (?, ?, ?)")
    .run(name, "_data_", JSON.stringify(data));
}

/**
 * Close the database connection.
 */
export function closeStore(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Graceful shutdown
process.on("exit", closeStore);
process.on("SIGINT", () => { closeStore(); process.exit(0); });
process.on("SIGTERM", () => { closeStore(); process.exit(0); });
