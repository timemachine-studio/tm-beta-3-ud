import { createContext, useContext } from 'react';
import { darkTheme } from '../themes/dark';
import type { seasonThemes } from '../themes/seasons';
import type { Theme } from '../types/theme';
export type ThemeMode = 'dark' | 'light' | 'monochrome';
export type SeasonTheme = keyof typeof seasonThemes;

export interface DefaultThemeType {
  mode: ThemeMode;
  season: SeasonTheme;
}

interface ThemeContextType {
  theme: Theme;
  mode: ThemeMode;
  season: SeasonTheme;
  defaultTheme: DefaultThemeType | null;
  setMode: (mode: ThemeMode) => void;
  setSeason: (season: SeasonTheme) => void;
  setDefaultTheme: (theme: DefaultThemeType) => void;
  clearDefaultTheme: () => void;
  loadUserTheme: (userId: string) => Promise<void>;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: darkTheme,
  mode: 'dark',
  season: 'autumnDark',
  defaultTheme: null,
  setMode: () => { },
  setSeason: () => { },
  setDefaultTheme: () => { },
  clearDefaultTheme: () => { },
  loadUserTheme: async () => { },
});

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}