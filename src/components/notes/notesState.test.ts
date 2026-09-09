import { describe, expect, it } from 'vitest';
import { createInitialNotesState, type Note } from './notesState';

const storedNote: Note = {
  id: 'note-1',
  title: 'Stored',
  blocks: [{ id: 'block-1', type: 'text', content: 'existing' }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  starred: false,
};

describe('createInitialNotesState', () => {
  it('selects the first stored note without changing it', () => {
    const state = createInitialNotesState([storedNote], null, 'now', () => 'unused');
    expect(state).toEqual({ notes: [storedNote], activeNoteId: 'note-1', focusedBlockIndex: null });
  });

  it('consumes a navigation draft into the selected note once', () => {
    const state = createInitialNotesState([storedNote], 'draft text', 'now', () => 'draft-block');
    expect(state.notes[0].blocks[0]).toEqual({ id: 'draft-block', type: 'text', content: 'draft text' });
    expect(state.notes[0].blocks[1]).toEqual(storedNote.blocks[0]);
    expect(state.activeNoteId).toBe('note-1');
  });

  it('creates exactly one note when storage is empty', () => {
    const ids = ['new-note', 'new-block'];
    const state = createInitialNotesState([], 'draft text', 'now', () => ids.shift()!);
    expect(state.notes).toHaveLength(1);
    expect(state.notes[0]).toMatchObject({ id: 'new-note', blocks: [{ id: 'new-block', content: 'draft text' }] });
    expect(state.activeNoteId).toBe('new-note');
  });
});
