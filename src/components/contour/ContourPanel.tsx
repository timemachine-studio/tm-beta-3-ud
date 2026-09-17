/**
 * TimeMachine Contour - Main Panel Component
 *
 * A glassmorphic spotlight overlay above the chat textbox.
 * Shows "TimeMachine Contour" branding top-left.
 * Supports: command palette, auto-detected results, and focused tool mode.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, X } from 'lucide-react';
import { ContourState, ModuleData } from './moduleRegistry';
import { MODULE_META } from './moduleRegistry';
import { ContourCommand, CATEGORY_INFO, groupByCategory } from './modules/commands';
import {
  CalculatorView, UnitsView, CurrencyView, TimezoneView,
  ColorView, DateView, TimerView, RandomView, WordCountView,
  TranslatorView, DictionaryView, LoremView, JsonFormatView,
  Base64View, UrlEncodeView, HashView, RegexView, HelpView,
  GraphView, FileConvertView,
  getIcon,
} from './views';
import { SnippetsView } from './views/SnippetsView';
import { NavigationView } from './views/NavigationView';
import { QuickNoteView } from './views/QuickNoteView';
import { QuickEventView } from './views/QuickEventView';
import { WebViewerView } from './views/WebViewerView';
import { useNavigate } from 'react-router-dom';

// ─── Types ─────────────────────────────────────────────────────

interface ContourPanelProps {
  state: ContourState;
  isVisible: boolean;
  onCommandSelect: (command: ContourCommand) => void;
  selectedIndex: number;
  persona?: string;
  onTimerStart?: () => void;
  onTimerToggle?: () => void;
  onTimerReset?: () => void;
  onSetTimerDuration?: (seconds: number) => void;
  onCopyValue?: (value: string) => void;
  onBack?: () => void;
}

interface AccentTheme {
  bg: string;
  border: string;
  glow: string;
  text: string;
  solid: string;
}

const personaAccent: Record<string, AccentTheme> = {
  default: {
    bg: 'rgba(168, 85, 247, 0.08)',
    border: 'rgba(168, 85, 247, 0.25)',
    glow: '0 0 40px rgba(168, 85, 247, 0.15)',
    text: 'text-purple-400',
    solid: '#a855f7',
  },
  girlie: {
    bg: 'rgba(236, 72, 153, 0.08)',
    border: 'rgba(236, 72, 153, 0.25)',
    glow: '0 0 40px rgba(236, 72, 153, 0.15)',
    text: 'text-pink-400',
    solid: '#ec4899',
  },
  pro: {
    bg: 'rgba(34, 211, 238, 0.08)',
    border: 'rgba(34, 211, 238, 0.25)',
    glow: '0 0 40px rgba(34, 211, 238, 0.15)',
    text: 'text-cyan-400',
    solid: '#22d3ee',
  },
};

// ─── Module View Router ────────────────────────────────────────

function ModuleContent({
  module, accent, onCopyValue, onTimerStart, onTimerToggle, onTimerReset, onSetTimerDuration,
}: {
  module: ModuleData;
  accent: AccentTheme;
  onCopyValue?: (value: string) => void;
  onTimerStart?: () => void;
  onTimerToggle?: () => void;
  onTimerReset?: () => void;
  onSetTimerDuration?: (seconds: number) => void;
}) {
  const navigate = useNavigate();

  switch (module.id) {
    case 'graph':
      return <GraphView module={module} accent={accent} />;
    case 'calculator':
      return <CalculatorView module={module} accent={accent} />;
    case 'units':
      return <UnitsView module={module} accent={accent} onCopyValue={onCopyValue} />;
    case 'currency':
      return <CurrencyView module={module} accent={accent} onCopyValue={onCopyValue} />;
    case 'timezone':
      return <TimezoneView module={module} accent={accent} onCopyValue={onCopyValue} />;
    case 'color':
      return <ColorView module={module} accent={accent} onCopyValue={onCopyValue} />;
    case 'date':
      return <DateView module={module} accent={accent} onCopyValue={onCopyValue} />;
    case 'timer':
      return (
        <TimerView module={module} accent={accent}
          onStart={onTimerStart} onToggle={onTimerToggle} onReset={onTimerReset}
          onSetDuration={onSetTimerDuration}
        />
      );
    case 'random':
      return <RandomView module={module} accent={accent} onCopyValue={onCopyValue} />;
    case 'wordcount':
      return <WordCountView module={module} accent={accent} />;
    case 'translator':
      return <TranslatorView module={module} accent={accent} onCopyValue={onCopyValue} />;
    case 'dictionary':
      return <DictionaryView module={module} accent={accent} onCopyValue={onCopyValue} />;
    case 'lorem':
      return <LoremView module={module} accent={accent} onCopyValue={onCopyValue} />;
    case 'json-format':
      return <JsonFormatView module={module} accent={accent} onCopyValue={onCopyValue} />;
    case 'base64':
      return <Base64View module={module} accent={accent} onCopyValue={onCopyValue} />;
    case 'url-encode':
      return <UrlEncodeView module={module} accent={accent} onCopyValue={onCopyValue} />;
    case 'hash':
      return <HashView module={module} accent={accent} onCopyValue={onCopyValue} />;
    case 'regex':
      return <RegexView module={module} accent={accent} onCopyValue={onCopyValue} />;
    case 'snippets':
      return <SnippetsView module={module} accent={accent} onCopyValue={onCopyValue} />;
    case 'navigation':
      return <NavigationView module={module} accent={accent} onNavigate={(path) => { navigate(path); }} />;
    case 'quick-note':
      return <QuickNoteView module={module} accent={accent} />;
    case 'quick-event':
      return <QuickEventView module={module} accent={accent} />;
    case 'web-viewer':
      return <WebViewerView module={module} accent={accent} />;
    case 'file-convert':
      return <FileConvertView module={module} accent={accent} />;
    case 'help':
      return <HelpView module={module} accent={accent} />;
    default:
      return null;
  }
}

// ─── Main Panel ────────────────────────────────────────────────

export function ContourPanel({
  state, isVisible, onCommandSelect, selectedIndex, persona = 'default',
  onTimerStart, onTimerToggle, onTimerReset, onSetTimerDuration, onCopyValue, onBack,
}: ContourPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);
  const [showTouchControls, setShowTouchControls] = useState(false);
  const accent = personaAccent[persona] || personaAccent.default;

  useEffect(() => {
    const coarsePointer = window.matchMedia('(pointer: coarse)');
    const updateTouchControls = () => {
      setShowTouchControls(coarsePointer.matches || navigator.maxTouchPoints > 0 || window.innerWidth < 768);
    };

    updateTouchControls();
    coarsePointer.addEventListener?.('change', updateTouchControls);
    window.addEventListener('resize', updateTouchControls);

    return () => {
      coarsePointer.removeEventListener?.('change', updateTouchControls);
      window.removeEventListener('resize', updateTouchControls);
    };
  }, []);

  useEffect(() => {
    if (selectedItemRef.current && scrollContainerRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  let flatIndex = 0;
  const getFlatIndex = () => flatIndex++;

  const isFocused = state.mode === 'module' && state.module?.focused;
  const moduleMeta = state.module ? MODULE_META[state.module.id] : null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="tm-workspace tm-contour absolute bottom-full left-0 right-0 mb-4 z-50"
        >
          <div
            className="tm-glass tm-surface rounded-[28px] overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-3 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid rgb(var(--tm-ink-rgb) / 0.06)' }}>
              <div className="flex items-center gap-2">
                {isFocused && moduleMeta && (
                  <>
                    <div className="w-2 h-2 rounded-full" style={{ background: accent.solid, boxShadow: `0 0 6px ${accent.border}` }} />
                    <span className="text-sm font-medium text-ink">
                      Contour
                    </span>
                    <span className="text-ink-muted text-xs">/</span>
                    <span className={`text-xs font-medium ${accent.text}`}>
                      {moduleMeta.label}
                    </span>
                  </>
                )}
                {!isFocused && (
                  <>
                    <div className="w-2 h-2 rounded-full" style={{ background: accent.border.replace('0.25', '0.8'), boxShadow: `0 0 6px ${accent.border}` }} />
                    <span className="text-sm font-medium text-ink">
                      TimeMachine Contour
                    </span>
                  </>
                )}
              </div>
              {state.mode === 'commands' && (
                <span className="text-xs text-ink-muted font-mono">
                  {state.commands.length} command{state.commands.length !== 1 ? 's' : ''}
                </span>
              )}
              <button type="button" onClick={onBack} aria-label="Close Contour" className="tm-glass-pill flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div
              ref={scrollContainerRef}
              className="tm-contour-scroll [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full"
            >
              {/* Module views */}
              {state.mode === 'module' && state.module && (
                <ModuleContent
                  module={state.module}
                  accent={accent}
                  onCopyValue={onCopyValue}
                  onTimerStart={onTimerStart}
                  onTimerToggle={onTimerToggle}
                  onTimerReset={onTimerReset}
                  onSetTimerDuration={onSetTimerDuration}
                />
              )}

              {/* Commands Mode */}
              {state.mode === 'commands' && (
                <div className="py-1.5">
                  {state.commands.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <Search className="w-8 h-8 text-ink-muted mx-auto mb-2" />
                      <p className="text-ink-muted text-sm">No commands found</p>
                      <p className="text-ink-muted text-xs mt-1">Try a different search term</p>
                    </div>
                  ) : (
                    groupByCategory(state.commands).map(({ category, commands }) => (
                      <div key={category}>
                        <div className="px-4 py-1.5">
                          <span className="text-sm font-medium text-ink">
                            {CATEGORY_INFO[category]?.label || category}
                          </span>
                        </div>
                        {commands.map((cmd) => {
                          const idx = getFlatIndex();
                          const isSelected = idx === selectedIndex;
                          const IconComponent = getIcon(cmd.icon);

                          return (
                            <button
                              key={cmd.id}
                              ref={isSelected ? selectedItemRef : null}
                              onClick={() => onCommandSelect(cmd)}
                              className="w-full px-3 py-0.5 flex items-center text-left transition-colors duration-100"
                            >
                              <div
                                className="flex items-center gap-3 w-full px-2 py-2 rounded-xl transition-colors duration-100"
                                style={{
                                  background: isSelected ? accent.bg : 'transparent',
                                  border: isSelected ? `1px solid ${accent.border}` : '1px solid transparent',
                                }}
                              >
                                <div className="p-1.5 rounded-lg shrink-0" style={{ background: isSelected ? accent.border.replace('0.25', '0.15') : 'rgb(var(--tm-ink-rgb) / 0.04)' }}>
                                  <IconComponent className={`w-4 h-4 ${isSelected ? accent.text : 'text-ink-muted'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-ink'}`}>{cmd.name}</div>
                                  <div className={`text-xs leading-relaxed ${isSelected ? 'text-ink-muted' : 'text-ink-muted'}`}>{cmd.description}</div>
                                </div>
                                {isSelected && (
                                  <div className="shrink-0 text-xs text-ink-muted font-mono">↵</div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {state.mode === 'commands' && state.commands.length > 0 && (
              <div className="px-4 py-2 flex items-center justify-between" style={{ borderTop: '1px solid rgb(var(--tm-ink-rgb) / 0.06)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-muted flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded-sm bg-white/5 border border-white/10 text-ink-muted">↑↓</kbd> navigate
                  </span>
                  <span className="text-xs text-ink-muted flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded-sm bg-white/5 border border-white/10 text-ink-muted">↵</kbd> open
                  </span>
                  <span className="text-xs text-ink-muted flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded-sm bg-white/5 border border-white/10 text-ink-muted">esc</kbd> dismiss
                  </span>
                </div>
              </div>
            )}
            {isFocused && (
              <div className="px-4 py-2 flex items-center" style={{ borderTop: '1px solid rgb(var(--tm-ink-rgb) / 0.06)' }}>
                {showTouchControls ? (
                  <button
                    type="button"
                    onClick={onBack}
                    className="min-h-11 px-3 -my-1 -ml-1 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors touch-manipulation active:bg-white/10"
                    style={{ color: accent.solid, background: accent.bg, border: `1px solid ${accent.border}` }}
                    aria-label="Back from Contour tool"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                ) : (
                  <span className="text-xs text-ink-muted flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded-sm bg-white/5 border border-white/10 text-ink-muted">esc</kbd> back
                  </span>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
