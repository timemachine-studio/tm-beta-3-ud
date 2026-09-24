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

/**
 * Block types the Notes AI co-pilot may create or convert to. Text-shaped
 * only: the media and structured blocks (`doodle`, `image`, `graph`,
 * `table`) carry payloads the editor interprets, and letting model output
 * choose those types with arbitrary content is how a prompt-injected note
 * reached the graph evaluator (pre-launch-audit.md A.3).
 */
export const AI_WRITABLE_BLOCK_TYPES: ReadonlySet<BlockType> = new Set<BlockType>([
  'text', 'heading1', 'heading2', 'heading3', 'bullet-list', 'numbered-list',
  'todo', 'quote', 'code', 'divider', 'callout',
]);

export function aiBlockType(candidate: unknown): BlockType | undefined {
  return typeof candidate === 'string' && AI_WRITABLE_BLOCK_TYPES.has(candidate as BlockType)
    ? (candidate as BlockType)
    : undefined;
}

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
  /** Monotonic object revision for agent receipts and conflict-safe edits. */
  version?: number;
  /** Earlier conversations used to prepare this note. */
  sourceChatIds?: string[];
  /** Stable user-turn id that makes a retried create idempotent. */
  agentRunId?: string;
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
