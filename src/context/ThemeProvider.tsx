import { ThemeContext } from './themeContextValue';
import React, { useState, useEffect, useLayoutEffect } from 'react';
import { lightTheme } from '../themes/light';
import { seasonThemes } from '../themes/seasons';
import {
  MODE_KEY,
  PINNED_KEY,
  SEASON_KEY,
  WARMTH_KEY,
  isSeasonTheme,
  lightWarmthVariables,
  readStoredThemeState,
  readStoredWarmth,
  type SeasonTheme,
  type ThemeMode,
} from '../themes/themeState';
import { readStoredString, removeStored, writeStoredString } from '../utils/safeStorage';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [stored] = useState(() => readStoredThemeState(readStoredString));
  const [mode, setModeState] = useState<ThemeMode>(stored.mode);
  const [pinnedSeason, setPinnedSeason] = useState<SeasonTheme | null>(stored.pinnedSeason);
  const [personaSeason, setPersonaSeason] = useState<SeasonTheme>(stored.personaSeason);
  const [lightWarmth, setLightWarmthState] = useState<number>(() => readStoredWarmth(readStoredString));

  const season = pinnedSeason ?? personaSeason;
  const theme = mode === 'light' ? lightTheme : seasonThemes[season];

  // The mode lives on <html> so plain CSS (light.css) can re-theme the
  // whole document, including portals that render outside the React root.
  // Layout effect so the first paint after a toggle is already the new
  // theme rather than one frame of the old one.
  useLayoutEffect(() => {
    if (mode === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [mode]);

  // The warmth slider moves every light surface token as an inline
  // variable on <html>, which beats light.css. Cleared in dark so the
  // stylesheet's values are the only ones in play there.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const vars = lightWarmthVariables(lightWarmth);
    for (const key of Object.keys(vars)) {
      if (mode === 'light') root.style.setProperty(key, vars[key]);
      else root.style.removeProperty(key);
    }
    // The browser chrome (iOS status bar, Android toolbar) follows this.
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      mode === 'light' ? vars['--color-canvas'] : '#0a0a0a',
    );
  }, [mode, lightWarmth]);

  useEffect(() => {
    writeStoredString(WARMTH_KEY, String(lightWarmth));
  }, [lightWarmth]);

  useEffect(() => {
    const handleThemeChange = (event: CustomEvent<unknown>) => {
      if (isSeasonTheme(event.detail)) {
        setPersonaSeason(event.detail);
      }
    };

    window.addEventListener('themeChange', handleThemeChange as EventListener);

    return () => {
      window.removeEventListener('themeChange', handleThemeChange as EventListener);
    };
  }, []);

  useEffect(() => {
    writeStoredString(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    writeStoredString(SEASON_KEY, season);
    if (pinnedSeason) {
      writeStoredString(PINNED_KEY, '1');
    } else {
      removeStored(PINNED_KEY);
    }
  }, [season, pinnedSeason]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
  };

  const setSeason = (newSeason: SeasonTheme | 'auto') => {
    setPinnedSeason(newSeason === 'auto' ? null : newSeason);
  };

  const setLightWarmth = (value: number) => {
    setLightWarmthState(Math.min(100, Math.max(0, Math.round(value))));
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        mode,
        season,
        seasonFollowsPersona: pinnedSeason === null,
        lightWarmth,
        setMode,
        setSeason,
        setLightWarmth,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
