import { describe, expect, it } from 'vitest';
import { readStoredThemeState, isSeasonTheme, isThemeMode } from './themeState';

const storage = (values: Record<string, string>) => (key: string) => values[key] ?? null;

describe('readStoredThemeState', () => {
  it('defaults a fresh device to dark, following the persona', () => {
    expect(readStoredThemeState(storage({}))).toEqual({
      mode: 'dark',
      pinnedSeason: null,
      personaSeason: 'autumnDark',
    });
  });

  it('keeps a light choice and ignores the season for it', () => {
    const state = readStoredThemeState(storage({ themeMode: 'light', seasonTheme: 'winterDark' }));
    expect(state.mode).toBe('light');
    expect(state.pinnedSeason).toBeNull();
  });

  it('restores a pinned season only when the pin flag is set', () => {
    expect(readStoredThemeState(storage({ seasonTheme: 'winterDark' })).pinnedSeason).toBeNull();
    expect(readStoredThemeState(storage({ seasonTheme: 'winterDark', seasonPinned: '1' })).pinnedSeason).toBe('winterDark');
  });

  // Older builds wrote `monochrome` as a mode and light seasons such as
  // `autumn` and `spring`; neither exists any more and must not leak through.
  it('rejects values written by older builds', () => {
    const state = readStoredThemeState(storage({ themeMode: 'monochrome', seasonTheme: 'autumn', seasonPinned: '1' }));
    expect(state).toEqual({ mode: 'dark', pinnedSeason: null, personaSeason: 'autumnDark' });
    expect(isThemeMode('monochrome')).toBe(false);
    expect(isSeasonTheme('monochrome')).toBe(false);
    expect(isSeasonTheme('spring')).toBe(false);
    expect(isSeasonTheme('constructor')).toBe(false);
    expect(isSeasonTheme('springDark')).toBe(true);
  });
});

describe('light warmth', () => {
  it('defaults to cream and clamps stored values', async () => {
    const { readStoredWarmth, lightWarmthVariables } = await import('./themeState');
    expect(readStoredWarmth(storage({}))).toBe(100);
    expect(readStoredWarmth(storage({ lightWarmth: '250' }))).toBe(100);
    expect(readStoredWarmth(storage({ lightWarmth: '-3' }))).toBe(0);
    expect(readStoredWarmth(storage({ lightWarmth: 'x' }))).toBe(100);
    expect(readStoredWarmth(storage({ lightWarmth: '42.6' }))).toBe(43);

    expect(lightWarmthVariables(0)['--color-canvas']).toBe('#ffffff');
    expect(lightWarmthVariables(100)['--color-canvas']).toBe('#fdf1e1');
    // The two poles that inline styles read as rgb triples move with it.
    expect(lightWarmthVariables(100)['--tm-paper-rgb']).toBe('253 241 225');
    expect(lightWarmthVariables(0)['--tm-shadow-rgb']).toBe('0 0 0');
    expect(lightWarmthVariables(50)['--color-canvas']).toBe('#fef8f0');
  });
});
