import { ThemeContext, type ThemeMode, type SeasonTheme, type DefaultThemeType } from './themeContextValue';
import React, { useState, useEffect, useCallback } from 'react';
import { darkTheme } from '../themes/dark';
import { lightTheme } from '../themes/light';
import { seasonThemes } from '../themes/seasons';
import { supabase } from '../lib/supabase';
import type { Json } from '../types/database';
import {
  readStoredJson,
  readStoredString,
  removeStored,
  writeStoredJson,
  writeStoredString,
} from '../utils/safeStorage';

const THEME_MODES: readonly ThemeMode[] = ['dark', 'light', 'monochrome'];

function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value);
}

function isSeasonTheme(value: unknown): value is SeasonTheme {
  return typeof value === 'string' && value in seasonThemes;
}

/**
 * Anything claiming to be a stored or server-side default theme has to prove
 * both halves are values this build still knows about. A season name from an
 * older build would otherwise fall through to the light theme on a dark app.
 */
function isDefaultTheme(value: unknown): value is DefaultThemeType {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<DefaultThemeType>;
  return isThemeMode(candidate.mode) && isSeasonTheme(candidate.season);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = readStoredString('themeMode');
    return isThemeMode(saved) ? saved : 'dark';
  });
  const [season, setSeason] = useState<SeasonTheme>(() => {
    const saved = readStoredString('seasonTheme');
    return isSeasonTheme(saved) ? saved : 'autumnDark';
  });
  const [previousSeason, setPreviousSeason] = useState<SeasonTheme>('autumnDark');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [defaultTheme, setDefaultTheme] = useState<DefaultThemeType | null>(
    () => readStoredJson('defaultTheme', isDefaultTheme),
  );

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

      if (!error && isDefaultTheme(data?.default_theme)) {
        const userTheme = data.default_theme;
        setDefaultTheme(userTheme);
        setMode(userTheme.mode);
        setSeason(userTheme.season);
        writeStoredJson('defaultTheme', userTheme);
        writeStoredString('themeMode', userTheme.mode);
        writeStoredString('seasonTheme', userTheme.season);
      }
    } catch (err) {
      console.error('Error loading user theme:', err);
    }
  }, []);

  // NOTE: Auth listener removed - theme loading from server should be triggered
  // by the component that needs it (e.g., after profile loads) to avoid race conditions
  // with multiple onAuthStateChange listeners competing

  useEffect(() => {
    const handleThemeChange = (event: CustomEvent<SeasonTheme>) => {
      if (!defaultTheme && event.detail) {
        setSeason(event.detail);
        setMode('dark');
        writeStoredString('seasonTheme', event.detail);
        writeStoredString('themeMode', 'dark');
      }
    };

    window.addEventListener('themeChange', handleThemeChange as EventListener);

    return () => {
      window.removeEventListener('themeChange', handleThemeChange as EventListener);
    };
  }, [defaultTheme]);

  // Save theme preferences to localStorage
  useEffect(() => {
    writeStoredString('themeMode', mode);
    writeStoredString('seasonTheme', season);
  }, [mode, season]);

  // Save theme preferences to localStorage
  const handleSetMode = (newMode: ThemeMode) => {
    setMode(newMode);
    if (newMode === 'monochrome') {
      // Save current season before switching to monochrome
      if (season !== 'monochrome') {
        setPreviousSeason(season);
        writeStoredString('previousSeasonTheme', season);
      }
      setSeason('monochrome');
      writeStoredString('seasonTheme', 'monochrome');
    } else {
      // Restore previous season when turning off monochrome
      const savedPreviousSeason = readStoredString('previousSeasonTheme');
      const restoredSeason = isSeasonTheme(savedPreviousSeason) ? savedPreviousSeason : previousSeason;
      setSeason(restoredSeason);
      writeStoredString('seasonTheme', restoredSeason);
    }
    writeStoredString('themeMode', newMode);
  };

  const handleSetSeason = (newSeason: SeasonTheme) => {
    setSeason(newSeason);
    writeStoredString('seasonTheme', newSeason);
  };

  const handleSetDefaultTheme = async (newDefaultTheme: DefaultThemeType) => {
    setDefaultTheme(newDefaultTheme);
    setMode(newDefaultTheme.mode);
    setSeason(newDefaultTheme.season);
    writeStoredJson('defaultTheme', newDefaultTheme);
    writeStoredString('themeMode', newDefaultTheme.mode);
    writeStoredString('seasonTheme', newDefaultTheme.season);

    // Save to Supabase if user is logged in
    if (currentUserId) {
      try {
        await supabase
          .from('profiles')
          .update({ default_theme: newDefaultTheme as unknown as Json })
          .eq('id', currentUserId);
      } catch (err) {
        console.error('Error saving default theme to Supabase:', err);
      }
    }
  };

  const handleClearDefaultTheme = async () => {
    setDefaultTheme(null);
    removeStored('defaultTheme');
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
