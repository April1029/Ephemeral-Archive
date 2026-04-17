import { createClient, type ResultSet } from "@libsql/client/http";

const url = process.env.TURSO_DATABASE_URL ?? "file:./data/nowever.sqlite";
const authToken = process.env.TURSO_AUTH_TOKEN;

export const db = createClient({ url, authToken });

// Convert a libsql ResultSet row to a plain object safe for JSON serialization
export function toRows(result: ResultSet): Record<string, unknown>[] {
  return result.rows.map((row) =>
    Object.fromEntries(result.columns.map((col, i) => [col, row[i]]))
  );
}

export function toRow(result: ResultSet): Record<string, unknown> | null {
  if (result.rows.length === 0) return null;
  return toRows(result)[0];
}

// Idempotent schema – runs on every cold start (safe because of IF NOT EXISTS)
let migrated = false;

export async function ensureMigrated() {
  if (migrated) return;

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      keepsake TEXT,
      image_prompt TEXT,
      image_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC);
  `);

  migrated = true;
}
