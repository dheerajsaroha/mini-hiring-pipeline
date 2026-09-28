export type TokenType =
  | "TEXT"
  | "STAGE"
  | "OPERATOR_NOT"
  | "OPERATOR_AND"
  | "OPERATOR_OR"
  | "TIME_SINCE"
  | "TIME_STUCK"
  | "TIME_MOVED"
  | "REACHED"
  | "EXCEPT"
  | "LPAREN"
  | "RPAREN"
  | "COLON"
  | "EOF";

export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const lower = input.toLowerCase();

  while (i < input.length) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Parentheses
    if (ch === "(") {
      tokens.push({ type: "LPAREN", value: "(", start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "RPAREN", value: ")", start: i, end: i + 1 });
      i++;
      continue;
    }

    // Colon
    if (ch === ":") {
      tokens.push({ type: "COLON", value: ":", start: i, end: i + 1 });
      i++;
      continue;
    }

    // Hyphen for NOT
    if (ch === "-" && (i === 0 || /\s/.test(input[i - 1]))) {
      // Check if followed by stage:
      const remaining = input.slice(i + 1);
      if (/^stage:/i.test(remaining)) {
        tokens.push({ type: "OPERATOR_NOT", value: "-", start: i, end: i + 1 });
        i++;
        continue;
      }
    }

    // Keywords and identifiers
    const match = input.slice(i).match(/^([a-zA-Z][a-zA-Z0-9_]*)/);
    if (match) {
      const word = match[1];
      const lowerWord = word.toLowerCase();
      let type: TokenType = "TEXT";

      if (["and", "or"].includes(lowerWord)) {
        type = lowerWord === "and" ? "OPERATOR_AND" : "OPERATOR_OR";
      } else if (["not", "except", "excluding"].includes(lowerWord)) {
        type = "OPERATOR_NOT";
      } else if (["stage", "in", "stuck", "moved", "reached", "since", "rejected", "hired", "applied", "screening", "interview", "offer", "today", "yesterday", "tomorrow"].includes(lowerWord)) {
        type = lowerWord === "stage" ? "STAGE" :
               lowerWord === "in" ? "STAGE" :
               lowerWord === "stuck" ? "TIME_STUCK" :
               lowerWord === "moved" ? "TIME_MOVED" :
               lowerWord === "reached" ? "REACHED" :
               lowerWord === "since" ? "TIME_SINCE" :
               "STAGE";
      }

      tokens.push({ type, value: word, start: i, end: i + word.length });
      i += word.length;
      continue;
    }

    // Quoted strings
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < input.length && input[j] !== quote) j++;
      const value = input.slice(i + 1, j);
      tokens.push({ type: "TEXT", value, start: i, end: j + 1 });
      i = j + 1;
      continue;
    }

    // Numbers (for days ago)
    const numMatch = input.slice(i).match(/^(\d+)/);
    if (numMatch) {
      tokens.push({ type: "TEXT", value: numMatch[1], start: i, end: i + numMatch[1].length });
      i += numMatch[1].length;
      continue;
    }

    // Unknown character
    i++;
  }

  tokens.push({ type: "EOF", value: "", start: input.length, end: input.length });
  return tokens;
}