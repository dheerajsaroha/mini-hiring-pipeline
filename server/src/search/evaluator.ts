import { ASTNode, ASTNodeType } from "./parser.js";
import { CandidateWithHistory, StageEvent, Stage } from "shared";

export interface EvaluationContext {
  now: Date;
  candidate: CandidateWithHistory;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function tokenizeName(name: string): string[] {
  return normalizeName(name).split(/\s+/).filter((t) => t.length > 0);
}

function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const lenA = a.length;
  const lenB = b.length;
  const matrix: number[][] = Array(lenA + 1)
    .fill(null)
    .map(() => Array(lenB + 1).fill(0));

  for (let i = 0; i <= lenA; i++) matrix[i][0] = i;
  for (let j = 0; j <= lenB; j++) matrix[0][j] = j;

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
      }
    }
  }
  return matrix[lenA][lenB];
}

function fuzzyMatchScore(queryToken: string, nameToken: string): number {
  const q = normalizeName(queryToken);
  const n = normalizeName(nameToken);

  if (q === n) return 100;
  if (n.startsWith(q)) return 80;
  if (q.startsWith(n)) return 70;

  const dist = damerauLevenshtein(q, n);
  const maxLen = Math.max(q.length, n.length);
  if (maxLen <= 5 && dist <= 1) return 60;
  if (maxLen > 5 && dist <= 2) return 50;
  if (maxLen > 8 && dist <= 3) return 40;

  return 0;
}

export function calculateTextMatchScore(query: string, candidateName: string): number {
  const queryTokens = tokenizeName(query);
  const nameTokens = tokenizeName(candidateName);

  if (queryTokens.length === 0) return 0;

  let totalScore = 0;
  for (const qToken of queryTokens) {
    let bestMatch = 0;
    for (const nToken of nameTokens) {
      const score = fuzzyMatchScore(qToken, nToken);
      if (score > bestMatch) bestMatch = score;
    }
    totalScore += bestMatch;
  }

  // Average score per query token
  return totalScore / queryTokens.length;
}

function getCurrentStage(candidate: CandidateWithHistory): Stage {
  return candidate.currentStage;
}

function getTimeInStageDays(candidate: CandidateWithHistory, now: Date): number {
  return candidate.timeInStageDays;
}

function hasEventToStage(candidate: CandidateWithHistory, stage: string, since?: Date): boolean {
  for (const event of candidate.history) {
    if (event.toStage === stage) {
      if (since) {
        const eventDate = new Date(event.occurredAt);
        if (eventDate >= since) return true;
      } else {
        return true;
      }
    }
  }
  return false;
}

function everReachedStage(candidate: CandidateWithHistory, stage: string): boolean {
  for (const event of candidate.history) {
    if (event.toStage === stage) return true;
  }
  return false;
}

export function evaluate(ast: ASTNode, context: EvaluationContext): { match: boolean; score: number } {
  const { candidate, now } = context;

  function evalNode(node: ASTNode): { match: boolean; score: number } {
    switch (node.type) {
      case "TEXT_SEARCH": {
        const score = calculateTextMatchScore(node.value || "", candidate.name);
        return { match: score > 30, score };
      }

      case "STAGE_EQUALS": {
        const match = getCurrentStage(candidate) === node.stage;
        return { match, score: match ? 100 : 0 };
      }

      case "STAGE_NOT_EQUALS": {
        const match = getCurrentStage(candidate) !== node.stage;
        return { match, score: match ? 100 : 0 };
      }

      case "STUCK_IN_STAGE": {
        if (getCurrentStage(candidate) !== node.stage) {
          return { match: false, score: 0 };
        }
        const days = getTimeInStageDays(candidate, now);
        const match = days > (node.days || 7);
        return { match, score: match ? Math.min(days * 10, 1000) : 0 };
      }

      case "MOVED_TO_STAGE_SINCE": {
        const match = hasEventToStage(candidate, node.stage!, node.date);
        return { match, score: match ? 100 : 0 };
      }

      case "REACHED_STAGE_NOT_HIRED": {
        const reached = everReachedStage(candidate, node.stage!);
        const notHired = getCurrentStage(candidate) !== "Hired";
        const match = reached && notHired;
        return { match, score: match ? 100 : 0 };
      }

      case "TIME_SINCE": {
        // This is a filter that applies to the whole query - handled at top level
        return { match: true, score: 0 };
      }

      case "NOT": {
        const result = node.left ? evalNode(node.left) : { match: true, score: 0 };
        return { match: !result.match, score: result.match ? 0 : 100 };
      }

      case "AND": {
        const left = node.left ? evalNode(node.left) : { match: true, score: 0 };
        const right = node.right ? evalNode(node.right) : { match: true, score: 0 };
        return {
          match: left.match && right.match,
          score: left.score + right.score,
        };
      }

      case "OR": {
        const left = node.left ? evalNode(node.left) : { match: false, score: 0 };
        const right = node.right ? evalNode(node.right) : { match: false, score: 0 };
        return {
          match: left.match || right.match,
          score: Math.max(left.score, right.score),
        };
      }

      default:
        return { match: false, score: 0 };
    }
  }

  return evalNode(ast);
}

export function buildInterpretation(ast: ASTNode): string {
  const parts: string[] = [];

  function collect(node: ASTNode): void {
    if (!node) return;
    switch (node.type) {
      case "TEXT_SEARCH":
        if (node.value) parts.push(`Name matches "${node.value}"`);
        break;
      case "STAGE_EQUALS":
        if (node.stage) parts.push(`Stage = ${node.stage}`);
        break;
      case "STAGE_NOT_EQUALS":
        if (node.stage) parts.push(`Stage ≠ ${node.stage}`);
        break;
      case "STUCK_IN_STAGE":
        if (node.stage) parts.push(`Stuck in ${node.stage} > ${node.days || 7} days`);
        break;
      case "MOVED_TO_STAGE_SINCE":
        if (node.stage) {
          let part = `Moved to ${node.stage}`;
          if (node.date) part += ` since ${node.date.toLocaleDateString()}`;
          parts.push(part);
        }
        break;
      case "REACHED_STAGE_NOT_HIRED":
        if (node.stage) {
          parts.push(`Reached ${node.stage}${node.value === "true" ? " but not Hired" : ""}`);
        }
        break;
    }
    if (node.left) collect(node.left);
    if (node.right) collect(node.right);
  }

  collect(ast);
  return parts.join(" AND ") || "All candidates";
}