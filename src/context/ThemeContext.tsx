import React, { createContext, useContext, useState, useEffect } from 'react';
import { darkTheme } from '../themes/dark';
import { lightTheme } from '../themes/light';
import { seasonThemes } from '../themes/seasons';
import type { Theme } from '../types/theme';

type ThemeMode = 'dark' | 'light' | 'monochrome';
type SeasonTheme = keyof typeof seasonThemes;

interface ThemeContextType {
  theme: Theme;
  mode: ThemeMode;
  season: SeasonTheme;
  defaultTheme: { mode: ThemeMode; season: SeasonTheme } | null;
  setMode: (mode: ThemeMode) => void;
  setSeason: (season: SeasonTheme) => void;
  setDefaultTheme: (theme: { mode: ThemeMode; season: SeasonTheme }) => void;
  clearDefaultTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: darkTheme,
  mode: 'dark',
  season: 'autumnDark',
  defaultTheme: null,
  setMode: () => {},
  setSeason: () => {},
  setDefaultTheme: () => {},
  clearDefaultTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [season, setSeason] = useState<SeasonTheme>('autumnDark');
  const [defaultTheme, setDefaultTheme] = useState<{ mode: ThemeMode; season: SeasonTheme } | null>(() => {
    const saved = localStorage.getItem('defaultTheme');
    return saved ? JSON.parse(saved) : null;
  });

  // Get the current theme based on mode and season
  const theme = season && season in seasonThemes ? seasonThemes[season] : mode === 'dark' ? darkTheme : lightTheme;

  // Load theme preferences from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('themeMode') as ThemeMode;
    
    if (savedMode) setMode(savedMode);

    // Listen for theme change events (persona-driven)
    const handleThemeChange = (event: CustomEvent<SeasonTheme>) => {
      if (!defaultTheme && event.detail) {
        setSeason(event.detail);
        setMode('dark');
        localStorage.setItem('seasonTheme', event.detail);
        localStorage.setItem('themeMode', 'dark');
      }
    };

    window.addEventListener('themeChange', handleThemeChange as EventListener);
    return () => window.removeEventListener('themeChange', handleThemeChange as EventListener);
  }, [defaultTheme]);

  // Save theme preferences to localStorage and dispatch theme change event
  useEffect(() => {
    localStorage.setItem('themeMode', mode);
    window.dispatchEvent(new CustomEvent('themeChange', { detail: season }));
  }, [mode, season]);

  // Save theme preferences to localStorage
  const handleSetMode = (newMode: ThemeMode) => {
    setMode(newMode);
    if (newMode === 'monochrome') {
      setSeason('monochrome');
      localStorage.setItem('seasonTheme', 'monochrome');
    }
    localStorage.setItem('themeMode', newMode);
  };

  const handleSetSeason = (newSeason: SeasonTheme) => {
    setSeason(newSeason);
    localStorage.setItem('seasonTheme', newSeason);
  };

  const handleSetDefaultTheme = (theme: { mode: ThemeMode; season: SeasonTheme }) => {
    setDefaultTheme(theme);
    setMode(theme.mode);
    setSeason(theme.season);
    localStorage.setItem('defaultTheme', JSON.stringify(theme));
    localStorage.setItem('themeMode', theme.mode);
    localStorage.setItem('seasonTheme', theme.season);
  };

  const handleClearDefaultTheme = () => {
    setDefaultTheme(null);
    localStorage.removeItem('defaultTheme');
    // Reset to persona-driven theme
    setMode('dark');
    setSeason('autumnDark');
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        mode,
        season,
        defaultTheme,
        setMode: handleSetMode,
        setSeason: handleSetSeason,
        setDefaultTheme: handleSetDefaultTheme,
        clearDefaultTheme: handleClearDefaultTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}