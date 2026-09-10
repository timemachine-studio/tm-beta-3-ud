import { beforeEach, describe, expect, it } from 'vitest';
import {
  NotesStorageError,
  blocksToMarkdown,
  createNote,
  editNote,
  markdownToBlocks,
  readNote,
  readNotes,
  searchNotes,
  writeNotes,
} from './notesRepository';
import type { Note } from '../../components/notes/notesState';

function installStorage(overrides: Partial<Storage> = {}) {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
    ...overrides,
  } as Storage;
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  return store;
}

const note = (id: string, title: string, text: string, updatedAt: string): Note => ({
  id,
  title,
  blocks: [{ id: `${id}-b`, type: 'text', content: text }],
  createdAt: updatedAt,
  updatedAt,
  starred: false,
});

describe('markdown ⇄ blocks', () => {
  it('maps every block type the editor can round-trip', () => {
    // Blank lines separate blocks — except inside a fence, where they are
    // part of the code, so the fence is written as consecutive lines.
    const markdown = [
      '# Title',
      '## Sub',
      '### Smaller',
      'Plain paragraph.',
      '- bullet one',
      '1. numbered one',
      '- [ ] open task',
      '- [x] done task',
      '> a quotation',
      '```\nconst x = 1;\n```',
      '---',
    ].join('\n\n');

    const blocks = markdownToBlocks(markdown);
    expect(blocks.map(block => block.type)).toEqual([
      'heading1', 'heading2', 'heading3', 'text', 'bullet-list', 'numbered-list',
      'todo', 'todo', 'quote', 'code', 'divider',
    ]);
    expect(blocks[6].checked).toBe(false);
    expect(blocks[7].checked).toBe(true);
    expect(blocks[9].content).toBe('const x = 1;');

    // Round trip: what comes back out parses to the same blocks again.
    expect(markdownToBlocks(blocksToMarkdown(blocks)).map(b => ({ type: b.type, content: b.content })))
      .toEqual(blocks.map(b => ({ type: b.type, content: b.content })));
  });

  it('numbers list items in sequence and restarts after other blocks', () => {
    const blocks = markdownToBlocks('1. one\n\n2. two\n\n# Break\n\n1. again');
    expect(blocksToMarkdown(blocks)).toBe('1. one\n\n2. two\n\n# Break\n\n1. again');
  });

  it('names binary blocks instead of inlining their data', () => {
    const markdown = blocksToMarkdown([
      { id: 'a', type: 'doodle', content: 'data:image/png;base64,AAAAAAAA' },
      { id: 'b', type: 'image', content: 'data:image/png;base64,BBBBBBBB' },
    ]);
    expect(markdown).toBe('[drawing]\n\n[image]');
    expect(markdown).not.toContain('base64');
  });

  it('keeps the contents of an unterminated code fence', () => {
    const blocks = markdownToBlocks('```js\nnever closed');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'code', content: 'never closed' });
  });
});

describe('note operations', () => {
  beforeEach(() => { installStorage(); });

  it('creates a note at the front of the list and reads it back as markdown', () => {
    writeNotes([note('old', 'Older', 'older body', '2026-01-01T00:00:00.000Z')]);
    const summary = createNote('Assignment', '# Jobs and Musk\n\n- point one');

    const stored = readNotes();
    expect(stored[0].id).toBe(summary.id);
    expect(stored[1].id).toBe('old');
    expect(readNote(summary.id)?.markdown).toBe('# Jobs and Musk\n\n- point one');
  });

  it('edits in place rather than adding a second note', () => {
    const created = createNote('Draft', 'first version');
    const updated = editNote(created.id, { markdown: 'second version', mode: 'replace' });

    expect(updated?.id).toBe(created.id);
    expect(readNotes()).toHaveLength(1);
    expect(readNote(created.id)?.markdown).toBe('second version');
  });

  it('appends and prepends without losing existing blocks', () => {
    const created = createNote('Draft', 'middle');
    editNote(created.id, { markdown: 'tail', mode: 'append' });
    editNote(created.id, { markdown: 'head', mode: 'prepend' });
    expect(readNote(created.id)?.markdown).toBe('head\n\nmiddle\n\ntail');
  });

  it('leaves the title alone when the edit passes an empty one', () => {
    const created = createNote('Keep me', 'body');
    const updated = editNote(created.id, { title: '', markdown: 'new body', mode: 'replace' });
    expect(updated?.title).toBe('Keep me');
  });

  it('reports a missing note instead of creating one', () => {
    expect(editNote('nope', { markdown: 'x' })).toBeNull();
    expect(readNote('nope')).toBeNull();
    expect(readNotes()).toHaveLength(0);
  });

  it('ranks title matches above body matches and lists recents for an empty query', () => {
    writeNotes([
      note('a', 'Shopping', 'nothing relevant', '2026-03-01T00:00:00.000Z'),
      note('b', 'Physics revision', 'kinematics', '2026-02-01T00:00:00.000Z'),
      note('c', 'Diary', 'today I studied physics', '2026-01-01T00:00:00.000Z'),
    ]);

    expect(searchNotes('physics', 10).map(hit => hit.id)).toEqual(['b', 'c']);
    // Empty query is a listing, newest first.
    expect(searchNotes('', 2).map(hit => hit.id)).toEqual(['a', 'b']);
  });

  it('surfaces a full-storage failure instead of swallowing it', () => {
    installStorage({
      setItem: () => { throw new DOMException('full', 'QuotaExceededError'); },
    });
    // Notes have no cloud copy: a silent failure here loses the note for good.
    expect(() => createNote('Doomed', 'body')).toThrow(NotesStorageError);
  });
});
