import { describe, expect, it } from 'vitest';
import { accentSeasonFor, paletteColor, seasonPreviewGradient } from './seasonPalette';

describe('season palettes', () => {
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
});
