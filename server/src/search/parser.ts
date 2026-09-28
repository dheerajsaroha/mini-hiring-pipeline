import { Token, TokenType } from "./tokenizer.js";
import { Stage } from "shared";

export type ASTNodeType =
  | "AND"
  | "OR"
  | "NOT"
  | "TEXT_SEARCH"
  | "STAGE_EQUALS"
  | "STAGE_NOT_EQUALS"
  | "STUCK_IN_STAGE"
  | "MOVED_TO_STAGE_SINCE"
  | "REACHED_STAGE_NOT_HIRED"
  | "TIME_SINCE";

export interface ASTNode {
  type: ASTNodeType;
  left?: ASTNode;
  right?: ASTNode;
  value?: string;
  stage?: string;
  days?: number;
  date?: Date;
  raw?: string;
}

export class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private consume(type?: TokenType): Token {
    const token = this.tokens[this.pos];
    if (type && token.type !== type) {
      throw new Error(`Expected ${type}, got ${token.type}`);
    }
    this.pos++;
    return token;
  }

  private atEnd(): boolean {
    return this.peek().type === "EOF";
  }

  parse(): ASTNode {
    const node = this.parseExpression();
    if (!this.atEnd()) {
      throw new Error(`Unexpected token: ${this.peek().value}`);
    }
    return node;
  }

  private parseExpression(): ASTNode {
    return this.parseOr();
  }

  private parseOr(): ASTNode {
    let left = this.parseAnd();
    while (this.peek().type === "OPERATOR_OR") {
      this.consume("OPERATOR_OR");
      const right = this.parseAnd();
      left = { type: "OR", left, right };
    }
    return left;
  }

  private parseAnd(): ASTNode {
    let left = this.parseNot();
    while (
      this.peek().type === "OPERATOR_AND" ||
      this.peek().type === "OPERATOR_NOT" ||
      (this.peek().type === "TEXT" && this.peek().value !== "not" && this.peek().value !== "except") ||
      this.peek().type === "STAGE" ||
      this.peek().type === "TIME_STUCK" ||
      this.peek().type === "TIME_MOVED" ||
      this.peek().type === "REACHED" ||
      this.peek().type === "TIME_SINCE"
    ) {
      // Implicit AND
      const right = this.parseNot();
      left = { type: "AND", left, right };
    }
    return left;
  }

  private parseNot(): ASTNode {
    if (this.peek().type === "OPERATOR_NOT") {
      this.consume("OPERATOR_NOT");
      const operand = this.parseNot();
      return { type: "NOT", left: operand };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ASTNode {
    const token = this.peek();

    // Parenthesized expression
    if (token.type === "LPAREN") {
      this.consume("LPAREN");
      const node = this.parseExpression();
      this.consume("RPAREN");
      return node;
    }

    // Stage keyword: "stage:interview", "in interview", or standalone stage name
    if (token.type === "STAGE") {
      return this.parseStageExpression();
    }

    // Time expressions
    if (token.type === "TIME_STUCK") {
      return this.parseStuckExpression();
    }
    if (token.type === "TIME_MOVED") {
      return this.parseMovedExpression();
    }
    if (token.type === "REACHED") {
      return this.parseReachedExpression();
    }
    if (token.type === "TIME_SINCE") {
      return this.parseSinceExpression();
    }

    // Text search
    if (token.type === "TEXT") {
      this.consume("TEXT");
      return { type: "TEXT_SEARCH", value: token.value, raw: token.value };
    }

    throw new Error(`Unexpected token: ${token.value}`);
  }

  private parseStageExpression(): ASTNode {
    const token = this.consume("STAGE");
    const lowerValue = token.value.toLowerCase();

    // "in interview" or "stage:interview"
    if (lowerValue === "in") {
      const next = this.consume();
      if (next.type === "TEXT" || next.type === "STAGE") {
        const stage = this.parseStageValue(next.value);
        return { type: "STAGE_EQUALS", stage, raw: `in ${next.value}` };
      }
      throw new Error(`Expected stage after "in", got ${next.value}`);
    }

    // "stage:interview"
    if (this.peek().type === "COLON") {
      this.consume("COLON");
      const stageToken = this.consume();
      const stage = this.parseStageValue(stageToken.value);
      return { type: "STAGE_EQUALS", stage, raw: `stage:${stageToken.value}` };
    }

    // "stage interview" (stage keyword followed by stage name)
    const next = this.peek();
    if (next.type === "TEXT" || next.type === "STAGE") {
      // Check if the next token is a stage name (not a keyword like "stuck", "moved", etc.)
      const nextLower = next.value.toLowerCase();
      const timeKeywords = ["stuck", "moved", "reached", "since", "more", "over", "than", "days", "weeks"];
      if (!timeKeywords.includes(nextLower)) {
        const stageToken = this.consume();
        const stage = this.parseStageValue(stageToken.value);
        return { type: "STAGE_EQUALS", stage, raw: `stage ${stageToken.value}` };
      }
    }

    // Standalone stage name (e.g., "rejected", "hired", "interview")
    const stage = this.parseStageValue(token.value);
    return { type: "STAGE_EQUALS", stage, raw: token.value };
  }

  private parseStageValue(value: string): string {
    const normalized = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    return normalized;
  }

  private parseStuckExpression(): ASTNode {
    this.consume("TIME_STUCK");
    const inToken = this.consume();
    if (inToken.value.toLowerCase() !== "in") {
      throw new Error(`Expected "in" after "stuck", got ${inToken.value}`);
    }
    const stageToken = this.consume();
    const stage = this.parseStageValue(stageToken.value);

    // Check for "more than X" or "over X"
    let days = 7; // default week
    if (this.peek().type === "TEXT") {
      const next = this.peek();
      if (["more", "over", "greater"].includes(next.value.toLowerCase())) {
        this.consume();
        const than = this.consume();
        if (than.value.toLowerCase() !== "than" && !["over", "greater"].includes(next.value.toLowerCase())) {
          // "over X" doesn't need "than"
        }
        const numToken = this.consume();
        // Handle "a week" or "a day"
        let num: number;
        if (numToken.value.toLowerCase() === "a") {
          const unitToken = this.consume();
          if (unitToken.value.toLowerCase().startsWith("week")) {
            num = 1;
            days = 7;
          } else if (unitToken.value.toLowerCase().startsWith("day")) {
            num = 1;
            days = 1;
          } else {
            num = 1;
          }
        } else {
          num = parseInt(numToken.value, 10);
          if (!isNaN(num)) {
            const unit = this.peek();
            if (unit.value.toLowerCase().startsWith("day")) {
              days = num;
              this.consume();
            } else if (unit.value.toLowerCase().startsWith("week")) {
              days = num * 7;
              this.consume();
            }
          }
        }
      }
    }

    return { type: "STUCK_IN_STAGE", stage, days, raw: `stuck in ${stage} more than ${days} days` };
  }

  private parseMovedExpression(): ASTNode {
    this.consume("TIME_MOVED");
    const toToken = this.consume();
    if (toToken.value.toLowerCase() !== "to") {
      throw new Error(`Expected "to" after "moved", got ${toToken.value}`);
    }
    const stageToken = this.consume();
    const stage = this.parseStageValue(stageToken.value);

    // Check for "since"
    let date: Date | undefined;
    if (this.peek().type === "TIME_SINCE") {
      this.consume("TIME_SINCE");
      date = this.parseRelativeDate();
    }

    return { type: "MOVED_TO_STAGE_SINCE", stage, date, raw: `moved to ${stage}${date ? ` since ${date.toISOString()}` : ""}` };
  }

  private parseReachedExpression(): ASTNode {
    this.consume("REACHED");
    const stageToken = this.consume();
    const stage = this.parseStageValue(stageToken.value);

    // Check for "not hired"
    let notHired = false;
    if (this.peek().type === "OPERATOR_NOT") {
      this.consume("OPERATOR_NOT");
      const hiredToken = this.consume();
      if (hiredToken.value.toLowerCase() === "hired") {
        notHired = true;
      }
    } else if (this.peek().type === "TEXT" && this.peek().value.toLowerCase() === "not") {
      this.consume("TEXT");
      const hiredToken = this.consume();
      if (hiredToken.value.toLowerCase() === "hired") {
        notHired = true;
      }
    }

    return { type: "REACHED_STAGE_NOT_HIRED", stage, value: notHired ? "true" : "false", raw: `reached ${stage}${notHired ? " not hired" : ""}` };
  }

  private parseSinceExpression(): ASTNode {
    this.consume("TIME_SINCE");
    const date = this.parseRelativeDate();
    return { type: "TIME_SINCE", date, raw: `since ${date.toISOString()}` };
  }

  private parseRelativeDate(): Date {
    const token = this.consume();
    const value = token.value.toLowerCase();
    const now = new Date();

    switch (value) {
      case "today":
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case "tomorrow": {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }
      case "yesterday": {
        const d = new Date(now);
        d.setDate(d.getDate() - 1);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }
      case "monday":
      case "tuesday":
      case "wednesday":
      case "thursday":
      case "friday":
      case "saturday":
      case "sunday": {
        const targetDay = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(value);
        const d = new Date(now);
        const currentDay = d.getDay();
        let diff = currentDay - targetDay;
        if (diff < 0) diff += 7;
        if (diff === 0) diff = 7; // Last week if today is the target day
        d.setDate(d.getDate() - diff);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }
      case "last": {
        const next = this.consume();
        if (next.value.toLowerCase() === "week") {
          const d = new Date(now);
          d.setDate(d.getDate() - 7);
          return new Date(d.getFullYear(), d.getMonth(), d.getDate());
        }
        throw new Error(`Unknown relative date: last ${next.value}`);
      }
      default: {
        // Try parsing as number + unit
        const num = parseInt(value, 10);
        if (!isNaN(num)) {
          const unitToken = this.peek();
          if (unitToken.type === "TEXT") {
            const unit = unitToken.value.toLowerCase();
            this.consume();
            if (unit.startsWith("day")) {
              const d = new Date(now);
              d.setDate(d.getDate() - num);
              return new Date(d.getFullYear(), d.getMonth(), d.getDate());
            }
            if (unit.startsWith("week")) {
              const d = new Date(now);
              d.setDate(d.getDate() - num * 7);
              return new Date(d.getFullYear(), d.getMonth(), d.getDate());
            }
          }
        }
        // Try ISO date
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
        throw new Error(`Could not parse date: ${token.value}`);
      }
    }
  }
}

export function parse(tokens: Token[]): ASTNode {
  const parser = new Parser(tokens);
  return parser.parse();
}