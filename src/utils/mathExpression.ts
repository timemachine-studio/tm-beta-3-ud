/**
 * Compile a one-variable maths expression into a function of x — without
 * `new Function`.
 *
 * The Graph block in Notes and the Contour graph view used to rewrite the
 * user's text into JavaScript (`sin` → `Math.sin`) and hand it to
 * `new Function`. The rewriter had no allowlist, so anything it did not
 * recognise — `fetch(...)`, `localStorage`, `document` — went through
 * verbatim and ran with the app's origin. Note content is written by the
 * Notes AI co-pilot and by the chat's `notes_edit` tool as well as by the
 * user, which made that a stored-XSS path from model output
 * (pre-launch-audit.md A.3). This is a real parser: it only ever produces
 * arithmetic, and an identifier it does not know is a parse error.
 *
 * Grammar (precedence low → high):
 *   expr    := term (('+' | '-') term)*
 *   term    := unary (('*' | '/' | '%' | 'mod' | implicit) unary)*
 *   unary   := ('-' | '+') unary | power
 *   power   := atom ('^' | '**') unary          (right-associative)
 *   atom    := number | 'x' | constant | fn '(' args ')' | '(' expr ')' | '|' expr '|'
 *
 * Implicit multiplication is accepted wherever two atoms sit side by side:
 * `3x`, `2(x+1)`, `(x+1)(x-1)`, `x sin(x)`, `2pi`.
 */

export type MathFn = (x: number) => number | null;

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sqrt: Math.sqrt, cbrt: Math.cbrt,
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  abs: Math.abs, sign: Math.sign, hypot: Math.hypot,
  ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2, exp: Math.exp,
  ceil: Math.ceil, floor: Math.floor, round: Math.round, trunc: Math.trunc,
  pow: Math.pow, max: Math.max, min: Math.min,
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI, 'π': Math.PI, e: Math.E, inf: Infinity, infinity: Infinity, '∞': Infinity,
};

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'id'; name: string }
  | { kind: 'op'; value: string }
  | { kind: 'lparen' } | { kind: 'rparen' } | { kind: 'bar' } | { kind: 'comma' };

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j])) j++;
      const value = Number(input.slice(i, j));
      if (!Number.isFinite(value)) return null;
      tokens.push({ kind: 'num', value });
      i = j;
      continue;
    }
    if (/[a-zA-Z_πθ∞]/.test(ch)) {
      let j = i;
      while (j < input.length && /[a-zA-Z0-9_πθ∞]/.test(input[j])) j++;
      tokens.push({ kind: 'id', name: input.slice(i, j).toLowerCase() });
      i = j;
      continue;
    }
    if (ch === '*' && input[i + 1] === '*') { tokens.push({ kind: 'op', value: '^' }); i += 2; continue; }
    if ('+-*/%^'.includes(ch)) { tokens.push({ kind: 'op', value: ch }); i++; continue; }
    if (ch === '(') { tokens.push({ kind: 'lparen' }); i++; continue; }
    if (ch === ')') { tokens.push({ kind: 'rparen' }); i++; continue; }
    if (ch === '|') { tokens.push({ kind: 'bar' }); i++; continue; }
    if (ch === ',') { tokens.push({ kind: 'comma' }); i++; continue; }
    return null; // anything else is not maths
  }
  return tokens;
}

/** Strip a `y =` / `f(x) =` prefix; everything after it is the expression. */
function stripLhs(input: string): string {
  return input.trim()
    .replace(/^\s*[yfg]\s*\(\s*x\s*\)\s*=\s*/i, '')
    .replace(/^\s*y\s*=\s*/i, '');
}

class Parser {
  private pos = 0;
  /** Inside `|…|`, a bar closes rather than opening a nested abs. */
  private barDepth = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): MathFn | null {
    if (this.tokens.length === 0) return null;
    const fn = this.expr();
    if (!fn || this.pos !== this.tokens.length) return null;
    return fn;
  }

  private peek(): Token | undefined { return this.tokens[this.pos]; }
  private next(): Token | undefined { return this.tokens[this.pos++]; }

  private expr(): MathFn | null {
    let left: MathFn | null = this.term();
    if (!left) return null;
    for (;;) {
      const t = this.peek();
      if (t?.kind !== 'op' || (t.value !== '+' && t.value !== '-')) return left;
      this.next();
      const right = this.term();
      if (!right) return null;
      const l: MathFn = left;
      left = t.value === '+'
        ? (x) => { const a = l(x), b = right(x); return a === null || b === null ? null : a + b; }
        : (x) => { const a = l(x), b = right(x); return a === null || b === null ? null : a - b; };
    }
  }

  private startsAtom(t: Token | undefined): boolean {
    if (!t) return false;
    if (t.kind === 'num' || t.kind === 'id' || t.kind === 'lparen') return true;
    return t.kind === 'bar' && this.barDepth === 0;
  }

  private term(): MathFn | null {
    let left: MathFn | null = this.unary();
    if (!left) return null;
    for (;;) {
      const t = this.peek();
      let op: '*' | '/' | '%';
      if (t?.kind === 'op' && (t.value === '*' || t.value === '/' || t.value === '%')) { op = t.value; this.next(); }
      else if (t?.kind === 'id' && t.name === 'mod') { op = '%'; this.next(); }
      else if (this.startsAtom(t)) { op = '*'; } // implicit multiplication
      else return left;
      const right = this.unary();
      if (!right) return null;
      const l: MathFn = left;
      left = op === '*'
        ? (x) => { const a = l(x), b = right(x); return a === null || b === null ? null : a * b; }
        : op === '/'
          ? (x) => { const a = l(x), b = right(x); return a === null || b === null ? null : a / b; }
          : (x) => { const a = l(x), b = right(x); return a === null || b === null ? null : a % b; };
    }
  }

  private unary(): MathFn | null {
    const t = this.peek();
    if (t?.kind === 'op' && (t.value === '-' || t.value === '+')) {
      this.next();
      const inner = this.unary();
      if (!inner) return null;
      return t.value === '-' ? (x) => { const v = inner(x); return v === null ? null : -v; } : inner;
    }
    return this.power();
  }

  private power(): MathFn | null {
    const base = this.atom();
    if (!base) return null;
    const t = this.peek();
    if (t?.kind === 'op' && t.value === '^') {
      this.next();
      const exponent = this.unary(); // right-assoc, and allows 2^-x
      if (!exponent) return null;
      return (x) => { const a = base(x), b = exponent(x); return a === null || b === null ? null : Math.pow(a, b); };
    }
    return base;
  }

  private atom(): MathFn | null {
    const t = this.next();
    if (!t) return null;
    if (t.kind === 'num') { const v = t.value; return () => v; }
    if (t.kind === 'lparen') {
      const inner = this.expr();
      if (!inner || this.next()?.kind !== 'rparen') return null;
      return inner;
    }
    if (t.kind === 'bar') {
      if (this.barDepth > 0) return null;
      this.barDepth++;
      const inner = this.expr();
      this.barDepth--;
      if (!inner || this.next()?.kind !== 'bar') return null;
      return (x) => { const v = inner(x); return v === null ? null : Math.abs(v); };
    }
    if (t.kind === 'id') {
      if (t.name === 'x') return (x) => x;
      if (Object.prototype.hasOwnProperty.call(CONSTANTS, t.name)) { const v = CONSTANTS[t.name]; return () => v; }
      // hasOwn, not `in`: `constructor` is on every object's prototype.
      const fn = Object.prototype.hasOwnProperty.call(FUNCTIONS, t.name) ? FUNCTIONS[t.name] : undefined;
      if (!fn) return null; // unknown identifier: not maths, refuse
      if (this.next()?.kind !== 'lparen') return null;
      const args: MathFn[] = [];
      if (this.peek()?.kind !== 'rparen') {
        for (;;) {
          const arg = this.expr();
          if (!arg) return null;
          args.push(arg);
          const sep = this.peek();
          if (sep?.kind === 'comma') { this.next(); continue; }
          break;
        }
      }
      if (this.next()?.kind !== 'rparen') return null;
      if (args.length === 0) return null;
      return (x) => {
        const values: number[] = [];
        for (const arg of args) { const v = arg(x); if (v === null) return null; values.push(v); }
        return fn(...values);
      };
    }
    return null;
  }
}

/**
 * Compile `input` to a function of x, or null when it is not a well-formed
 * expression in the grammar above. The returned function yields `null` where
 * the value is not a finite number (division by zero, log of a negative…), so
 * graphing code can leave a gap instead of drawing a line to infinity.
 */
export function compileMathExpression(input: string): MathFn | null {
  const source = stripLhs(input);
  if (!source) return null;
  const tokens = tokenize(source);
  if (!tokens) return null;
  const fn = new Parser(tokens).parse();
  if (!fn) return null;
  return (x) => {
    try {
      const v = fn(x);
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    } catch {
      return null;
    }
  };
}
