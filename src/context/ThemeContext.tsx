import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { darkTheme } from '../themes/dark';
import { lightTheme } from '../themes/light';
import { seasonThemes } from '../themes/seasons';
import { supabase } from '../lib/supabase';
import type { Theme } from '../types/theme';

type ThemeMode = 'dark' | 'light' | 'monochrome';
type SeasonTheme = keyof typeof seasonThemes;

interface DefaultThemeType {
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

const ThemeContext = createContext<ThemeContextType>({
  theme: darkTheme,
  mode: 'dark',
  season: 'autumnDark',
  defaultTheme: null,
  setMode: () => {},
  setSeason: () => {},
  setDefaultTheme: () => {},
  clearDefaultTheme: () => {},
  loadUserTheme: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [season, setSeason] = useState<SeasonTheme>('autumnDark');
  const [previousSeason, setPreviousSeason] = useState<SeasonTheme>('autumnDark');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [defaultTheme, setDefaultTheme] = useState<DefaultThemeType | null>(() => {
    const saved = localStorage.getItem('defaultTheme');
    return saved ? JSON.parse(saved) : null;
  });

  // Get the current theme based on mode and season
  const theme = season && season in seasonThemes ? seasonThemes[season] : mode === 'dark' ? darkTheme : lightTheme;

  // Load user's default theme from Supabase
  const loadUserTheme = useCallback(async (userId: string) => {
    try {
      setCurrentUserId(userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('default_theme')
        .eq('id', userId)
        .single();

      if (!error && data?.default_theme) {
        const userTheme = data.default_theme as DefaultThemeType;
        if (userTheme.mode && userTheme.season) {
          setDefaultTheme(userTheme);
          setMode(userTheme.mode);
          setSeason(userTheme.season);
          localStorage.setItem('defaultTheme', JSON.stringify(userTheme));
          localStorage.setItem('themeMode', userTheme.mode);
          localStorage.setItem('seasonTheme', userTheme.season);
        }
      }
    } catch (err) {
      console.error('Error loading user theme:', err);
    }
  }, []);

  // Load theme preferences from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('themeMode') as ThemeMode;
    const savedSeason = localStorage.getItem('seasonTheme') as SeasonTheme;

    if (savedMode) setMode(savedMode);
    if (savedSeason && savedSeason in seasonThemes) setSeason(savedSeason);
  }, []);

  // NOTE: Auth listener removed - theme loading from server should be triggered
  // by the component that needs it (e.g., after profile loads) to avoid race conditions
  // with multiple onAuthStateChange listeners competing

  // Listen for theme change events (persona-driven) - use ref to avoid re-subscribing
  const defaultThemeRef = React.useRef(defaultTheme);
  defaultThemeRef.current = defaultTheme;

  useEffect(() => {
    const handleThemeChange = (event: CustomEvent<SeasonTheme>) => {
      if (!defaultThemeRef.current && event.detail) {
        setSeason(event.detail);
        setMode('dark');
        localStorage.setItem('seasonTheme', event.detail);
        localStorage.setItem('themeMode', 'dark');
      }
    };

    window.addEventListener('themeChange', handleThemeChange as EventListener);

    return () => {
      window.removeEventListener('themeChange', handleThemeChange as EventListener);
    };
  }, []);

  // Save theme preferences to localStorage
  useEffect(() => {
    localStorage.setItem('themeMode', mode);
    localStorage.setItem('seasonTheme', season);
  }, [mode, season]);

  // Save theme preferences to localStorage
  const handleSetMode = (newMode: ThemeMode) => {
    setMode(newMode);
    if (newMode === 'monochrome') {
      // Save current season before switching to monochrome
      if (season !== 'monochrome') {
        setPreviousSeason(season);
        localStorage.setItem('previousSeasonTheme', season);
      }
      setSeason('monochrome');
      localStorage.setItem('seasonTheme', 'monochrome');
    } else {
      // Restore previous season when turning off monochrome
      const savedPreviousSeason = localStorage.getItem('previousSeasonTheme') as SeasonTheme;
      const restoredSeason = savedPreviousSeason || previousSeason || 'autumnDark';
      setSeason(restoredSeason);
      localStorage.setItem('seasonTheme', restoredSeason);
    }
    localStorage.setItem('themeMode', newMode);
  };

  const handleSetSeason = (newSeason: SeasonTheme) => {
    setSeason(newSeason);
    localStorage.setItem('seasonTheme', newSeason);
  };

  const handleSetDefaultTheme = async (newDefaultTheme: DefaultThemeType) => {
    setDefaultTheme(newDefaultTheme);
    setMode(newDefaultTheme.mode);
    setSeason(newDefaultTheme.season);
    localStorage.setItem('defaultTheme', JSON.stringify(newDefaultTheme));
    localStorage.setItem('themeMode', newDefaultTheme.mode);
    localStorage.setItem('seasonTheme', newDefaultTheme.season);

    // Save to Supabase if user is logged in
    if (currentUserId) {
      try {
        await supabase
          .from('profiles')
          .update({ default_theme: newDefaultTheme })
          .eq('id', currentUserId);
      } catch (err) {
        console.error('Error saving default theme to Supabase:', err);
      }
    }
  };

  const handleClearDefaultTheme = async () => {
    setDefaultTheme(null);
    localStorage.removeItem('defaultTheme');
    // Reset to persona-driven theme
    setMode('dark');
    setSeason('autumnDark');

    // Clear from Supabase if user is logged in
    if (currentUserId) {
      try {
        await supabase
          .from('profiles')
          .update({ default_theme: null })
          .eq('id', currentUserId);
      } catch (err) {
        console.error('Error clearing default theme from Supabase:', err);
      }
    }
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
        loadUserTheme,
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