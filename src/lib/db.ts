// Pure-fetch Turso client — no native binaries, works on Vercel serverless
type SqlArg = string | number | bigint | null;

interface Col { name: string }
interface RowValue { type: string; value: string | null }

interface ExecuteResult {
  cols: Col[];
  rows: RowValue[][];
  affected_row_count: number;
  last_insert_rowid: string | null;
}

export type Row = Record<string, unknown>;

export interface QueryResult {
  columns: string[];
  rows: Row[];
  rowsAffected: number;
  lastInsertRowid?: bigint;
}

function getEndpoint(): string {
  const url = process.env.TURSO_DATABASE_URL ?? "";
  // Convert libsql:// → https://
  return url.replace(/^libsql:\/\//, "https://");
}

function toArg(v: SqlArg): object {
  if (v === null || v === undefined) return { type: "null" };
  if (typeof v === "bigint") return { type: "integer", value: String(v) };
  if (typeof v === "number") {
    return Number.isInteger(v)
      ? { type: "integer", value: String(v) }
      : { type: "float", value: String(v) };
  }
  return { type: "text", value: String(v) };
}

function toRow(cols: Col[], row: RowValue[]): Row {
  return Object.fromEntries(cols.map((c, i) => [c.name, row[i]?.value ?? null]));
}

async function pipeline(requests: object[]): Promise<ExecuteResult[]> {
  const res = await fetch(`${getEndpoint()}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TURSO_AUTH_TOKEN ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Turso HTTP ${res.status}: ${text}`);
  }

  const data = await res.json();
  const results: ExecuteResult[] = [];

  for (const r of data.results ?? []) {
    if (r.type === "error") {
      throw new Error(`Turso query error: ${r.error?.message ?? "unknown"}`);
    }
    if (r.response?.type === "execute") {
      results.push(r.response.result);
    }
  }

  return results;
}

export async function execute(sql: string, args: SqlArg[] = []): Promise<QueryResult> {
  const [result] = await pipeline([
    { type: "execute", stmt: { sql, args: args.map(toArg) } },
    { type: "close" },
  ]);

  return {
    columns: result.cols.map((c) => c.name),
    rows: result.rows.map((row) => toRow(result.cols, row)),
    rowsAffected: result.affected_row_count,
    lastInsertRowid: result.last_insert_rowid
      ? BigInt(result.last_insert_rowid)
      : undefined,
  };
}

async function executeMultiple(statements: string[]): Promise<void> {
  await pipeline([
    ...statements.map((sql) => ({ type: "execute", stmt: { sql, args: [] } })),
    { type: "close" },
  ]);
}

// Idempotent migrations — runs once per cold start
let migrated = false;

export async function ensureMigrated(): Promise<void> {
  if (migrated) return;

  await executeMultiple([
    `CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      keepsake TEXT,
      image_prompt TEXT,
      image_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC)`,
  ]);

  migrated = true;
}
