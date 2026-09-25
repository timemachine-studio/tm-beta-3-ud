import { createContext, useContext } from 'react';
import { darkTheme } from '../themes/dark';
import type { Theme } from '../types/theme';
import type { SeasonTheme, ThemeMode } from '../themes/themeState';
import type { UiStyle } from '../themes/uiStyle';
import type { ThinkingAnimationChoice } from '../config/thinkingAnimation';

export type { SeasonTheme, ThemeMode, UiStyle };

interface ThemeContextType {
  theme: Theme;
  mode: ThemeMode;
  /** The selected season: background in dark, accent palette in both modes. */
  season: SeasonTheme;
  /** Resolved accent season; Girlie Auto remains pink, manual Spring is red. */
  accentSeason: SeasonTheme;
  /**
   * `true` while the season painting is the active persona's own (Air →
   * autumn, Girlie → spring, PRO → summer). Picking a season in Settings
   * recolours the room now and turns this off — until the next persona
   * switch, which always brings that mind's colour back. "Auto" returns to
   * the persona's colour straight away.
   */
  seasonFollowsPersona: boolean;
  /** 0 = white paper, 100 = cream beige. Light mode only. */
  lightWarmth: number;
  /** The shell: the rail-and-glass `current` UI, or the `legacy` one before it. */
  uiStyle: UiStyle;
  thinkingAnimation: ThinkingAnimationChoice;
  /** Increments when a global theme or persona choice should recolor Notes. */
  themeRevision: number;
  setMode: (mode: ThemeMode) => void;
  setSeason: (season: SeasonTheme | 'auto') => void;
  setLightWarmth: (warmth: number) => void;
  setUiStyle: (style: UiStyle) => void;
  setThinkingAnimation: (animation: ThinkingAnimationChoice) => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: darkTheme,
  mode: 'dark',
  season: 'autumnDark',
  accentSeason: 'autumnDark',
  seasonFollowsPersona: true,
  lightWarmth: 40,
  uiStyle: 'current',
  thinkingAnimation: 'orb-cycle',
  themeRevision: 0,
  setMode: () => { },
  setSeason: () => { },
  setLightWarmth: () => { },
  setUiStyle: () => { },
  setThinkingAnimation: () => { },
});

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
