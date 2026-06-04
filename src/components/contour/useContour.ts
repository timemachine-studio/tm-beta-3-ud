/**
 * TimeMachine Contour - Detection Hook
 *
 * Monitors textbox input and determines when/what to show in the Contour panel.
 *
 * Modes:
 *   - hidden:   nothing shown
 *   - commands: "/" command palette
 *   - module:   a specific tool is active (auto-detected OR focused via "/" selection)
 *
 * Focused mode: when a user selects a tool from "/", the tool opens INSIDE the
 * contour panel and the textbox becomes input for that tool. Esc exits.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  // Types (re-exported from registry)
  ModuleId, ModuleData, ContourState, ContourMode,
  // Handler mapping
  HANDLER_TO_MODULE,
  // Detect & process functions
  evaluateMath, isMathExpression,
  detectGraph,
  detectUnits,
  detectCurrency, resolveCurrency,
  detectTimezone,
  detectColor,
  detectDate,
  createTimerState, tickTimer, formatDuration, formatDurationLabel,
  detectRandom,
  detectWordCount, analyzeText,
  detectTranslation, resolveTranslation,
  detectDictionary, resolveDictionary,
  detectLorem,
  detectJson, formatJson,
  detectBase64, processBase64,
  detectUrlEncoded, processUrl,
  createHashResult,
  testRegex,
  searchCommands,
  groupByCategory,
  createSnippetResult,
  detectNavigation,
  detectQuickNote,
  detectQuickEvent,
  detectWebViewer,
} from './moduleRegistry';

export type { ModuleId, ModuleData, ContourState, ContourMode };

const INITIAL_STATE: ContourState = {
  mode: 'hidden',
  module: null,
  commands: [],
  commandQuery: '',
  selectedIndex: 0,
};

export function useContour() {
  const [state, setState] = useState<ContourState>(INITIAL_STATE);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currencyGenRef = useRef<number>(0);
  const translatorGenRef = useRef<number>(0);
  const dictionaryGenRef = useRef<number>(0);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const autoDetect = useCallback((input: string): ModuleData | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // 1. Color (#hex, rgb(), hsl(), named)
    const color = detectColor(trimmed);
    if (color) return { id: 'color', focused: false, color };

    // 2. Unit conversion
    const units = detectUnits(trimmed);
    if (units) return { id: 'units', focused: false, units };

    // 3. Currency
    const currency = detectCurrency(trimmed);
    if (currency) return { id: 'currency', focused: false, currency };

    // 4. Timezone
    const timezone = detectTimezone(trimmed);
    if (timezone) return { id: 'timezone', focused: false, timezone };

    // 5. Date calculator
    const date = detectDate(trimmed);
    if (date) return { id: 'date', focused: false, date };

    // 6. Random generator
    const random = detectRandom(trimmed);
    if (random) return { id: 'random', focused: false, random };

    // 7. Translator
    const translation = detectTranslation(trimmed);
    if (translation) return { id: 'translator', focused: false, translator: translation };

    // 8. Dictionary
    const dictionary = detectDictionary(trimmed);
    if (dictionary) return { id: 'dictionary', focused: false, dictionary };

    // 9. Word counter
    const wordcount = detectWordCount(trimmed);
    if (wordcount) return { id: 'wordcount', focused: false, wordcount };

    // 10. Lorem Ipsum
    const lorem = detectLorem(trimmed);
    if (lorem) return { id: 'lorem', focused: false, lorem };

    // 11. JSON formatter
    const json = detectJson(trimmed);
    if (json) return { id: 'json-format', focused: false, jsonFormat: json };

    // 12. Base64 decode
    const base64 = detectBase64(trimmed);
    if (base64) return { id: 'base64', focused: false, base64 };

    // 13. URL decode
    const urlEncode = detectUrlEncoded(trimmed);
    if (urlEncode) return { id: 'url-encode', focused: false, urlEncode };

    // 14. Graph plotter (before math — more specific)
    const graph = detectGraph(trimmed);
    if (graph) return { id: 'graph', focused: false, graph };

    // 15. Quick Note (/note <text>)
    const note = detectQuickNote(trimmed);
    if (note) return { id: 'quick-note', focused: false, quickNote: note };

    // 16. Quick Event (/event <text>)
    const event = detectQuickEvent(trimmed);
    if (event) return { id: 'quick-event', focused: false, quickEvent: event };

    // 17. Navigation command (go <page>)
    const nav = detectNavigation(trimmed);
    if (nav) return { id: 'navigation', focused: false, navigation: nav };

    // 18. Web Viewer (/search, /google, or raw URL)
    const web = detectWebViewer(trimmed);
    if (web) return { id: 'web-viewer', focused: false, webViewer: web };

    // 19. Math (broadest match, lowest priority)
    if (isMathExpression(trimmed)) {
      const calc = evaluateMath(trimmed);
      if (calc) return { id: 'calculator', focused: false, calculator: calc };
    }

    return null;
  }, []);

  const focusedDetect = useCallback((moduleId: ModuleId, input: string): ModuleData | null => {
    const trimmed = input.trim();

    switch (moduleId) {
      case 'calculator': {
        if (!trimmed) return { id: 'calculator', focused: true };
        const calc = evaluateMath(trimmed);
        return { id: 'calculator', focused: true, calculator: calc || undefined };
      }
      case 'units': {
        if (!trimmed) return { id: 'units', focused: true };
        const units = detectUnits(trimmed);
        return { id: 'units', focused: true, units: units || undefined };
      }
      case 'currency': {
        if (!trimmed) return { id: 'currency', focused: true };
        const currency = detectCurrency(trimmed);
        return { id: 'currency', focused: true, currency: currency || undefined };
      }
      case 'timezone': {
        if (!trimmed) return { id: 'timezone', focused: true };
        const timezone = detectTimezone(trimmed);
        return { id: 'timezone', focused: true, timezone: timezone || undefined };
      }
      case 'color': {
        if (!trimmed) return { id: 'color', focused: true };
        const color = detectColor(trimmed);
        return { id: 'color', focused: true, color: color || undefined };
      }
      case 'date': {
        if (!trimmed) return { id: 'date', focused: true };
        const date = detectDate(trimmed);
        return { id: 'date', focused: true, date: date || undefined };
      }
      case 'timer': {
        if (!trimmed) return { id: 'timer', focused: true };
        const timer = createTimerState(trimmed);
        return { id: 'timer', focused: true, timer: timer || undefined };
      }
      case 'random': {
        if (!trimmed) return { id: 'random', focused: true };
        const random = detectRandom(trimmed);
        return { id: 'random', focused: true, random: random || undefined };
      }
      case 'wordcount': {
        if (!trimmed) return { id: 'wordcount', focused: true };
        const wordcount = analyzeText(trimmed);
        return { id: 'wordcount', focused: true, wordcount };
      }
      case 'translator': {
        if (!trimmed) return { id: 'translator', focused: true };
        const translation = detectTranslation(trimmed);
        return { id: 'translator', focused: true, translator: translation || undefined };
      }
      case 'dictionary': {
        if (!trimmed) return { id: 'dictionary', focused: true };
        const dictionary = detectDictionary(trimmed);
        return { id: 'dictionary', focused: true, dictionary: dictionary || undefined };
      }
      case 'lorem': {
        if (!trimmed) return { id: 'lorem', focused: true };
        const lorem = detectLorem(trimmed);
        return { id: 'lorem', focused: true, lorem: lorem || undefined };
      }
      case 'json-format': {
        if (!trimmed) return { id: 'json-format', focused: true };
        const jsonFormat = formatJson(trimmed);
        return { id: 'json-format', focused: true, jsonFormat };
      }
      case 'base64': {
        if (!trimmed) return { id: 'base64', focused: true };
        const base64 = processBase64(trimmed, 'encode');
        return { id: 'base64', focused: true, base64 };
      }
      case 'url-encode': {
        if (!trimmed) return { id: 'url-encode', focused: true };
        const urlEncode = processUrl(trimmed, 'encode');
        return { id: 'url-encode', focused: true, urlEncode };
      }
      case 'hash': {
        if (!trimmed) return { id: 'hash', focused: true };
        const hash = createHashResult(trimmed);
        return { id: 'hash', focused: true, hash };
      }
      case 'regex': {
        if (!trimmed) return { id: 'regex', focused: true };
        const regex = testRegex(trimmed, '');
        return { id: 'regex', focused: true, regex };
      }
      case 'graph': {
        if (!trimmed) return { id: 'graph', focused: true };
        const graph = detectGraph(trimmed);
        return { id: 'graph', focused: true, graph: graph || undefined };
      }
      case 'snippets': {
        return { id: 'snippets', focused: true, snippets: createSnippetResult() };
      }
      case 'quick-note': {
        if (!trimmed) return { id: 'quick-note', focused: true };
        return { id: 'quick-note', focused: true, quickNote: { content: trimmed } };
      }
      case 'quick-event': {
        if (!trimmed) return { id: 'quick-event', focused: true };
        const event = detectQuickEvent(`/event ${trimmed}`);
        return { id: 'quick-event', focused: true, quickEvent: event || undefined };
      }
      case 'web-viewer': {
        if (!trimmed) return { id: 'web-viewer', focused: true };
        // Very basic parsing for focused mode (default to google search if not url)
        const isUrl = trimmed.match(/^(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})(?:\/.*)?$/i);
        const finalUrl = isUrl
          ? (trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
          : `https://www.google.com/search?q=${encodeURIComponent(trimmed)}&igu=1`;
        return { id: 'web-viewer', focused: true, webViewer: { url: finalUrl, query: isUrl ? undefined : trimmed } };
      }
      case 'help': {
        return { id: 'help', focused: true };
      }
    }
    return null;
  }, []);

  const analyze = useCallback((input: string) => {
    setState(prev => {
      // Focused mode: only detect for the focused module
      if (prev.mode === 'module' && prev.module?.focused) {
        isFocusedRef.current = true;
        const moduleId = prev.module.id;
        // Don't re-detect if timer is running
        if (moduleId === 'timer' && prev.module.timer?.isRunning) return prev;
        const result = focusedDetect(moduleId, input);
        return result ? { ...prev, module: result } : { ...prev, module: { id: moduleId, focused: true } };
      }

      isFocusedRef.current = false;
      const trimmed = input.trim();
      if (!trimmed) return INITIAL_STATE;

      // "/" command palette
      if (trimmed.startsWith('/')) {
        // 1. Intercept explicit slash commands (Quick Note, Quick Event, Web Viewer)
        const note = detectQuickNote(trimmed);
        if (note) return { mode: 'module' as const, module: { id: 'quick-note', focused: false, quickNote: note }, commands: [], commandQuery: '', selectedIndex: 0 };

        const event = detectQuickEvent(trimmed);
        if (event) return { mode: 'module' as const, module: { id: 'quick-event', focused: false, quickEvent: event }, commands: [], commandQuery: '', selectedIndex: 0 };

        const web = detectWebViewer(trimmed);
        if (web) return { mode: 'module' as const, module: { id: 'web-viewer', focused: false, webViewer: web }, commands: [], commandQuery: '', selectedIndex: 0 };

        // 2. Normal "/" command palette search
        const query = trimmed.slice(1);
        const commands = searchCommands(query);
        return { mode: 'commands' as const, module: null, commands, commandQuery: query, selectedIndex: 0 };
      }

      // Auto-detect
      const detected = autoDetect(trimmed);
      if (detected) {
        return { mode: 'module' as const, module: detected, commands: [], commandQuery: '', selectedIndex: 0 };
      }

      return INITIAL_STATE;
    });

    // Async resolution — skip in focused mode (focused detect handles its own state)
    if (isFocusedRef.current) return;

    // Async currency resolution (for auto-detect)
    const trimmed = input.trim();
    if (trimmed && !trimmed.startsWith('/')) {
      const currency = detectCurrency(trimmed);
      if (currency && !currency.isPartial) {
        const gen = ++currencyGenRef.current;
        resolveCurrency(currency).then(resolved => {
          if (currencyGenRef.current !== gen) return;
          setState(prev => {
            if (prev.module?.id !== 'currency') return prev;
            return { ...prev, module: { ...prev.module, currency: resolved } };
          });
        });
      }

      // Async translation resolution
      const translation = detectTranslation(trimmed);
      if (translation && !translation.isPartial) {
        const gen = ++translatorGenRef.current;
        resolveTranslation(translation).then(resolved => {
          if (translatorGenRef.current !== gen) return;
          setState(prev => {
            if (prev.module?.id !== 'translator') return prev;
            return { ...prev, module: { ...prev.module, translator: resolved } };
          });
        });
      }

      // Async dictionary resolution
      const dictionary = detectDictionary(trimmed);
      if (dictionary) {
        const gen = ++dictionaryGenRef.current;
        resolveDictionary(dictionary).then(resolved => {
          if (dictionaryGenRef.current !== gen) return;
          setState(prev => {
            if (prev.module?.id !== 'dictionary') return prev;
            return { ...prev, module: { ...prev.module, dictionary: resolved } };
          });
        });
      }
    }
  }, [autoDetect, focusedDetect]);

  const focusOnModule = useCallback((handler: string) => {
    const moduleId = HANDLER_TO_MODULE[handler];
    if (!moduleId) return false;
    setState({
      mode: 'module',
      module: { id: moduleId, focused: true },
      commands: [],
      commandQuery: '',
      selectedIndex: 0,
    });
    return true;
  }, []);

  // Timer controls
  const startTimer = useCallback(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    setState(prev => {
      if (prev.module?.id !== 'timer' || !prev.module.timer) return prev;
      return { ...prev, module: { ...prev.module, timer: { ...prev.module.timer, isRunning: true } } };
    });

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setState(prev => {
        if (!prev.module?.timer?.isRunning) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          return prev;
        }
        const newTimer = tickTimer(prev.module.timer);
        if (newTimer.isComplete) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('TimeMachine Timer', { body: `${prev.module.timer.label} timer complete!` });
          }
        }
        return { ...prev, module: { ...prev.module, timer: newTimer } };
      });
    }, 1000);
  }, []);

  const toggleTimer = useCallback(() => {
    setState(prev => {
      if (!prev.module?.timer) return prev;
      if (prev.module.timer.isRunning) {
        if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
        return { ...prev, module: { ...prev.module, timer: { ...prev.module.timer, isRunning: false } } };
      }
      // Resume
      timerIntervalRef.current = setInterval(() => {
        setState(p => {
          if (!p.module?.timer?.isRunning) { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); return p; }
          const nt = tickTimer(p.module.timer);
          if (nt.isComplete && timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          return { ...p, module: { ...p.module, timer: nt } };
        });
      }, 1000);
      return { ...prev, module: { ...prev.module, timer: { ...prev.module.timer, isRunning: true } } };
    });
  }, []);

  const resetTimer = useCallback(() => {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    setState(prev => {
      if (!prev.module?.timer) return prev;
      return {
        ...prev,
        module: {
          ...prev.module,
          timer: { ...prev.module.timer, remainingSeconds: prev.module.timer.totalSeconds, isRunning: false, isComplete: false, display: formatDuration(prev.module.timer.totalSeconds), progress: 1 },
        },
      };
    });
  }, []);

  const setTimerDuration = useCallback((seconds: number) => {
    if (seconds <= 0) return;
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    setState(prev => {
      if (prev.mode !== 'module' || prev.module?.id !== 'timer') return prev;
      return {
        ...prev,
        module: {
          ...prev.module,
          timer: {
            totalSeconds: seconds,
            remainingSeconds: seconds,
            isRunning: false,
            isComplete: false,
            label: formatDurationLabel(seconds),
            display: formatDuration(seconds),
            progress: 1,
          },
        },
      };
    });
  }, []);

  const selectUp = useCallback(() => {
    setState(prev => {
      if (prev.mode !== 'commands' || prev.commands.length === 0) return prev;
      return { ...prev, selectedIndex: prev.selectedIndex <= 0 ? prev.commands.length - 1 : prev.selectedIndex - 1 };
    });
  }, []);

  const selectDown = useCallback(() => {
    setState(prev => {
      if (prev.mode !== 'commands' || prev.commands.length === 0) return prev;
      return { ...prev, selectedIndex: prev.selectedIndex >= prev.commands.length - 1 ? 0 : prev.selectedIndex + 1 };
    });
  }, []);

  const selectedCommand = useMemo(() => {
    if (state.mode !== 'commands' || state.commands.length === 0) return null;
    // Flatten in the same grouped-by-category order that ContourPanel renders,
    // so the keyboard selectedIndex matches the visually highlighted command.
    const flat = groupByCategory(state.commands).flatMap(g => g.commands);
    return flat[state.selectedIndex] || null;
  }, [state.mode, state.commands, state.selectedIndex]);

  const dismiss = useCallback(() => {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    setState(INITIAL_STATE);
  }, []);

  const isVisible = state.mode !== 'hidden';
  const isFocused = state.mode === 'module' && state.module?.focused === true;

  return {
    state,
    isVisible,
    isFocused,
    analyze,
    focusOnModule,
    selectUp,
    selectDown,
    selectedCommand,
    dismiss,
    startTimer,
    toggleTimer,
    resetTimer,
    setTimerDuration,
  };
}
