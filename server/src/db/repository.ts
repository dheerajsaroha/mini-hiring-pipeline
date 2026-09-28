import { getDb } from "./database.js";
import { Stage, Candidate, StageEvent, CandidateWithHistory, canTransition } from "shared";
import { getNextStage } from "shared";

const db = getDb();

export interface CreateCandidateInput {
  name: string;
  email?: string;
  createdAt?: string;
}

export interface TransitionInput {
  to: Stage;
  expectedStage: Stage;
  note?: string;
}

function rowToCandidate(row: any): Candidate {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
  };
}

function rowToEvent(row: any): StageEvent {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    fromStage: row.from_stage as Stage | null,
    toStage: row.to_stage as Stage,
    occurredAt: row.occurred_at,
    note: row.note,
  };
}

export function createCandidate(input: CreateCandidateInput): Candidate {
  const createdAt = input.createdAt || new Date().toISOString();
  const stmt = db.prepare(
    "INSERT INTO candidates (name, email, created_at) VALUES (?, ?, ?)"
  );
  const result = stmt.run(input.name, input.email ?? null, createdAt);
  const candidateId = result.lastInsertRowid as number;

  // Insert initial event: Applied
  const eventStmt = db.prepare(
    `INSERT INTO stage_events (candidate_id, from_stage, to_stage, occurred_at, note)
     VALUES (?, NULL, 'Applied', ?, ?)`
  );
  eventStmt.run(candidateId, createdAt, `Candidate ${input.name} added`);

  const candidate = getCandidateById(candidateId);
  if (!candidate) throw new Error("Failed to create candidate");
  
  // Attach createdAt to the returned candidate for seeding purposes
  (candidate as any)._createdAt = createdAt;
  return candidate;
}

export function getCandidateById(id: number): Candidate | null {
  const row = db.prepare("SELECT * FROM candidates WHERE id = ?").get(id);
  return row ? rowToCandidate(row) : null;
}

export function getCandidateWithHistory(id: number, now: Date = new Date()): CandidateWithHistory | null {
  const candidate = getCandidateById(id);
  if (!candidate) return null;

  const events = db
    .prepare("SELECT * FROM stage_events WHERE candidate_id = ? ORDER BY occurred_at ASC, id ASC")
    .all(id) as any[];

  const history = events.map(rowToEvent);
  const currentStage = history.length > 0 ? history[history.length - 1].toStage : "Applied";
  const enteredStageAt = history.length > 0 ? history[history.length - 1].occurredAt : candidate.createdAt;

  const timeInStageMs = now.getTime() - new Date(enteredStageAt).getTime();
  const timeInStageDays = timeInStageMs / (1000 * 60 * 60 * 24);

  return {
    ...candidate,
    currentStage,
    timeInStageDays,
    history,
  };
}

export function listCandidatesGroupedByStage(now: Date = new Date()): Record<Stage, CandidateWithHistory[]> {
  const candidates = db.prepare("SELECT * FROM candidates ORDER BY id DESC").all() as any[];
  const grouped: Record<Stage, CandidateWithHistory[]> = {
    Applied: [],
    Screening: [],
    Interview: [],
    Offer: [],
    Hired: [],
    Rejected: [],
  };

  for (const row of candidates) {
    const withHistory = getCandidateWithHistory(row.id, now);
    if (withHistory) {
      grouped[withHistory.currentStage].push(withHistory);
    }
  }

  return grouped;
}

export function transitionCandidate(
  candidateId: number,
  input: TransitionInput,
  now: Date = new Date()
): CandidateWithHistory | null {
  const candidate = getCandidateWithHistory(candidateId, now);
  if (!candidate) return null;

  // Validate expectedStage matches current stage
  if (candidate.currentStage !== input.expectedStage) {
    throw new Error(`Expected stage ${input.expectedStage}, but current stage is ${candidate.currentStage}`);
  }

  // Validate transition
  if (!canTransition(candidate.currentStage, input.to)) {
    const next = getNextStage(candidate.currentStage);
    if (input.to === "Rejected") {
      throw new Error(`Cannot reject from ${candidate.currentStage}`);
    }
    throw new Error(`Can't move from ${candidate.currentStage} to ${input.to}. Next stage is ${next}.`);
  }

  const occurredAt = now.toISOString();
  const eventStmt = db.prepare(
    `INSERT INTO stage_events (candidate_id, from_stage, to_stage, occurred_at, note)
     VALUES (?, ?, ?, ?, ?)`
  );
  eventStmt.run(candidateId, candidate.currentStage, input.to, occurredAt, input.note ?? null);

  return getCandidateWithHistory(candidateId, now);
}

export function searchCandidates(query: string, now: Date = new Date()): CandidateWithHistory[] {
  // This will be implemented in the search module
  // For now, return all candidates
  const candidates = db.prepare("SELECT * FROM candidates ORDER BY id DESC").all() as any[];
  return candidates.map((row) => getCandidateWithHistory(row.id, now)!).filter(Boolean);
}