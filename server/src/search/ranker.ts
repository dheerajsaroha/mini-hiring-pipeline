import { CandidateWithHistory } from "shared";
import { ASTNode } from "./parser.js";
import { EvaluationContext, evaluate, buildInterpretation } from "./evaluator.js";
import { tokenize } from "./tokenizer.js";
import { parse } from "./parser.js";
import { validate } from "./validator.js";

export interface RankedResult {
  candidate: CandidateWithHistory;
  score: number;
  match: boolean;
}

export function rankResults(
  candidates: CandidateWithHistory[],
  ast: ASTNode,
  context: EvaluationContext
): RankedResult[] {
  const results: RankedResult[] = [];

  for (const candidate of candidates) {
    const candidateContext: EvaluationContext = { ...context, candidate };
    const { match, score } = evaluate(ast, candidateContext);
    if (match) {
      results.push({ candidate, score, match });
    }
  }

  // Sort by score descending, then by tiebreakers
  results.sort((a, b) => {
    // Primary: score
    if (b.score !== a.score) return b.score - a.score;

    // Tiebreaker: check if text search was involved
    const hasTextSearch = hasTextSearchNode(ast);
    if (hasTextSearch) {
      // For text search, already sorted by score
      return 0;
    }

    // For stuck queries: longest time in stage first
    const hasStuck = hasNodeType(ast, "STUCK_IN_STAGE");
    if (hasStuck) {
      return b.candidate.timeInStageDays - a.candidate.timeInStageDays;
    }

    // For moved queries: most recent move first
    const hasMoved = hasNodeType(ast, "MOVED_TO_STAGE_SINCE");
    if (hasMoved) {
      const aRecent = getMostRecentMoveToStage(a.candidate);
      const bRecent = getMostRecentMoveToStage(b.candidate);
      if (aRecent && bRecent) {
        return new Date(bRecent.occurredAt).getTime() - new Date(aRecent.occurredAt).getTime();
      }
    }

    // Default: most recently updated
    const aUpdated = getLastEventTime(a.candidate);
    const bUpdated = getLastEventTime(b.candidate);
    return bUpdated - aUpdated;
  });

  return results;
}

function hasTextSearchNode(node: ASTNode): boolean {
  if (!node) return false;
  if (node.type === "TEXT_SEARCH") return true;
  return hasTextSearchNode(node.left!) || hasTextSearchNode(node.right!);
}

function hasNodeType(node: ASTNode, type: string): boolean {
  if (!node) return false;
  if (node.type === type) return true;
  return hasNodeType(node.left!, type) || hasNodeType(node.right!, type);
}

function getMostRecentMoveToStage(candidate: CandidateWithHistory): { occurredAt: string } | null {
  const moves = candidate.history.filter((e) => e.fromStage !== null);
  if (moves.length === 0) return null;
  return moves[moves.length - 1];
}

function getLastEventTime(candidate: CandidateWithHistory): number {
  if (candidate.history.length === 0) return 0;
  return new Date(candidate.history[candidate.history.length - 1].occurredAt).getTime();
}

export interface SearchResult {
  interpretation: string;
  results: RankedResult[];
  error?: string;
}

export function search(
  candidates: CandidateWithHistory[],
  query: string,
  now: Date = new Date()
): SearchResult {
  try {
    const tokens = tokenize(query);
    const ast = parse(tokens);
    const validation = validate(ast, now);

    if (!validation.valid) {
      return {
        interpretation: "",
        results: [],
        error: validation.errors.join("; "),
      };
    }

    const context: EvaluationContext = { now, candidate: candidates[0] }; // candidate will be overridden
    const ranked = rankResults(candidates, ast, context);
    const interpretation = buildInterpretation(ast);

    return {
      interpretation,
      results: ranked,
      error: validation.warnings.length > 0 ? validation.warnings.join("; ") : undefined,
    };
  } catch (error) {
    return {
      interpretation: "",
      results: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}