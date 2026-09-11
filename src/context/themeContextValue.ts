import { createContext, useContext } from 'react';
import { darkTheme } from '../themes/dark';
import type { Theme } from '../types/theme';
import type { SeasonTheme, ThemeMode } from '../themes/themeState';

export type { SeasonTheme, ThemeMode };

interface ThemeContextType {
  theme: Theme;
  mode: ThemeMode;
  /** The dark season currently painting. Meaningful in dark mode only. */
  season: SeasonTheme;
  /**
   * `true` while the season tracks the active persona (Air → autumn,
   * Girlie → spring, PRO → summer). Picking a season in Settings pins it
   * and turns this off; picking "Auto" turns it back on.
   */
  seasonFollowsPersona: boolean;
  /** 0 = white paper, 100 = cream beige. Light mode only. */
  lightWarmth: number;
  setMode: (mode: ThemeMode) => void;
  setSeason: (season: SeasonTheme | 'auto') => void;
  setLightWarmth: (warmth: number) => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: darkTheme,
  mode: 'dark',
  season: 'autumnDark',
  seasonFollowsPersona: true,
  lightWarmth: 100,
  setMode: () => { },
  setSeason: () => { },
  setLightWarmth: () => { },
});

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
