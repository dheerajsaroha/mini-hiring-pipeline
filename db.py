"""SQLite persistence for the mini hiring pipeline.

The audit trail is event-sourced: every state change is an immutable row in
``events``. The candidate's current state is derived by replaying the events,
so nothing can be altered after it is recorded.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterator, Optional

DB_PATH = "pipeline.db"

# Stages in order. Rejection is a terminal outcome, Hired is the other one.
STAGES = ("Applied", "Screening", "Interview", "Offer", "Hired")
REJECTED = "Rejected"
TERMINAL = ("Hired", "Rejected")


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Event:
    id: int
    candidate_id: int
    type: str
    stage: Optional[str]
    to_stage: Optional[str]
    actor: str
    note: str
    created_at: str
    payload: Optional[str]


SCHEMA = """
CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT,
    source TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL REFERENCES candidates(id),
    type TEXT NOT NULL,            -- e.g. 'created', 'moved', 'rejected', 'hired', 'note'
    stage TEXT,                    -- previous stage (for moves) or context
    to_stage TEXT,                 -- new stage (for moves)
    actor TEXT NOT NULL,
    note TEXT,
    payload TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_candidate ON events(candidate_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
"""


@contextmanager
def connection(path: str = DB_PATH) -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(path: str = DB_PATH) -> None:
    with connection(path) as conn:
        conn.executescript(SCHEMA)


def add_candidate(
    name: str,
    email: Optional[str] = None,
    role: Optional[str] = None,
    source: Optional[str] = None,
    actor: str = "recruiter",
    path: str = DB_PATH,
) -> int:
    created_at = utcnow()
    with connection(path) as conn:
        cur = conn.execute(
            "INSERT INTO candidates (name, email, role, source, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (name, email, role, source, created_at),
        )
        cid = cur.lastrowid
        conn.execute(
            "INSERT INTO events (candidate_id, type, stage, to_stage, actor, note, created_at) "
            "VALUES (?, 'created', NULL, NULL, ?, ?, ?)",
            (cid, actor, f"Candidate {name} added", created_at),
        )
        return cid


def record_event(
    candidate_id: int,
    event_type: str,
    actor: str = "recruiter",
    note: str = "",
    stage: Optional[str] = None,
    to_stage: Optional[str] = None,
    payload: Optional[str] = None,
    path: str = DB_PATH,
) -> int:
    created_at = utcnow()
    with connection(path) as conn:
        cur = conn.execute(
            "INSERT INTO events (candidate_id, type, stage, to_stage, actor, note, payload, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (candidate_id, event_type, stage, to_stage, actor, note, payload, created_at),
        )
        return cur.lastrowid


def get_candidate(cid: int, path: str = DB_PATH) -> Optional[sqlite3.Row]:
    with connection(path) as conn:
        return conn.execute("SELECT * FROM candidates WHERE id = ?", (cid,)).fetchone()


def get_events(cid: int, path: str = DB_PATH) -> list[sqlite3.Row]:
    with connection(path) as conn:
        return conn.execute(
            "SELECT * FROM events WHERE candidate_id = ? ORDER BY created_at ASC, id ASC",
            (cid,),
        ).fetchall()


def list_candidates(path: str = DB_PATH) -> list[sqlite3.Row]:
    with connection(path) as conn:
        return conn.execute("SELECT * FROM candidates ORDER BY id DESC").fetchall()