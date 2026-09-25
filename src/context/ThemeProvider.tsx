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
import { THINKING_ANIMATION_KEY, readStoredThinkingAnimation, type ThinkingAnimationChoice } from '../config/thinkingAnimation';
import { accentSeasonFor, seasonPalettes } from '../themes/seasonPalette';

const THEME_REVISION_KEY = 'tm-theme-revision';
const MANUAL_SEASON_KEY = 'tm-season-manual';
const PERSONA_SEASON_KEY = 'tm-last-persona-season';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [stored] = useState(() => readStoredThemeState(readStoredString));
  const [mode, setModeState] = useState<ThemeMode>(stored.mode);
  // The season painting now. A persona switch sets it (useChat dispatches
  // `themeChange`), and so does a pick in Settings — but a pick is not a
  // pin: the next persona switch takes the room back to that mind's own
  // colour. `manual` remembers which of the two set it across navigation
  // and reloads; `lastPersonaSeason` is what "Auto" returns to. Choosing a
  // persona clears the manual choice.
  const [season, setSeason] = useState<SeasonTheme>(stored.pinnedSeason ?? stored.personaSeason);
  const [manual, setManual] = useState(() => readStoredString(MANUAL_SEASON_KEY) === '1');
  const [storedPersonaSeason] = useState<SeasonTheme>(() => {
    const last = readStoredString(PERSONA_SEASON_KEY);
    return isSeasonTheme(last) ? last : stored.personaSeason;
  });
  const lastPersonaSeason = useRef<SeasonTheme>(storedPersonaSeason);
  const [lightWarmth, setLightWarmthState] = useState<number>(() => readStoredWarmth(readStoredString));
  const [uiStyle, setUiStyleState] = useState<UiStyle>(() => readStoredUiStyle(readStoredString));
  const [thinkingAnimation, setThinkingAnimationState] = useState<ThinkingAnimationChoice>(() => readStoredThinkingAnimation(readStoredString));
  const [themeRevision, setThemeRevision] = useState(() => Number(readStoredString(THEME_REVISION_KEY)) || 0);
  const advanceThemeRevision = () => setThemeRevision(current => current + 1);

  const accentSeason = accentSeasonFor(season, !manual);
  const theme = mode === 'light' ? lightTheme : seasonThemes[accentSeason];

  // The mode lives on <html> so plain CSS (light.css) can re-theme the
  // whole document, including portals that render outside the React root.
  // Layout effect so the first paint after a toggle is already the new
  // theme rather than one frame of the old one.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const palette = seasonPalettes[accentSeason];
    root.dataset.season = season;
    root.style.setProperty('--tm-season-rgb', palette.rgb);
    root.style.setProperty('--tm-season-accent', mode === 'light' ? palette.light : palette.dark);
    root.style.setProperty('--tm-accent-rgb', palette.rgb);
    // Manual seasons temporarily tint chat chrome. Persona selection clears
    // these two overrides and reveals each mind's original colors again.
    if (manual) {
      const chatPalette = seasonPalettes[season === 'pureDark' ? 'autumnDark' : season];
      root.style.setProperty('--tm-chat-accent-rgb', chatPalette.rgb);
      root.style.setProperty('--tm-chat-accent-color', mode === 'light' ? chatPalette.light : chatPalette.dark);
      root.style.setProperty('--tm-chat-accent-vivid', chatPalette.dark);
    } else {
      root.style.removeProperty('--tm-chat-accent-rgb');
      root.style.removeProperty('--tm-chat-accent-color');
      root.style.removeProperty('--tm-chat-accent-vivid');
    }
    if (mode === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme');
    }
  }, [mode, season, accentSeason, manual]);

  useEffect(() => { writeStoredString(THEME_REVISION_KEY, String(themeRevision)); }, [themeRevision]);
  useEffect(() => { writeStoredString(MANUAL_SEASON_KEY, manual ? '1' : '0'); }, [manual]);

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
    writeStoredString(THINKING_ANIMATION_KEY, thinkingAnimation);
  }, [thinkingAnimation]);

  useEffect(() => {
    const handleThemeChange = (event: CustomEvent<unknown>) => {
      const detail = event.detail;
      const initial = typeof detail === 'object' && detail !== null && 'initial' in detail && detail.initial === true;
      const next = typeof detail === 'object' && detail !== null && 'season' in detail ? detail.season : detail;
      if (isSeasonTheme(next)) {
        if (initial) {
          lastPersonaSeason.current = next;
          writeStoredString(PERSONA_SEASON_KEY, next);
          if (manual || next === season) return;
        }
        lastPersonaSeason.current = next;
        writeStoredString(PERSONA_SEASON_KEY, next);
        setSeason(next);
        setManual(false);
        if (next !== season || manual) advanceThemeRevision();
      }
    };

    window.addEventListener('themeChange', handleThemeChange as EventListener);

    return () => {
      window.removeEventListener('themeChange', handleThemeChange as EventListener);
    };
  }, [season, manual]);

  useEffect(() => {
    writeStoredString(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    writeStoredString(SEASON_KEY, season);
    // Nothing pins any more; clear a flag an older build may have left.
    removeStored(PINNED_KEY);
  }, [season]);

  const setMode = (newMode: ThemeMode) => {
    if (newMode !== mode) advanceThemeRevision();
    setModeState(newMode);
  };

  const pickSeason = (newSeason: SeasonTheme | 'auto') => {
    advanceThemeRevision();
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
        accentSeason,
        seasonFollowsPersona: !manual,
        lightWarmth,
        uiStyle,
        thinkingAnimation,
        themeRevision,
        setMode,
        setSeason: pickSeason,
        setLightWarmth,
        setUiStyle,
        setThinkingAnimation: setThinkingAnimationState,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
