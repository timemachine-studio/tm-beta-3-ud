import { seasonThemes } from './seasons';

export type ThemeMode = 'dark' | 'light';
export type SeasonTheme = keyof typeof seasonThemes;

const THEME_MODES: readonly ThemeMode[] = ['dark', 'light'];

/** Persona → season when nothing is pinned. Air; Girlie and PRO override via useChat. */
export const DEFAULT_PERSONA_SEASON: SeasonTheme = 'autumnDark';

/**
 * Storage keys. `themeMode` and `seasonTheme` predate the light/dark rework
 * and are kept so an existing device keeps its choice. Older builds could
 * also store `monochrome`, or a light season such as `autumn`, under them;
 * the guards reject those so such a device falls back to the defaults
 * instead of a theme this build no longer has. `seasonPinned` is newer:
 * without it a stored season cannot be told apart from one the persona set.
 */
export const MODE_KEY = 'themeMode';
export const SEASON_KEY = 'seasonTheme';
export const PINNED_KEY = 'seasonPinned';

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value);
}

export function isSeasonTheme(value: unknown): value is SeasonTheme {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(seasonThemes, value);
}

export interface StoredThemeState {
  mode: ThemeMode;
  /** The season the user pinned in Settings, or null when it follows the persona. */
  pinnedSeason: SeasonTheme | null;
  /** Last season painted; the starting point before the persona event arrives. */
  personaSeason: SeasonTheme;
}

export function readStoredThemeState(read: (key: string) => string | null): StoredThemeState {
  const mode = read(MODE_KEY);
  const season = read(SEASON_KEY);
  const validSeason = isSeasonTheme(season) ? season : null;
  return {
    mode: isThemeMode(mode) ? mode : 'dark',
    pinnedSeason: read(PINNED_KEY) === '1' ? validSeason : null,
    personaSeason: validSeason ?? DEFAULT_PERSONA_SEASON,
  };
}

/**
 * Light-mode warmth, 0–100. The Settings slider runs from plain white (0)
 * to the cream beige (100); every light surface token is a straight mix
 * of the two endpoint palettes below, applied as inline variables on
 * <html> so one number moves the whole page. Ink and the green accent do
 * not move — only the paper does.
 */
export const WARMTH_KEY = 'lightWarmth';
export const DEFAULT_LIGHT_WARMTH = 100;

export function readStoredWarmth(read: (key: string) => string | null): number {
  const raw = read(WARMTH_KEY);
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : DEFAULT_LIGHT_WARMTH;
}

type Palette = Record<string, string>;

const LIGHT_NEUTRAL: Palette = {
  '--color-canvas': '#ffffff',
  '--color-surface': '#ffffff',
  '--color-sunken': '#f2f2f0',
  '--color-well': '#ebebe8',
  '--color-line': '#e6e6e3',
  '--color-line-strong': '#c4c4bf',
  '--color-ink-muted': '#66665f',
  '--color-ink-faint': '#97978f',
  '--tm-pane-bg': '#ffffff',
  '--tm-pane-border': '#e6e6e3',
  '--tm-popover-bg': '#ffffff',
  '--tm-select-bg': '#e8e8e5',
  '--tm-shadow-hex': '#000000',
};

const LIGHT_CREAM: Palette = {
  '--color-canvas': '#fdf1e1',
  '--color-surface': '#fffaf3',
  '--color-sunken': '#f5e7d2',
  '--color-well': '#eedfc8',
  '--color-line': '#eadcc6',
  '--color-line-strong': '#c9b99f',
  '--color-ink-muted': '#6b6660',
  '--color-ink-faint': '#9a9489',
  '--tm-pane-bg': '#fffaf3',
  '--tm-pane-border': '#eadcc6',
  '--tm-popover-bg': '#fffcf7',
  '--tm-select-bg': '#ecdfc9',
  '--tm-shadow-hex': '#3c2d14',
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): [number, number, number] {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return [
    Math.round(ar + (br - ar) * t),
    Math.round(ag + (bg - ag) * t),
    Math.round(ab + (bb - ab) * t),
  ];
}

const toHex = ([r, g, b]: [number, number, number]) =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;

/** The inline variables for a given warmth. Keys match light.css. */
export function lightWarmthVariables(warmth: number): Record<string, string> {
  const t = Math.min(100, Math.max(0, warmth)) / 100;
  const out: Record<string, string> = {};
  for (const key of Object.keys(LIGHT_CREAM)) {
    const rgb = mix(LIGHT_NEUTRAL[key], LIGHT_CREAM[key], t);
    if (key === '--tm-shadow-hex') {
      out['--tm-shadow-rgb'] = rgb.join(' ');
    } else {
      out[key] = toHex(rgb);
      if (key === '--color-canvas') {
        out['--color-black'] = toHex(rgb);
        out['--tm-paper-rgb'] = rgb.join(' ');
      }
    }
  }
  return out;
}
