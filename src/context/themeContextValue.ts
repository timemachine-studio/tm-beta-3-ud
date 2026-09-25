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
  /** The dark season currently painting. Meaningful in dark mode only. */
  season: SeasonTheme;
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
  seasonFollowsPersona: true,
  lightWarmth: 40,
  uiStyle: 'current',
  thinkingAnimation: 'orb-cycle',
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
