import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "pipeline.db");

const db = new Database(DB_PATH);

db.pragma("foreign_keys = ON");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id),
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  note TEXT,
  prev_hash TEXT,
  hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_stage_events_candidate ON stage_events(candidate_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_stage_events_to_stage ON stage_events(to_stage);

-- Trigger to prevent updates on stage_events (append-only audit log)
CREATE TRIGGER IF NOT EXISTS prevent_stage_events_update
BEFORE UPDATE ON stage_events
BEGIN
  SELECT RAISE(ABORT, 'audit log is append-only: updates not allowed');
END;

-- Trigger to prevent deletes on stage_events (append-only audit log)
CREATE TRIGGER IF NOT EXISTS prevent_stage_events_delete
BEFORE DELETE ON stage_events
BEGIN
  SELECT RAISE(ABORT, 'audit log is append-only: deletes not allowed');
END;
`;

function getDbInternal(): any {
  return db;
}

export function getDb(): any {
  return getDbInternal();
}

export function initDb(): void {
  db.exec(SCHEMA);
}

export function closeDb(): void {
  db.close();
}