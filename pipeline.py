"""State derivation and transition enforcement for the pipeline.

Current state is *derived* by replaying the immutable event log, never stored.
Transitions are validated: you can only advance one stage at a time, and you
cannot leave a terminal outcome (Hired / Rejected).
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from db import (
    DB_PATH,
    REJECTED,
    STAGES,
    TERMINAL,
    get_events,
    record_event,
    utcnow,
)


@dataclass
class CandidateState:
    id: int
    name: str
    email: Optional[str]
    role: Optional[str]
    source: Optional[str]
    stage: Optional[str]          # None only before the first move (treated as Applied)
    created_at: str
    entered_stage_at: Optional[str]  # when the current stage was entered
    hired: bool = False
    rejected: bool = False
    events: list = field(default_factory=list)

    @property
    def effective_stage(self) -> str:
        return self.stage if self.stage is not None else "Applied"

    @property
    def is_terminal(self) -> bool:
        return self.effective_stage in TERMINAL


def _parse(ts: str) -> datetime:
    # ISO 8601; tolerate a trailing 'Z'
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return datetime.fromisoformat(ts)


def derive_state(row: sqlite3.Row, events: list[sqlite3.Row]) -> CandidateState:
    stage: Optional[str] = None
    entered_at: Optional[str] = None
    hired = False
    rejected = False

    for ev in events:
        etype = ev["type"]
        if etype == "moved":
            stage = ev["to_stage"]
            entered_at = ev["created_at"]
        elif etype == "hired":
            stage = "Hired"
            entered_at = ev["created_at"]
            hired = True
        elif etype == "rejected":
            stage = "Rejected"
            entered_at = ev["created_at"]
            rejected = True

    return CandidateState(
        id=row["id"],
        name=row["name"],
        email=row["email"],
        role=row["role"],
        source=row["source"],
        stage=stage,
        created_at=row["created_at"],
        entered_stage_at=entered_at,
        hired=hired,
        rejected=rejected,
        events=list(events),
    )


def get_candidate_state(cid: int, path: str = DB_PATH) -> Optional[CandidateState]:
    from db import get_candidate
    row = get_candidate(cid, path=path)
    if row is None:
        return None
    events = get_events(cid, path=path)
    return derive_state(row, events)


def list_states(path: str = DB_PATH) -> list[CandidateState]:
    from db import list_candidates
    out = []
    for row in list_candidates(path=path):
        events = get_events(row["id"], path=path)
        out.append(derive_state(row, events))
    return out


class TransitionError(ValueError):
    """Raised when a requested move violates pipeline rules."""


def _next_stage(current: Optional[str]) -> Optional[str]:
    eff = current if current is not None else "Applied"
    if eff in TERMINAL:
        return None
    idx = STAGES.index(eff)
    if idx == len(STAGES) - 1:
        return "Hired"  # final move from Offer -> Hired
    return STAGES[idx + 1]


def move_forward(
    cid: int,
    actor: str = "recruiter",
    note: str = "",
    path: str = DB_PATH,
) -> CandidateState:
    state = get_candidate_state(cid, path=path)
    if state is None:
        raise TransitionError(f"candidate {cid} not found")
    if state.is_terminal:
        raise TransitionError(
            f"{state.name} is already at terminal stage {state.effective_stage}; "
            "cannot move further"
        )
    target = _next_stage(state.stage)
    if target is None:
        raise TransitionError("no further stage to advance to")
    record_event(
        cid,
        type="moved",
        actor=actor,
        note=note or f"moved {state.effective_stage} -> {target}",
        stage=state.effective_stage,
        to_stage=target,
        path=path,
    )
    return get_candidate_state(cid, path=path)


def reject_candidate(
    cid: int,
    actor: str = "recruiter",
    note: str = "",
    path: str = DB_PATH,
) -> CandidateState:
    state = get_candidate_state(cid, path=path)
    if state is None:
        raise TransitionError(f"candidate {cid} not found")
    if state.hired:
        raise TransitionError(
            f"{state.name} has already been hired; cannot reject"
        )
    if state.rejected:
        raise TransitionError(f"{state.name} is already rejected")
    record_event(
        cid,
        type="rejected",
        actor=actor,
        note=note or f"rejected at {state.effective_stage}",
        stage=state.effective_stage,
        to_stage="Rejected",
        path=path,
    )
    return get_candidate_state(cid, path=path)


def hire_candidate(
    cid: int,
    actor: str = "recruiter",
    note: str = "",
    path: str = DB_PATH,
) -> CandidateState:
    state = get_candidate_state(cid, path=path)
    if state is None:
        raise TransitionError(f"candidate {cid} not found")
    if state.rejected:
        raise TransitionError(
            f"{state.name} has been rejected; cannot hire"
        )
    if state.hired:
        raise TransitionError(f"{state.name} is already hired")
    if state.effective_stage != "Offer":
        raise TransitionError(
            f"{state.name} is at {state.effective_stage}; can only hire from Offer"
        )
    record_event(
        cid,
        type="hired",
        actor=actor,
        note=note or f"hired from Offer",
        stage="Offer",
        to_stage="Hired",
        path=path,
    )
    return get_candidate_state(cid, path=path)


def days_in_current_stage(state: CandidateState, now: Optional[datetime] = None) -> float:
    if state.entered_stage_at is None:
        return 0.0
    now = now or datetime.now(timezone.utc)
    entered = _parse(state.entered_stage_at)
    if entered.tzinfo is None:
        entered = entered.replace(tzinfo=timezone.utc)
    return (now - entered).total_seconds() / 86400.0


def iso_to_datetime(ts: str) -> datetime:
    return _parse(ts)