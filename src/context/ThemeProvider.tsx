import { ThemeContext } from './themeContextValue';
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
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
import { UI_STYLE_KEY, readStoredUiStyle, type UiStyle } from '../themes/uiStyle';
import { readStoredString, removeStored, writeStoredString } from '../utils/safeStorage';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [stored] = useState(() => readStoredThemeState(readStoredString));
  const [mode, setModeState] = useState<ThemeMode>(stored.mode);
  // The season painting now. A persona switch sets it (useChat dispatches
  // `themeChange`), and so does a pick in Settings — but a pick is not a
  // pin: the next persona switch takes the room back to that mind's own
  // colour. `manual` remembers which of the two set it, for the Settings
  // swatches; `lastPersonaSeason` is what "Auto" returns to. A season an
  // older build pinned is honoured as the starting point only.
  const [season, setSeason] = useState<SeasonTheme>(stored.pinnedSeason ?? stored.personaSeason);
  const [manual, setManual] = useState(false);
  const lastPersonaSeason = useRef<SeasonTheme>(stored.personaSeason);
  const [lightWarmth, setLightWarmthState] = useState<number>(() => readStoredWarmth(readStoredString));
  const [uiStyle, setUiStyleState] = useState<UiStyle>(() => readStoredUiStyle(readStoredString));

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

  // The shell lives on <html> too (material.css, index.css): the legacy UI
  // has no rail and renders at 100%, and both are decided in CSS before the
  // first paint of a route rather than after React has measured anything.
  useLayoutEffect(() => {
    document.documentElement.dataset.tmUi = uiStyle;
    // --vh (App.tsx) divides by the zoom, which the shell just changed.
    window.dispatchEvent(new Event('resize'));
  }, [uiStyle]);

  useEffect(() => {
    writeStoredString(UI_STYLE_KEY, uiStyle);
  }, [uiStyle]);

  useEffect(() => {
    const handleThemeChange = (event: CustomEvent<unknown>) => {
      if (isSeasonTheme(event.detail)) {
        lastPersonaSeason.current = event.detail;
        setSeason(event.detail);
        setManual(false);
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
    // Nothing pins any more; clear a flag an older build may have left.
    removeStored(PINNED_KEY);
  }, [season]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
  };

  const pickSeason = (newSeason: SeasonTheme | 'auto') => {
    if (newSeason === 'auto') {
      setSeason(lastPersonaSeason.current);
      setManual(false);
    } else {
      setSeason(newSeason);
      setManual(true);
    }
  };

  const setLightWarmth = (value: number) => {
    setLightWarmthState(Math.min(100, Math.max(0, Math.round(value))));
  };

  const setUiStyle = (style: UiStyle) => {
    setUiStyleState(style);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        mode,
        season,
        seasonFollowsPersona: !manual,
        lightWarmth,
        uiStyle,
        setMode,
        setSeason: pickSeason,
        setLightWarmth,
        setUiStyle,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
