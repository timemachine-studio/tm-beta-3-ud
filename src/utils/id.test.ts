import { describe, it, expect } from 'vitest';
import { newId } from './id';

describe('newId', () => {
  it('produces a UUID', () => {
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  // The regression this replaces: ids were `Date.now()`, and AI placeholders
  // `Date.now() + 1`. Everything generated inside one millisecond collided,
  // which meant duplicate React keys and messages merging or vanishing
  // (production-check.md 1.12).
  it('does not collide across a rapid-fire burst', () => {
    const ids = Array.from({ length: 20_000 }, () => newId());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not collide when many ids are generated in the same millisecond', () => {
    const start = Date.now();
    const ids: string[] = [];
    while (Date.now() === start && ids.length < 5000) ids.push(newId());
    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
