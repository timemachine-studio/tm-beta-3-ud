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
  seasonAfterPersonaChange,
  type SeasonTheme,
  type ThemeMode,
} from '../themes/themeState';
import { UI_STYLE_KEY, readStoredUiStyle, type UiStyle } from '../themes/uiStyle';
import { readStoredString, removeStored, writeStoredString } from '../utils/safeStorage';
import { THINKING_ANIMATION_KEY, readStoredThinkingAnimation, type ThinkingAnimationChoice } from '../config/thinkingAnimation';
import { appearancePaletteFor, appearanceSeasonFor, seasonPalettes } from '../themes/seasonPalette';

const THEME_REVISION_KEY = 'tm-theme-revision';
const MANUAL_SEASON_KEY = 'tm-season-manual';
const PERSONA_SEASON_KEY = 'tm-last-persona-season';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [stored] = useState(() => readStoredThemeState(readStoredString));
  const [mode, setModeState] = useState<ThemeMode>(stored.mode);
  // Only Auto follows persona/mode events. A manual season stays selected
  // across model switches, navigation and reloads. Track the latest persona
  // separately so selecting Auto immediately returns to the current mind.
  const [season, setSeason] = useState<SeasonTheme>(stored.pinnedSeason ?? stored.personaSeason);
  const [manual, setManual] = useState(() => stored.pinnedSeason !== null || readStoredString(MANUAL_SEASON_KEY) === '1');
  const [lastPersonaSeason, setLastPersonaSeason] = useState<SeasonTheme>(() => {
    const last = readStoredString(PERSONA_SEASON_KEY);
    return isSeasonTheme(last) ? last : stored.personaSeason;
  });
  const [lightWarmth, setLightWarmthState] = useState<number>(() => readStoredWarmth(readStoredString));
  const [uiStyle, setUiStyleState] = useState<UiStyle>(() => readStoredUiStyle(readStoredString));
  const [thinkingAnimation, setThinkingAnimationState] = useState<ThinkingAnimationChoice>(() => readStoredThinkingAnimation(readStoredString));
  const [themeRevision, setThemeRevision] = useState(() => Number(readStoredString(THEME_REVISION_KEY)) || 0);
  const advanceThemeRevision = () => setThemeRevision(current => current + 1);

  const accentSeason = appearanceSeasonFor(season, !manual, mode, uiStyle);
  const theme = mode === 'light' ? lightTheme : seasonThemes[accentSeason];

  // The mode lives on <html> so plain CSS (light.css) can re-theme the
  // whole document, including portals that render outside the React root.
  // Layout effect so the first paint after a toggle is already the new
  // theme rather than one frame of the old one.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const palette = appearancePaletteFor(accentSeason, uiStyle, lastPersonaSeason);
    root.dataset.season = season;
    root.style.setProperty('--tm-season-rgb', palette.rgb);
    root.style.setProperty('--tm-season-accent', mode === 'light' ? palette.light : palette.dark);
    root.style.setProperty('--tm-accent-rgb', palette.rgb);
    // The chat material always receives an explicit palette. In Auto this is
    // the active mind's season; in Manual it is the selected season. Keeping
    // the variables present lets Present and Classic share exactly the same
    // persona-aware glass rather than making Classic fall back to a generic
    // purple surface.
    const chatPalette = season === 'pureDark' ? palette : seasonPalettes[accentSeason];
    root.style.setProperty('--tm-chat-accent-rgb', chatPalette.rgb);
    root.style.setProperty('--tm-chat-accent-color', mode === 'light' ? chatPalette.light : chatPalette.dark);
    root.style.setProperty('--tm-chat-accent-vivid', mode === 'light' && (uiStyle === 'present' || uiStyle === 'classic') && accentSeason === 'springDark'
      ? `rgb(${chatPalette.rgb})` : chatPalette.dark);
    if (mode === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme');
    }
  }, [mode, season, accentSeason, uiStyle, lastPersonaSeason]);

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
      const next = typeof detail === 'object' && detail !== null && 'season' in detail ? detail.season : detail;
      if (isSeasonTheme(next)) {
        setLastPersonaSeason(next);
        writeStoredString(PERSONA_SEASON_KEY, next);
        const nextSeason = seasonAfterPersonaChange(season, next, !manual);
        if (nextSeason === season) return;
        setSeason(nextSeason);
        advanceThemeRevision();
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
    // Migrate older pinned choices to the persisted manual-selection flag.
    removeStored(PINNED_KEY);
  }, [season]);

  const setMode = (newMode: ThemeMode) => {
    if (newMode !== mode) advanceThemeRevision();
    setModeState(newMode);
  };

  const pickSeason = (newSeason: SeasonTheme | 'auto') => {
    advanceThemeRevision();
    if (newSeason === 'auto') {
      setSeason(lastPersonaSeason);
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
