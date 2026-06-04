/**
 * TimeMachine Contour - Calculator Module
 *
 * Safe math expression evaluator. No eval(), no Function().
 * Supports: +, -, *, /, ^, %, parentheses, decimals, negative numbers.
 */

type Token =
  | { type: 'number'; value: number }
  | { type: 'operator'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    if (ch === ' ') {
      i++;
      continue;
    }

    // Number (including decimals)
    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i];
        i++;
      }
      const parsed = parseFloat(num);
      if (isNaN(parsed)) return [];
      tokens.push({ type: 'number', value: parsed });
      continue;
    }

    // Negative number (unary minus): at start, after operator, or after lparen
    if (ch === '-') {
      const prev = tokens[tokens.length - 1];
      if (!prev || prev.type === 'operator' || prev.type === 'lparen') {
        let num = '-';
        i++;
        while (i < expr.length && /[0-9.]/.test(expr[i])) {
          num += expr[i];
          i++;
        }
        if (num === '-') return []; // lone minus
        const parsed = parseFloat(num);
        if (isNaN(parsed)) return [];
        tokens.push({ type: 'number', value: parsed });
        continue;
      }
    }

    if ('+-*/%^'.includes(ch)) {
      tokens.push({ type: 'operator', value: ch });
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i++;
      continue;
    }

    // Unknown character - not a valid math expression
    return [];
  }

  return tokens;
}

// Recursive descent parser: expr -> term ((+|-) term)*
// term -> factor ((*|/|%) factor)*
// factor -> base (^ factor)?   (right-associative)
// base -> NUMBER | '(' expr ')' | unary

function parseExpr(tokens: Token[], pos: { i: number }): number | null {
  let left = parseTerm(tokens, pos);
  if (left === null) return null;

  while (pos.i < tokens.length) {
    const tok = tokens[pos.i];
    if (tok.type === 'operator' && (tok.value === '+' || tok.value === '-')) {
      pos.i++;
      const right = parseTerm(tokens, pos);
      if (right === null) return null;
      left = tok.value === '+' ? left + right : left - right;
    } else {
      break;
    }
  }

  return left;
}

function parseTerm(tokens: Token[], pos: { i: number }): number | null {
  let left = parseFactor(tokens, pos);
  if (left === null) return null;

  while (pos.i < tokens.length) {
    const tok = tokens[pos.i];
    if (tok.type === 'operator' && (tok.value === '*' || tok.value === '/' || tok.value === '%')) {
      pos.i++;
      const right = parseFactor(tokens, pos);
      if (right === null) return null;
      if (tok.value === '*') left = left * right;
      else if (tok.value === '/') {
        if (right === 0) return null; // division by zero
        left = left / right;
      }
      else left = left % right;
    } else {
      break;
    }
  }

  return left;
}

function parseFactor(tokens: Token[], pos: { i: number }): number | null {
  const base = parseBase(tokens, pos);
  if (base === null) return null;

  if (pos.i < tokens.length) {
    const tok = tokens[pos.i];
    if (tok.type === 'operator' && tok.value === '^') {
      pos.i++;
      const exp = parseFactor(tokens, pos); // right-associative
      if (exp === null) return null;
      return Math.pow(base, exp);
    }
  }

  return base;
}

function parseBase(tokens: Token[], pos: { i: number }): number | null {
  if (pos.i >= tokens.length) return null;

  const tok = tokens[pos.i];

  if (tok.type === 'number') {
    pos.i++;
    return tok.value;
  }

  if (tok.type === 'lparen') {
    pos.i++;
    const val = parseExpr(tokens, pos);
    if (val === null) return null;
    if (pos.i >= tokens.length || tokens[pos.i].type !== 'rparen') return null;
    pos.i++;
    return val;
  }

  return null;
}

export interface CalculatorResult {
  expression: string;
  result: number;
  displayResult: string;
  isPartial: boolean; // true if expression ends with operator (e.g. "5+")
}

/**
 * Format a number for display - avoid floating point ugliness
 */
function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString();
  // Round to 10 decimal places to avoid floating point artifacts
  const rounded = parseFloat(n.toFixed(10));
  // If the rounded version is an integer, display as integer
  if (Number.isInteger(rounded)) return rounded.toLocaleString();
  // Otherwise show up to 6 decimal places, trimming trailing zeros
  return parseFloat(rounded.toFixed(6)).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
}

/**
 * Format expression for display (prettify operators)
 */
function formatExpression(expr: string): string {
  return expr
    .replace(/\*/g, ' × ')
    .replace(/\//g, ' ÷ ')
    .replace(/\+/g, ' + ')
    .replace(/(?<!\s)-(?!\s)/g, ' − ') // minus not already spaced
    .replace(/-/g, ' − ')
    .replace(/\^/g, ' ^ ')
    .replace(/%/g, ' mod ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if a string looks like it could be a math expression.
 * Returns true if the string contains at least one operator.
 */
export function isMathExpression(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  // Must contain at least one operator (not just a plain number)
  // But also start with a digit, negative sign, or parenthesis
  if (!/^[\d\s\-.(]/.test(trimmed)) return false;
  // Must contain at least one binary operator
  return /[\d)]\s*[+\-*/%^]\s*[\d(]/.test(trimmed) || /[\d)]\s*[+\-*/%^]\s*$/.test(trimmed);
}

/**
 * Evaluate a math expression string.
 * Returns null if it's not a valid math expression.
 */
export function evaluateMath(input: string): CalculatorResult | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!isMathExpression(trimmed)) return null;

  // Check if expression ends with an operator (partial)
  const endsWithOperator = /[+\-*/%^]\s*$/.test(trimmed);

  if (endsWithOperator) {
    // Try to evaluate what we have so far (everything before trailing operator)
    const partial = trimmed.replace(/[+\-*/%^]\s*$/, '').trim();
    if (!partial) return null;

    const tokens = tokenize(partial);
    if (tokens.length === 0) return null;

    const pos = { i: 0 };
    const result = parseExpr(tokens, pos);
    if (result === null || pos.i !== tokens.length) return null;

    const trailingOp = trimmed.match(/([+\-*/%^])\s*$/)?.[1] || '';

    return {
      expression: trimmed,
      result,
      displayResult: `${formatExpression(partial)} ${formatExpression(trailingOp)} ...`,
      isPartial: true,
    };
  }

  // Full evaluation
  const tokens = tokenize(trimmed);
  if (tokens.length === 0) return null;

  const pos = { i: 0 };
  const result = parseExpr(tokens, pos);
  if (result === null || pos.i !== tokens.length) return null;

  return {
    expression: trimmed,
    result,
    displayResult: `${formatExpression(trimmed)} = ${formatNumber(result)}`,
    isPartial: false,
  };
}
