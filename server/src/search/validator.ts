import { ASTNode, ASTNodeType } from "./parser.js";
import { Stage, isTerminalStage, STAGES } from "shared";

const VALID_STAGES: string[] = ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validate(ast: ASTNode, now: Date = new Date()): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  function checkNode(node: ASTNode): void {
    switch (node.type) {
      case "STAGE_EQUALS":
      case "STAGE_NOT_EQUALS":
        if (!node.stage) {
          errors.push("Stage is required");
        } else if (!VALID_STAGES.includes(node.stage)) {
          const suggestion = findSimilarStage(node.stage);
          errors.push(`"${node.stage}" isn't a stage.${suggestion ? ` Did you mean ${suggestion}?` : ""}`);
        }
        break;

      case "STUCK_IN_STAGE":
        if (!node.stage) {
          errors.push("Stage is required for 'stuck' query");
        } else if (!VALID_STAGES.includes(node.stage)) {
          const suggestion = findSimilarStage(node.stage);
          errors.push(`"${node.stage}" isn't a stage.${suggestion ? ` Did you mean ${suggestion}?` : ""}`);
        } else if (isTerminalStage(node.stage as Stage)) {
          errors.push(`"Stuck" doesn't apply to ${node.stage}, which is a final stage.`);
        }
        if (node.days !== undefined && node.days < 0) {
          errors.push("Days must be positive");
        }
        break;

      case "MOVED_TO_STAGE_SINCE":
        if (!node.stage) {
          errors.push("Stage is required for 'moved' query");
        } else if (!VALID_STAGES.includes(node.stage)) {
          const suggestion = findSimilarStage(node.stage);
          errors.push(`"${node.stage}" isn't a stage.${suggestion ? ` Did you mean ${suggestion}?` : ""}`);
        }
        if (node.date && node.date > now) {
          errors.push("'since' date cannot be in the future");
        }
        break;

      case "REACHED_STAGE_NOT_HIRED":
        if (!node.stage) {
          errors.push("Stage is required for 'reached' query");
        } else if (!VALID_STAGES.includes(node.stage)) {
          const suggestion = findSimilarStage(node.stage);
          errors.push(`"${node.stage}" isn't a stage.${suggestion ? ` Did you mean ${suggestion}?` : ""}`);
        } else if (node.stage === "Hired") {
          warnings.push("'Reached Hired not hired' is contradictory");
        }
        break;

      case "TIME_SINCE":
        if (node.date && node.date > now) {
          errors.push("'since' date cannot be in the future");
        }
        break;

      case "TEXT_SEARCH":
        if (!node.value || node.value.trim() === "") {
          errors.push("Search text cannot be empty");
        }
        break;

      case "NOT":
        if (node.left) checkNode(node.left);
        break;

      case "AND":
      case "OR":
        if (node.left) checkNode(node.left);
        if (node.right) checkNode(node.right);
        break;
    }
  }

  checkNode(ast);

  // Check for contradictions
  checkContradictions(ast, errors);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function findSimilarStage(stage: string): string | null {
  const lower = stage.toLowerCase();
  for (const valid of VALID_STAGES) {
    if (valid.toLowerCase() === lower) return valid;
    // Simple fuzzy match: check if one is substring of other or very similar
    if (valid.toLowerCase().includes(lower) || lower.includes(valid.toLowerCase())) {
      return valid;
    }
    // Check edit distance for short strings
    if (levenshteinDistance(valid.toLowerCase(), lower) <= 2) {
      return valid;
    }
  }
  return null;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = Array(a.length + 1)
    .fill(null)
    .map(() => Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function checkContradictions(node: ASTNode, errors: string[]): void {
  const stageEquals: string[] = [];
  const stageNotEquals: string[] = [];
  const notHiredReached: string[] = [];

  function collect(node: ASTNode): void {
    if (!node) return;
    switch (node.type) {
      case "STAGE_EQUALS":
        if (node.stage) stageEquals.push(node.stage);
        break;
      case "STAGE_NOT_EQUALS":
        if (node.stage) stageNotEquals.push(node.stage);
        break;
      case "REACHED_STAGE_NOT_HIRED":
        if (node.stage && node.value === "true") notHiredReached.push(node.stage);
        break;
    }
    if (node.left) collect(node.left);
    if (node.right) collect(node.right);
  }

  collect(node);

  // Check for stage contradictions
  for (const eq of stageEquals) {
    if (stageNotEquals.includes(eq)) {
      errors.push(`"stage:${eq}" and "not stage:${eq}" can't both be true.`);
    }
  }

  // Check for hired/not hired contradiction
  if (stageEquals.includes("Hired") && notHiredReached.includes("Offer")) {
    errors.push(`"stage:hired" and "reached offer not hired" can't both be true.`);
  }
}