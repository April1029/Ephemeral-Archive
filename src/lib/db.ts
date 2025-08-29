// /lib/db.ts
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "nowever.sqlite");

function ensureDirAndFile() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, "");
}

function migrate(db: Database.Database) {
  // idempotent schema (CREATE TABLE IF NOT EXISTS)
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      keepsake TEXT,             -- AI short form
      image_prompt TEXT,         -- AI image prompt
      image_url TEXT,            -- optional generated image
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC);
  `);

  // trigger to keep updated_at fresh
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_memories_updated_at
    AFTER UPDATE ON memories
    BEGIN
      UPDATE memories SET updated_at = datetime('now') WHERE id = NEW.id;
    END;
  `);
}

// Singleton pattern across hot reloads
declare global {
  // eslint-disable-next-line no-var
  var __NOWEVER_DB__: Database.Database | undefined;
}

let db: Database.Database;

if (!global.__NOWEVER_DB__) {
  ensureDirAndFile();
  db = new Database(DB_PATH, { verbose: undefined }); // set verbose: console.log to debug SQL
  migrate(db);
  global.__NOWEVER_DB__ = db;
} else {
  db = global.__NOWEVER_DB__;
}

export default db;
export { DB_PATH };
