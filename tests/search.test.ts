import { describe, it, expect, beforeEach } from "vitest";
import { tokenize } from "../server/src/search/tokenizer.js";
import { parse } from "../server/src/search/parser.js";
import { validate } from "../server/src/search/validator.js";
import { evaluate, buildInterpretation, calculateTextMatchScore } from "../server/src/search/evaluator.js";
import { search, rankResults } from "../server/src/search/ranker.js";
import { CandidateWithHistory, StageEvent, Stage } from "shared";

const now = new Date("2026-09-28T12:00:00Z");

function createCandidate(
  name: string,
  history: StageEvent[],
  createdAt: string = "2026-09-01T12:00:00Z"
): CandidateWithHistory {
  const currentStage = history.length > 0 ? history[history.length - 1].toStage : "Applied";
  const enteredStageAt = history.length > 0 ? history[history.length - 1].occurredAt : createdAt;
  const timeInStageDays = (now.getTime() - new Date(enteredStageAt).getTime()) / (1000 * 60 * 60 * 24);

  return {
    id: 1,
    name,
    email: null,
    createdAt,
    currentStage,
    timeInStageDays,
    history,
  };
}

function event(id: number, candidateId: number, fromStage: Stage | null, toStage: Stage, daysAgo: number, note?: string): StageEvent {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  return {
    id,
    candidateId,
    fromStage,
    toStage,
    occurredAt: d.toISOString(),
    note: note ?? null,
  };
}

describe("Tokenizer", () => {
  it("tokenizes simple text", () => {
    const tokens = tokenize("Priya Sharma");
    expect(tokens.filter(t => t.type !== "EOF")).toHaveLength(2);
    expect(tokens[0].value).toBe("Priya");
    expect(tokens[1].value).toBe("Sharma");
  });

  it("tokenizes stage keywords", () => {
    const tokens = tokenize("in interview");
    expect(tokens.find(t => t.type === "STAGE")).toBeDefined();
    expect(tokens.find(t => t.value === "interview")).toBeDefined();
  });

  it("tokenizes stage: prefix", () => {
    const tokens = tokenize("stage:interview");
    expect(tokens.find(t => t.type === "STAGE")).toBeDefined();
    expect(tokens.find(t => t.type === "COLON")).toBeDefined();
  });

  it("tokenizes stuck query", () => {
    const tokens = tokenize("stuck in screening more than a week");
    expect(tokens.find(t => t.type === "TIME_STUCK")).toBeDefined();
  });

  it("tokenizes moved query", () => {
    const tokens = tokenize("moved to interview since monday");
    expect(tokens.find(t => t.type === "TIME_MOVED")).toBeDefined();
  });

  it("tokenizes reached query", () => {
    const tokens = tokenize("reached offer not hired");
    expect(tokens.find(t => t.type === "REACHED")).toBeDefined();
  });

  it("tokenizes negation", () => {
    const tokens = tokenize("not rejected");
    expect(tokens.find(t => t.type === "OPERATOR_NOT")).toBeDefined();
  });

  it("tokenizes hyphen negation", () => {
    const tokens = tokenize("-stage:rejected");
    expect(tokens.find(t => t.type === "OPERATOR_NOT")).toBeDefined();
  });
});

describe("Parser", () => {
  it("parses text search", () => {
    const tokens = tokenize("Priya Sharma");
    const ast = parse(tokens);
    expect(ast.type).toBe("AND"); // implicit AND between two TEXT_SEARCH
  });

  it("parses stage equals", () => {
    const tokens = tokenize("in interview");
    const ast = parse(tokens);
    expect(ast.type).toBe("STAGE_EQUALS");
    expect((ast as any).stage).toBe("Interview");
  });

  it("parses stage: prefix", () => {
    const tokens = tokenize("stage:interview");
    const ast = parse(tokens);
    expect(ast.type).toBe("STAGE_EQUALS");
    expect((ast as any).stage).toBe("Interview");
  });

  it("parses stuck query with default 7 days", () => {
    const tokens = tokenize("stuck in screening");
    const ast = parse(tokens);
    expect(ast.type).toBe("STUCK_IN_STAGE");
    expect((ast as any).stage).toBe("Screening");
    expect((ast as any).days).toBe(7);
  });

  it("parses stuck query with custom days", () => {
    const tokens = tokenize("stuck in screening more than 10 days");
    const ast = parse(tokens);
    expect(ast.type).toBe("STUCK_IN_STAGE");
    expect((ast as any).stage).toBe("Screening");
    expect((ast as any).days).toBe(10);
  });

  it("parses moved query", () => {
    const tokens = tokenize("moved to interview since monday");
    const ast = parse(tokens);
    expect(ast.type).toBe("MOVED_TO_STAGE_SINCE");
    expect((ast as any).stage).toBe("Interview");
    expect((ast as any).date).toBeDefined();
  });

  it("parses reached not hired", () => {
    const tokens = tokenize("reached offer not hired");
    const ast = parse(tokens);
    expect(ast.type).toBe("REACHED_STAGE_NOT_HIRED");
    expect((ast as any).stage).toBe("Offer");
    expect((ast as any).value).toBe("true");
  });

  it("parses negation", () => {
    const tokens = tokenize("not rejected");
    const ast = parse(tokens);
    expect(ast.type).toBe("NOT");
    expect(ast.left?.type).toBe("STAGE_EQUALS");
    expect((ast.left as any).stage).toBe("Rejected");
  });

  it("parses combined query with implicit AND", () => {
    const tokens = tokenize("sharma in interview not rejected");
    const ast = parse(tokens);
    expect(ast.type).toBe("AND");
  });
});

describe("Validator", () => {
  it("validates correct queries", () => {
    const tokens = tokenize("in interview");
    const ast = parse(tokens);
    const result = validate(ast, now);
    expect(result.valid).toBe(true);
  });

  it("rejects unknown stage", () => {
    const tokens = tokenize("stage:interveiw");
    const ast = parse(tokens);
    const result = validate(ast, now);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("isn't a stage"))).toBe(true);
  });

  it("rejects stuck in terminal stage", () => {
    const tokens = tokenize("stuck in hired");
    const ast = parse(tokens);
    const result = validate(ast, now);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("final stage"))).toBe(true);
  });

  it("rejects future since date", () => {
    const tokens = tokenize("moved to interview since tomorrow");
    const ast = parse(tokens);
    const result = validate(ast, now);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("future"))).toBe(true);
  });

  it("detects contradiction: stage:hired and not hired", () => {
    const tokens = tokenize("stage:hired reached offer not hired");
    const ast = parse(tokens);
    const result = validate(ast, now);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("can't both be true"))).toBe(true);
  });
});

describe("Evaluator - Fuzzy Matching", () => {
  it("scores exact match highest", () => {
    const score = calculateTextMatchScore("Priya Sharma", "Priya Sharma");
    expect(score).toBe(100);
  });

  it("scores prefix match high", () => {
    const score = calculateTextMatchScore("Priya", "Priya Sharma");
    expect(score).toBeGreaterThan(70);
  });

  it("handles transposition (sharam -> sharma)", () => {
    const score = calculateTextMatchScore("sharam", "Priya Sharma");
    expect(score).toBeGreaterThan(30);
  });

  it("handles typo (priya shrama -> Priya Sharma)", () => {
    const score = calculateTextMatchScore("priya shrama", "Priya Sharma");
    expect(score).toBeGreaterThan(50);
  });

  it("handles transposition (pryia -> Priya)", () => {
    const score = calculateTextMatchScore("pryia", "Priya Sharma");
    expect(score).toBeGreaterThan(30);
  });

  it("returns low score for no match", () => {
    const score = calculateTextMatchScore("xyz", "Priya Sharma");
    expect(score).toBeLessThan(30);
  });
});

describe("Evaluator - Query Evaluation", () => {
  const priya = createCandidate("Priya Sharma", [
    event(1, 1, null, "Applied", 28),
    event(2, 1, "Applied", "Screening", 10),
  ]);

  const rajesh = createCandidate("Rajesh Kumar", [
    event(1, 2, null, "Applied", 14),
    event(2, 2, "Applied", "Screening", 10),
    event(3, 2, "Screening", "Interview", 3),
  ]);

  const anjali = createCandidate("Anjali Mehta", [
    event(1, 3, null, "Applied", 21),
    event(2, 3, "Applied", "Screening", 17),
    event(3, 3, "Screening", "Interview", 10),
    event(4, 3, "Interview", "Offer", 5),
  ]);

  const vikram = createCandidate("Vikram Singh", [
    event(1, 4, null, "Applied", 10),
    event(2, 4, "Applied", "Screening", 7),
    event(3, 4, "Screening", "Interview", 3),
    event(4, 4, "Interview", "Rejected", 2),
  ]);

  const neha = createCandidate("Neha Patel", [
    event(1, 5, null, "Applied", 30),
    event(2, 5, "Applied", "Screening", 25),
    event(3, 5, "Screening", "Interview", 18),
    event(4, 5, "Interview", "Offer", 12),
    event(5, 5, "Offer", "Hired", 5),
  ]);

  const candidates = [priya, rajesh, anjali, vikram, neha];

  it("evaluates text search", () => {
    const tokens = tokenize("Priya");
    const ast = parse(tokens);
    const context = { now, candidate: priya };
    const result = evaluate(ast, context);
    expect(result.match).toBe(true);
    expect(result.score).toBeGreaterThan(30);
  });

  it("evaluates stage equals", () => {
    const tokens = tokenize("in interview");
    const ast = parse(tokens);
    const context = { now, candidate: rajesh };
    const result = evaluate(ast, context);
    expect(result.match).toBe(true);

    const context2 = { now, candidate: priya };
    const result2 = evaluate(ast, context2);
    expect(result2.match).toBe(false);
  });

  it("evaluates stuck query", () => {
    const tokens = tokenize("stuck in screening more than 7 days");
    const ast = parse(tokens);
    const context = { now, candidate: priya }; // 10 days in screening
    const result = evaluate(ast, context);
    expect(result.match).toBe(true);

    const context2 = { now, candidate: rajesh }; // 3 days in interview
    const result2 = evaluate(ast, context2);
    expect(result2.match).toBe(false);
  });

  it("evaluates moved since monday", () => {
    const tokens = tokenize("moved to interview since monday");
    const ast = parse(tokens);
    const context = { now, candidate: rajesh }; // moved 3 days ago (Monday)
    const result = evaluate(ast, context);
    expect(result.match).toBe(true);
  });

  it("evaluates reached offer not hired", () => {
    const tokens = tokenize("reached offer not hired");
    const ast = parse(tokens);

    // Anjali: reached offer, currently in offer (not hired)
    const context1 = { now, candidate: anjali };
    const result1 = evaluate(ast, context1);
    expect(result1.match).toBe(true);

    // Arjun: reached offer, then rejected (not hired)
    const arjun = createCandidate("Arjun Desai", [
      event(1, 6, null, "Applied", 25),
      event(2, 6, "Applied", "Screening", 18),
      event(3, 6, "Screening", "Interview", 10),
      event(4, 6, "Interview", "Offer", 5),
      event(5, 6, "Offer", "Rejected", 2),
    ]);
    const context2 = { now, candidate: arjun };
    const result2 = evaluate(ast, context2);
    expect(result2.match).toBe(true);

    // Neha: reached offer, but hired
    const context3 = { now, candidate: neha };
    const result3 = evaluate(ast, context3);
    expect(result3.match).toBe(false);
  });

  it("evaluates not rejected", () => {
    const tokens = tokenize("not rejected");
    const ast = parse(tokens);

    const context1 = { now, candidate: priya };
    const result1 = evaluate(ast, context1);
    expect(result1.match).toBe(true);

    const context2 = { now, candidate: vikram };
    const result2 = evaluate(ast, context2);
    expect(result2.match).toBe(false);
  });

  it("evaluates combined query", () => {
    const tokens = tokenize("in interview not rejected");
    const ast = parse(tokens);

    const context1 = { now, candidate: rajesh }; // in interview, not rejected
    const result1 = evaluate(ast, context1);
    expect(result1.match).toBe(true);

    const context2 = { now, candidate: vikram }; // was in interview, but rejected
    const result2 = evaluate(ast, context2);
    expect(result2.match).toBe(false);
  });
});

describe("Ranker", () => {
  const now = new Date("2026-09-28T12:00:00Z");

it("ranks text matches by score", () => {
    const c1 = createCandidate("Priya Sharma", [event(1, 1, null, "Applied", 1)]);
    const c2 = createCandidate("Priya Shrama", [event(1, 2, null, "Applied", 1)]);
    const c3 = createCandidate("John Doe", [event(1, 3, null, "Applied", 1)]);

    const tokens = tokenize("Priya Sharma");
    const ast = parse(tokens);
    const ranked = rankResults([c1, c2, c3], ast, { now, candidate: c1 });

    // Only candidates with match score > 30 are returned
    expect(ranked.length).toBe(2);
    expect(ranked[0].candidate.name).toBe("Priya Sharma");
    expect(ranked[1].candidate.name).toBe("Priya Shrama");
  });

  it("ranks stuck by longest time in stage", () => {
    const c1 = createCandidate("A", [event(1, 1, null, "Applied", 10), event(2, 1, "Applied", "Screening", 10)]); // 10 days
    const c2 = createCandidate("B", [event(1, 2, null, "Applied", 5), event(2, 2, "Applied", "Screening", 5)]); // 5 days
    const c3 = createCandidate("C", [event(1, 3, null, "Applied", 15), event(2, 3, "Applied", "Screening", 15)]); // 15 days

    const tokens = tokenize("stuck in screening more than 3 days");
    const ast = parse(tokens);
    const ranked = rankResults([c1, c2, c3], ast, { now, candidate: c1 });

    expect(ranked[0].candidate.name).toBe("C");
    expect(ranked[1].candidate.name).toBe("A");
    expect(ranked[2].candidate.name).toBe("B");
  });
});

describe("Search Integration", () => {
  const now = new Date("2026-09-28T12:00:00Z");

  const priya = createCandidate("Priya Sharma", [
    event(1, 1, null, "Applied", 28),
    event(2, 1, "Applied", "Screening", 10),
  ]);

  const rajesh = createCandidate("Rajesh Kumar", [
    event(1, 2, null, "Applied", 14),
    event(2, 2, "Applied", "Screening", 10),
    event(3, 2, "Screening", "Interview", 3),
  ]);

  const anjali = createCandidate("Anjali Mehta", [
    event(1, 3, null, "Applied", 21),
    event(2, 3, "Applied", "Screening", 17),
    event(3, 3, "Screening", "Interview", 10),
    event(4, 3, "Interview", "Offer", 5),
  ]);

  const vikram = createCandidate("Vikram Singh", [
    event(1, 4, null, "Applied", 10),
    event(2, 4, "Applied", "Screening", 7),
    event(3, 4, "Screening", "Interview", 3),
    event(4, 4, "Interview", "Rejected", 2),
  ]);

  const neha = createCandidate("Neha Patel", [
    event(1, 5, null, "Applied", 30),
    event(2, 5, "Applied", "Screening", 25),
    event(3, 5, "Screening", "Interview", 18),
    event(4, 5, "Interview", "Offer", 12),
    event(5, 5, "Offer", "Hired", 5),
  ]);

  const candidates = [priya, rajesh, anjali, vikram, neha];

  it("searches: Priya Sharma", () => {
    const result = search(candidates, "Priya Sharma", now);
    expect(result.error).toBeUndefined();
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].candidate.name).toBe("Priya Sharma");
  });

  it("searches: sharam (fuzzy)", () => {
    const result = search(candidates, "sharam", now);
    expect(result.error).toBeUndefined();
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].candidate.name).toBe("Priya Sharma");
  });

  it("searches: in interview", () => {
    const result = search(candidates, "in interview", now);
    expect(result.error).toBeUndefined();
    expect(result.results.length).toBe(1);
    expect(result.results[0].candidate.name).toBe("Rajesh Kumar");
  });

  it("searches: stuck in screening more than a week", () => {
    const result = search(candidates, "stuck in screening more than a week", now);
    expect(result.error).toBeUndefined();
    expect(result.results.length).toBe(1);
    expect(result.results[0].candidate.name).toBe("Priya Sharma");
  });

  it("searches: moved to interview since monday", () => {
    const result = search(candidates, "moved to interview since monday", now);
    expect(result.error).toBeUndefined();
    // Both Rajesh and Vikram moved to interview 3 days ago (since last Monday)
    expect(result.results.length).toBe(2);
    const names = result.results.map(r => r.candidate.name);
    expect(names).toContain("Rajesh Kumar");
    expect(names).toContain("Vikram Singh");
  });

  it("searches: reached offer not hired", () => {
    const result = search(candidates, "reached offer not hired", now);
    expect(result.error).toBeUndefined();
    expect(result.results.length).toBe(1);
    expect(result.results[0].candidate.name).toBe("Anjali Mehta");
  });

  it("searches: except rejected", () => {
    const result = search(candidates, "except rejected", now);
    expect(result.error).toBeUndefined();
    expect(result.results.length).toBe(4); // all except vikram
    const names = result.results.map(r => r.candidate.name);
    expect(names).not.toContain("Vikram Singh");
  });

  it("searches: combined query", () => {
    const result = search(candidates, "in interview not rejected", now);
    expect(result.error).toBeUndefined();
    expect(result.results.length).toBe(1);
    expect(result.results[0].candidate.name).toBe("Rajesh Kumar");
  });

  it("returns error for invalid query", () => {
    const result = search(candidates, "stage:interveiw", now);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("isn't a stage");
  });

  it("returns error for contradictory query", () => {
    const result = search(candidates, "stage:hired reached offer not hired", now);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("can't both be true");
  });

  it("returns error for stuck in terminal stage", () => {
    const result = search(candidates, "stuck in hired", now);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("final stage");
  });
});