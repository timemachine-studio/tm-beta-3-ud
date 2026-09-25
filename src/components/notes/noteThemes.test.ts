import { describe, expect, it } from 'vitest';
import { effectiveNoteTheme } from './noteThemes';
import type { Note } from './notesState';

const note = { noteTheme: 'pink' as const } as Note;

describe('effectiveNoteTheme', () => {
  it('keeps an existing note color until the first global theme change', () => {
    expect(effectiveNoteTheme(note, 0, 'autumnDark')).toBe('pink');
  });

  it('recolors a note on a global theme change without destroying its saved color', () => {
    expect(effectiveNoteTheme(note, 1, 'verdureDark')).toBe('green');
    expect(note.noteTheme).toBe('pink');
  });

  it('allows a new manual note choice until the following global change', () => {
    const overridden = { ...note, noteTheme: 'orange' as const, noteThemeRevision: 2 };
    expect(effectiveNoteTheme(overridden, 2, 'verdureDark')).toBe('orange');
    expect(effectiveNoteTheme(overridden, 3, 'blossomDark')).toBe('pink');
  });

  it('uses a neutral note palette for Pure', () => {
    expect(effectiveNoteTheme(null, 0, 'pureDark')).toBe('slate');
  });
});
