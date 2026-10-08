import { describe, expect, it } from 'vitest';
import { accentSeasonFor, appearancePaletteFor, appearanceSeasonFor, paletteColor, seasonPreviewGradient, usesAppearanceAccent } from './seasonPalette';

describe('season palettes', () => {
  it('keeps Pure black while its accent follows the chosen mind', () => {
    expect(appearanceSeasonFor('pureDark', false, 'dark', 'present')).toBe('pureDark');
    expect(appearancePaletteFor('pureDark', 'present')).toEqual(appearancePaletteFor('autumnDark', 'present'));
    expect(appearancePaletteFor('pureDark', 'present', 'springDark')).toEqual(appearancePaletteFor('blossomDark', 'present'));
    expect(appearancePaletteFor('pureDark', 'legacy', 'summerDark')).toEqual(appearancePaletteFor('summerDark', 'legacy'));
    expect(appearancePaletteFor('winterDark', 'present', 'springDark')).toEqual(appearancePaletteFor('winterDark', 'present'));
    expect(paletteColor('pureDark', 'dark')).toBe('var(--tm-season-accent)');
  });
  it('keeps Girlie Auto pink while a manual Spring choice is red', () => {
    expect(accentSeasonFor('springDark', true)).toBe('blossomDark');
    expect(accentSeasonFor('springDark', false)).toBe('springDark');
    expect(paletteColor('blossomDark', 'dark')).toBe('#f9a8d4');
    expect(paletteColor('springDark', 'dark')).toBe('#f87171');
  });

  it('uses the same bright Autumn purple in either appearance', () => {
    expect(paletteColor('autumnDark', 'light')).toBe(paletteColor('autumnDark', 'dark'));
  });

  it('makes the season previews run from dark to their own hue', () => {
    expect(seasonPreviewGradient('sunflareDark')).toContain('234 179 8');
    expect(seasonPreviewGradient('pureDark')).not.toContain('203 213 225');
  });

  it('restores Present light Air to its original Autumn purple and persona accents', () => {
    expect(appearanceSeasonFor('autumnDark', true, 'light', 'present')).toBe('autumnDark');
    expect(usesAppearanceAccent('autumnDark', true, 'light', 'present')).toBe(false);
    expect(appearanceSeasonFor('autumnDark', true, 'dark', 'present')).toBe('autumnDark');
    expect(appearanceSeasonFor('autumnDark', true, 'light', 'legacy')).toBe('autumnDark');
    expect(usesAppearanceAccent('autumnDark', true, 'light', 'legacy')).toBe(false);
  });

  it('preserves manual seasons and automatic Girlie/PRO colors in light mode', () => {
    expect(appearanceSeasonFor('autumnDark', false, 'light', 'present')).toBe('autumnDark');
    expect(appearanceSeasonFor('winterDark', false, 'light', 'present')).toBe('winterDark');
    expect(appearanceSeasonFor('springDark', false, 'light', 'present')).toBe('springDark');
    expect(appearanceSeasonFor('springDark', true, 'light', 'present')).toBe('blossomDark');
    expect(appearanceSeasonFor('summerDark', true, 'light', 'present')).toBe('summerDark');
    expect(usesAppearanceAccent('springDark', true, 'light', 'present')).toBe(false);
  });
});
