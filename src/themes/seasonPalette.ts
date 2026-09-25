import type { SeasonTheme, ThemeMode } from './themeState';
import type { NoteTheme } from '../components/notes/notesState';

/** One palette for chrome, reasoning visuals, and the default Notes hue. */
export const seasonPalettes: Record<SeasonTheme, { rgb: string; dark: string; light: string; note: NoteTheme }> = {
  springDark: { rgb: '239 68 68', dark: '#f87171', light: '#b91c1c', note: 'red' },
  summerDark: { rgb: '34 211 238', dark: '#67e8f9', light: '#0e7490', note: 'cyan' },
  autumnDark: { rgb: '168 85 247', dark: '#d8a4ff', light: '#d8a4ff', note: 'purple' },
  winterDark: { rgb: '59 130 246', dark: '#93c5fd', light: '#1d4ed8', note: 'blue' },
  blossomDark: { rgb: '236 72 153', dark: '#f9a8d4', light: '#be185d', note: 'pink' },
  verdureDark: { rgb: '34 197 94', dark: '#86efac', light: '#15803d', note: 'green' },
  emberDark: { rgb: '249 115 22', dark: '#fdba74', light: '#c2410c', note: 'orange' },
  sunflareDark: { rgb: '234 179 8', dark: '#fde047', light: '#a16207', note: 'yellow' },
  pureDark: { rgb: '203 213 225', dark: '#e2e8f0', light: '#475569', note: 'slate' },
};

export const healthcarePalette = { rgb: '16 185 129', dark: '#6ee7b7', light: '#047857', note: 'green' } as const;

/** Brand and welcome-word colors stay as vivid in Light as they are in Dark. */
const personaNeonColors = {
  default: '#c084fc',
  girlie: '#f472b6',
  pro: '#22d3ee',
} as const;

export function personaNeonColor(persona: string): string {
  return persona in personaNeonColors
    ? personaNeonColors[persona as keyof typeof personaNeonColors]
    : personaNeonColors.default;
}

/** Girlie's automatic pink remains distinct from manually selecting red Spring. */
export function accentSeasonFor(season: SeasonTheme, followsPersona: boolean): SeasonTheme {
  return followsPersona && season === 'springDark' ? 'blossomDark' : season;
}

export function paletteColor(season: SeasonTheme, mode: ThemeMode, healthcare = false) {
  const palette = healthcare ? healthcarePalette : seasonPalettes[season];
  return mode === 'light' ? palette.light : palette.dark;
}

/** A tiny swatch needs a brighter horizon than the full-screen atmosphere. */
export function seasonPreviewGradient(season: SeasonTheme): string {
  if (season === 'pureDark') return 'linear-gradient(to top, #17171b, #020203 72%)';
  const rgb = seasonPalettes[season].rgb;
  return `linear-gradient(to bottom, #09080b 0%, #0b0a0d 24%, rgb(${rgb} / 0.45) 62%, rgb(${rgb} / 0.96) 100%)`;
}
