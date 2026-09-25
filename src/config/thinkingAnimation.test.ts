import { describe, expect, it } from 'vitest';
import {
  ALL_THINKING_VISUALS,
  COMPACT_ORB_VARIANTS,
  DEFAULT_THINKING_ANIMATION,
  LARGE_ORB_VARIANTS,
  ORB_VARIANTS,
  THINKING_ANIMATION_KEY,
  THINKING_ANIMATION_OPTIONS,
  readStoredThinkingAnimation,
  thinkingVisualAt,
} from './thinkingAnimation';

describe('thinking animation selection', () => {
  it('offers both presets for every non-shaping orb plus the originals and cycles', () => {
    expect(ORB_VARIANTS).toHaveLength(16);
    expect(ORB_VARIANTS.map(variant => variant.state)).not.toContain('shaping');
    expect(THINKING_ANIMATION_OPTIONS).toHaveLength(22);
    expect(new Set(THINKING_ANIMATION_OPTIONS.map(option => option.value)).size).toBe(22);
    expect(THINKING_ANIMATION_OPTIONS.filter(option => option.group === 'Cycles').map(option => option.label)).toEqual([
      'Everything', 'All compact orbs', 'All large orbs', 'All orbs',
    ]);
    const orbNames = THINKING_ANIMATION_OPTIONS.filter(option => option.group === 'Individual orbs').map(option => option.label);
    expect(new Set(orbNames).size).toBe(16);
    expect(orbNames.every(name => !/large|compact|working|searching|solving|listening|connecting|weaving|composing|breathing/i.test(name))).toBe(true);
    expect(ALL_THINKING_VISUALS).toHaveLength(18);
  });

  it('cycles all styles in order, including cubes and constellation', () => {
    expect(thinkingVisualAt('all-cycle', 0)).toEqual({ kind: 'cubes' });
    expect(thinkingVisualAt('all-cycle', 1)).toEqual({ kind: 'constellation' });
    expect(thinkingVisualAt('all-cycle', 2)).toEqual(ORB_VARIANTS[0]);
    expect(thinkingVisualAt('all-cycle', ALL_THINKING_VISUALS.length)).toEqual({ kind: 'cubes' });
    expect(thinkingVisualAt('orb-cycle', ORB_VARIANTS.length)).toEqual(ORB_VARIANTS[0]);
    expect(COMPACT_ORB_VARIANTS).toHaveLength(8);
    expect(LARGE_ORB_VARIANTS).toHaveLength(8);
    expect(thinkingVisualAt('compact-cycle', 0)).toEqual(COMPACT_ORB_VARIANTS[0]);
    expect(thinkingVisualAt('compact-cycle', 8)).toEqual(COMPACT_ORB_VARIANTS[0]);
    expect(thinkingVisualAt('large-cycle', 7)).toEqual(LARGE_ORB_VARIANTS[7]);
    expect(COMPACT_ORB_VARIANTS.every(variant => variant.size === 20)).toBe(true);
    expect(LARGE_ORB_VARIANTS.every(variant => variant.size === 64)).toBe(true);
  });

  it('restores valid choices and ignores stale storage', () => {
    expect(readStoredThinkingAnimation(() => null)).toBe(DEFAULT_THINKING_ANIMATION);
    expect(readStoredThinkingAnimation(key => key === THINKING_ANIMATION_KEY ? 'orb:weaving:20' : null)).toBe('orb:weaving:20');
    expect(readStoredThinkingAnimation(() => 'orb:shaping:64')).toBe(DEFAULT_THINKING_ANIMATION);
  });
});
