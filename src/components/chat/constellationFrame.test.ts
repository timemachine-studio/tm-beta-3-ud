import { describe, expect, it } from 'vitest';
import { constellationFrame, stillConstellationFrame } from './constellationFrame';

describe('constellation frame', () => {
  it('draws connections over time and keeps earlier nodes illuminated', () => {
    const initial = constellationFrame(64, 0, {});
    const mid = constellationFrame(64, 2, {});
    const late = constellationFrame(64, 4.7, {});
    expect(initial.lines).toHaveLength(1);
    expect(mid.lines.length).toBeGreaterThan(initial.lines.length);
    expect(late.lines.length).toBeGreaterThan(mid.lines.length);
    const litCount = (t: number) => constellationFrame(64, t, {}).dots.filter(dot => dot.a === 0.95).length;
    expect(litCount(2)).toBeGreaterThan(litCount(0));
    expect(litCount(4.7)).toBeGreaterThan(litCount(2));
  });

  it('holds a useful partially connected still preview', () => {
    expect(stillConstellationFrame(64, 0, {}).lines.length).toBeGreaterThan(4);
    expect(stillConstellationFrame(64, 20, {})).toEqual(stillConstellationFrame(64, 0, {}));
  });
});
