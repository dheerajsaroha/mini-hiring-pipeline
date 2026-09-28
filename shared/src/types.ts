export type Stage = "Applied" | "Screening" | "Interview" | "Offer" | "Hired" | "Rejected";

export const STAGES: Stage[] = ["Applied", "Screening", "Interview", "Offer", "Hired"];
export const TERMINAL_STAGES: Stage[] = ["Hired", "Rejected"];

export function isTerminalStage(stage: Stage): boolean {
  return TERMINAL_STAGES.includes(stage);
}

export function getNextStage(current: Stage): Stage | null {
  if (isTerminalStage(current)) return null;
  const idx = STAGES.indexOf(current);
  if (idx === -1) return null;
  if (idx === STAGES.length - 1) return "Hired";
  return STAGES[idx + 1];
}

export function canTransition(from: Stage, to: Stage): boolean {
  if (from === to) return false;
  if (isTerminalStage(from)) return false;
  if (to === "Rejected") return !isTerminalStage(from);
  const next = getNextStage(from);
  return next === to;
}

export interface Candidate {
  id: number;
  name: string;
  email: string | null;
  createdAt: string;
}

export interface StageEvent {
  id: number;
  candidateId: number;
  fromStage: Stage | null;
  toStage: Stage;
  occurredAt: string;
  note: string | null;
}

export interface CandidateWithHistory extends Candidate {
  currentStage: Stage;
  timeInStageDays: number;
  history: StageEvent[];
}

export interface CreateCandidateInput {
  name: string;
  email?: string;
}

export interface TransitionInput {
  to: Stage;
  expectedStage: Stage;
  note?: string;
}

export interface SearchResultItem {
  candidate: CandidateWithHistory;
  matchScore: number;
  match: boolean;
}

export interface SearchResponse {
  interpretation: string;
  results: SearchResultItem[];
  error?: string;
}