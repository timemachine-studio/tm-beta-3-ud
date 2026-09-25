import type { Block, Note, NoteTheme } from './notesState';
import type { SeasonTheme } from '../../themes/themeState';
import { healthcarePalette, seasonPalettes } from '../../themes/seasonPalette';

/* The surfaces every Notes module shares: the note hues, the icon set, the
   pane material for popovers, ids and storage. */

export const glassCard = {
  background: 'var(--tm-tool-pane)',
  backdropFilter: 'blur(28px) saturate(160%)',
  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
  border: '1px solid var(--tm-tool-border)',
  boxShadow: 'var(--tm-tool-shadow)',
} as const;

export const uid = () => Math.random().toString(36).slice(2, 10);

export const emptyBlock = (): Block => ({ id: uid(), type: 'text', content: '' });

const STORAGE_KEY = 'tm-notes';

export const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: 'Smileys', emojis: ['😀', '😂', '🥹', '😍', '🤩', '😎', '🥳', '🤔', '😴', '🫠', '🤗', '😇'] },
  { label: 'Objects', emojis: ['📝', '📒', '📕', '📗', '📘', '📙', '📓', '📔', '📖', '🗒️', '📋', '📎'] },
  { label: 'Symbols', emojis: ['⭐', '🔥', '💡', '❤️', '🎯', '🚀', '✨', '💎', '🏆', '🎨', '🎵', '⚡'] },
  { label: 'Nature', emojis: ['🌸', '🌻', '🍀', '🌈', '🌙', '☀️', '🌊', '🍁', '🌺', '🦋', '🐝', '🌿'] },
  { label: 'Food', emojis: ['☕', '🍕', '🍩', '🧁', '🍎', '🍓', '🫐', '🍰', '🍪', '🧋', '🥑', '🍫'] },
  { label: 'Travel', emojis: ['🏠', '🏖️', '⛰️', '🗺️', '✈️', '🚗', '🛸', '🎡', '🏕️', '🌃', '🗼', '🎢'] },
];

export interface NoteThemeConfig {
  key: NoteTheme;
  label: string;
  dot: string;
  // rgba base for dynamic opacity usage
  rgb: string;
  secondaryRgb: string;
  // block accents
  checkBg: string;
  checkBorder: string;
  quoteBorder: string;
  calloutBg: string;
  calloutBorder: string;
  // editor area
  editorGradient: string;
  editorGlow: string;
  // text accent for active type in context menu
  textAccent: string;
}

export const NOTE_THEMES: NoteThemeConfig[] = [
  {
    key: 'slate', label: 'Slate', dot: 'bg-slate-300', rgb: '203, 213, 225',
    secondaryRgb: '148, 163, 184', checkBg: 'bg-slate-400', checkBorder: 'border-slate-300',
    quoteBorder: 'border-slate-300/50', calloutBg: 'bg-slate-400/10', calloutBorder: 'border-slate-400/20',
    editorGradient: 'linear-gradient(180deg, rgba(203,213,225,0.06), transparent 45%)',
    editorGlow: '0 0 80px rgba(203,213,225,0.08)', textAccent: 'text-slate-300',
  },
  // Purple — from Default/Air persona: rgba(168, 85, 247)
  {
    key: 'purple', label: 'Purple', dot: 'bg-purple-500', rgb: '168, 85, 247',
    secondaryRgb: '99, 102, 241',
    checkBg: 'bg-purple-500', checkBorder: 'border-purple-400',
    quoteBorder: 'border-purple-400/50', calloutBg: 'bg-purple-500/10', calloutBorder: 'border-purple-500/20',
    editorGradient: 'linear-gradient(180deg, rgba(168,85,247,0.06) 0%, rgba(168,85,247,0.02) 40%, transparent 100%)',
    editorGlow: '0 0 80px rgba(168,85,247,0.08)',
    textAccent: 'text-purple-400',
  },
  // Pink — from Girlie persona: rgba(236, 72, 153)
  {
    key: 'pink', label: 'Pink', dot: 'bg-pink-500', rgb: '236, 72, 153',
    secondaryRgb: '168, 85, 247',
    checkBg: 'bg-pink-500', checkBorder: 'border-pink-400',
    quoteBorder: 'border-pink-400/50', calloutBg: 'bg-pink-500/10', calloutBorder: 'border-pink-500/20',
    editorGradient: 'linear-gradient(180deg, rgba(236,72,153,0.06) 0%, rgba(236,72,153,0.02) 40%, transparent 100%)',
    editorGlow: '0 0 80px rgba(236,72,153,0.08)',
    textAccent: 'text-pink-400',
  },
  // Cyan — from Pro persona: rgba(34, 211, 238)
  {
    key: 'cyan', label: 'Cyan', dot: 'bg-cyan-400', rgb: '34, 211, 238',
    secondaryRgb: '59, 130, 246',
    checkBg: 'bg-cyan-500', checkBorder: 'border-cyan-400',
    quoteBorder: 'border-cyan-400/50', calloutBg: 'bg-cyan-500/10', calloutBorder: 'border-cyan-500/20',
    editorGradient: 'linear-gradient(180deg, rgba(34,211,238,0.06) 0%, rgba(34,211,238,0.02) 40%, transparent 100%)',
    editorGlow: '0 0 80px rgba(34,211,238,0.08)',
    textAccent: 'text-cyan-400',
  },
  // Blue
  {
    key: 'blue', label: 'Blue', dot: 'bg-blue-500', rgb: '59, 130, 246',
    secondaryRgb: '34, 211, 238',
    checkBg: 'bg-blue-500', checkBorder: 'border-blue-400',
    quoteBorder: 'border-blue-400/50', calloutBg: 'bg-blue-500/10', calloutBorder: 'border-blue-500/20',
    editorGradient: 'linear-gradient(180deg, rgba(59,130,246,0.06) 0%, rgba(59,130,246,0.02) 40%, transparent 100%)',
    editorGlow: '0 0 80px rgba(59,130,246,0.08)',
    textAccent: 'text-blue-400',
  },
  // Green
  {
    key: 'green', label: 'Green', dot: 'bg-green-500', rgb: '34, 197, 94',
    secondaryRgb: '20, 184, 166',
    checkBg: 'bg-green-500', checkBorder: 'border-green-400',
    quoteBorder: 'border-green-400/50', calloutBg: 'bg-green-500/10', calloutBorder: 'border-green-500/20',
    editorGradient: 'linear-gradient(180deg, rgba(34,197,94,0.06) 0%, rgba(34,197,94,0.02) 40%, transparent 100%)',
    editorGlow: '0 0 80px rgba(34,197,94,0.08)',
    textAccent: 'text-green-400',
  },
  // Orange
  {
    key: 'orange', label: 'Orange', dot: 'bg-orange-500', rgb: '249, 115, 22',
    secondaryRgb: '234, 179, 8',
    checkBg: 'bg-orange-500', checkBorder: 'border-orange-400',
    quoteBorder: 'border-orange-400/50', calloutBg: 'bg-orange-500/10', calloutBorder: 'border-orange-500/20',
    editorGradient: 'linear-gradient(180deg, rgba(249,115,22,0.06) 0%, rgba(249,115,22,0.02) 40%, transparent 100%)',
    editorGlow: '0 0 80px rgba(249,115,22,0.08)',
    textAccent: 'text-orange-400',
  },
  // Red
  {
    key: 'red', label: 'Red', dot: 'bg-red-500', rgb: '239, 68, 68',
    secondaryRgb: '236, 72, 153',
    checkBg: 'bg-red-500', checkBorder: 'border-red-400',
    quoteBorder: 'border-red-400/50', calloutBg: 'bg-red-500/10', calloutBorder: 'border-red-500/20',
    editorGradient: 'linear-gradient(180deg, rgba(239,68,68,0.06) 0%, rgba(239,68,68,0.02) 40%, transparent 100%)',
    editorGlow: '0 0 80px rgba(239,68,68,0.08)',
    textAccent: 'text-red-400',
  },
  // Yellow
  {
    key: 'yellow', label: 'Yellow', dot: 'bg-yellow-500', rgb: '234, 179, 8',
    secondaryRgb: '249, 115, 22',
    checkBg: 'bg-yellow-500', checkBorder: 'border-yellow-400',
    quoteBorder: 'border-yellow-400/50', calloutBg: 'bg-yellow-500/10', calloutBorder: 'border-yellow-500/20',
    editorGradient: 'linear-gradient(180deg, rgba(234,179,8,0.06) 0%, rgba(234,179,8,0.02) 40%, transparent 100%)',
    editorGlow: '0 0 80px rgba(234,179,8,0.08)',
    textAccent: 'text-yellow-400',
  },
];

export function getNoteTheme(key?: NoteTheme) {
  return NOTE_THEMES.find((t) => t.key === key) || NOTE_THEMES[0];
}

export function effectiveNoteTheme(note: Note | null | undefined, revision: number, season: SeasonTheme, healthcare = false): NoteTheme {
  if (note?.noteTheme && (note.noteThemeRevision === revision || (revision === 0 && note.noteThemeRevision === undefined))) {
    return note.noteTheme;
  }
  return healthcare ? healthcarePalette.note : seasonPalettes[season].note;
}

// ─── persistence ────────────────────────────────────────────────────

export function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveNotes(notes: Note[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}
