export type BlockType =
  | 'text'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bullet-list'
  | 'numbered-list'
  | 'todo'
  | 'quote'
  | 'code'
  | 'divider'
  | 'callout'
  | 'doodle'
  | 'image'
  | 'graph'
  | 'table';

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  width?: number;
  height?: number;
}

export type NoteTheme = 'purple' | 'blue' | 'green' | 'pink' | 'orange' | 'red' | 'cyan' | 'yellow';

export interface Note {
  id: string;
  title: string;
  blocks: Block[];
  createdAt: string;
  updatedAt: string;
  starred: boolean;
  emoji?: string;
  noteTheme?: NoteTheme;
}

export interface InitialNotesState {
  notes: Note[];
  activeNoteId: string;
  focusedBlockIndex: number | null;
}

export function createInitialNotesState(
  storedNotes: Note[],
  draft: string | null,
  now: string,
  createId: () => string,
): InitialNotesState {
  if (storedNotes.length > 0) {
    const active = storedNotes[0];
    const notes = draft
      ? storedNotes.map((note, index) => index === 0
        ? {
            ...note,
            updatedAt: now,
            blocks: [
              { id: createId(), type: 'text' as const, content: draft },
              ...note.blocks.filter(block => block.content),
            ],
          }
        : note)
      : storedNotes;
    return { notes, activeNoteId: active.id, focusedBlockIndex: draft ? 0 : null };
  }

  const noteId = createId();
  const blockId = createId();
  const note: Note = {
    id: noteId,
    title: '',
    blocks: [{ id: blockId, type: 'text', content: draft ?? '' }],
    createdAt: now,
    updatedAt: now,
    starred: false,
    emoji: '📝',
  };
  return { notes: [note], activeNoteId: noteId, focusedBlockIndex: 0 };
}
