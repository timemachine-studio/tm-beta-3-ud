import type { Block, BlockType, Note } from '../../components/notes/notesState';

/**
 * Read/write access to TM Notes for code outside NotesPage.
 *
 * NotesPage owns the editor; this owns the store. The AI reaches notes through
 * here (see src/services/agent/deviceToolRunner.ts), which is why the file
 * exists at all — the model runs on a server that cannot see `localStorage`.
 *
 * Notes are blocks, and the model speaks Markdown, so the translation between
 * the two lives here too. It is deliberately lossy in one direction only:
 * binary-ish blocks (doodles, inline image data) come out as a short marker
 * rather than a megabyte of base64 in the prompt.
 */

const STORAGE_KEY = 'tm-notes';

const uid = () => Math.random().toString(36).slice(2, 10);

export class NotesStorageError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'NotesStorageError';
  }
}

export function readNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Note[]) : [];
  } catch (error) {
    throw new NotesStorageError('Your notes could not be read from this device.', error);
  }
}

/**
 * Notes have no cloud copy, so a failed write is unrecoverable and must never
 * be swallowed (CLAUDE.md, storage direction). The caller turns this into
 * something the user actually sees.
 */
export function writeNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (error) {
    const quotaExceeded = error instanceof DOMException
      && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    throw new NotesStorageError(
      quotaExceeded
        ? 'There is no room left in this device\'s storage, so the note was not saved.'
        : 'The note could not be saved to this device.',
      error,
    );
  }
}

// ─── Markdown ⇄ blocks ──────────────────────────────────────────────────────

const HEADING_PREFIXES: Array<[string, BlockType]> = [
  ['### ', 'heading3'],
  ['## ', 'heading2'],
  ['# ', 'heading1'],
];

export function markdownToBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');

  let fence: { language: string; lines: string[] } | null = null;

  for (const line of lines) {
    const fenceMatch = line.match(/^```(.*)$/);
    if (fenceMatch) {
      if (fence) {
        blocks.push({ id: uid(), type: 'code', content: fence.lines.join('\n') });
        fence = null;
      } else {
        fence = { language: fenceMatch[1].trim(), lines: [] };
      }
      continue;
    }
    if (fence) {
      fence.lines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ id: uid(), type: 'divider', content: '' });
      continue;
    }

    const heading = HEADING_PREFIXES.find(([prefix]) => trimmed.startsWith(prefix));
    if (heading) {
      blocks.push({ id: uid(), type: heading[1], content: trimmed.slice(heading[0].length).trim() });
      continue;
    }

    const todo = trimmed.match(/^[-*+]\s+\[([ xX])\]\s+(.*)$/);
    if (todo) {
      blocks.push({ id: uid(), type: 'todo', content: todo[2].trim(), checked: todo[1].toLowerCase() === 'x' });
      continue;
    }

    const bullet = trimmed.match(/^[-*+]\s+(.*)$/);
    if (bullet) {
      blocks.push({ id: uid(), type: 'bullet-list', content: bullet[1].trim() });
      continue;
    }

    const numbered = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      blocks.push({ id: uid(), type: 'numbered-list', content: numbered[1].trim() });
      continue;
    }

    const quote = trimmed.match(/^>\s?(.*)$/);
    if (quote) {
      blocks.push({ id: uid(), type: 'quote', content: quote[1].trim() });
      continue;
    }

    blocks.push({ id: uid(), type: 'text', content: trimmed });
  }

  // An unterminated fence is still content the user asked to be saved.
  if (fence) blocks.push({ id: uid(), type: 'code', content: fence.lines.join('\n') });

  return blocks.length > 0 ? blocks : [{ id: uid(), type: 'text', content: '' }];
}

export function blocksToMarkdown(blocks: Block[]): string {
  let itemNumber = 0;
  const lines = blocks.map((block) => {
    if (block.type !== 'numbered-list') itemNumber = 0;
    switch (block.type) {
      case 'heading1': return `# ${block.content}`;
      case 'heading2': return `## ${block.content}`;
      case 'heading3': return `### ${block.content}`;
      case 'bullet-list': return `- ${block.content}`;
      case 'numbered-list': return `${++itemNumber}. ${block.content}`;
      case 'todo': return `- [${block.checked ? 'x' : ' '}] ${block.content}`;
      case 'quote': return `> ${block.content}`;
      case 'callout': return `> ${block.content}`;
      case 'code': return '```\n' + block.content + '\n```';
      case 'divider': return '---';
      // Drawings and pasted images are stored as data URLs. Naming them is
      // useful context; inlining them would be megabytes of base64 in a prompt.
      case 'doodle': return '[drawing]';
      case 'image': return block.content.startsWith('data:') ? '[image]' : `![image](${block.content})`;
      case 'graph': return '[graph]';
      case 'table': return block.content;
      default: return block.content;
    }
  });
  return lines.join('\n\n').trim();
}

// ─── Operations ─────────────────────────────────────────────────────────────

export interface NoteSummary {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  excerpt: string;
}

function untitled(note: Note): string {
  return note.title?.trim() || 'Untitled note';
}

export function summarize(note: Note, excerptLength = 180): NoteSummary {
  const body = blocksToMarkdown(note.blocks || []).replace(/\s+/g, ' ').trim();
  return {
    id: note.id,
    title: untitled(note),
    updatedAt: note.updatedAt,
    createdAt: note.createdAt,
    excerpt: body.length > excerptLength ? `${body.slice(0, excerptLength)}…` : body,
  };
}

export function searchNotes(query: string, limit: number): NoteSummary[] {
  const notes = readNotes();
  const byRecency = [...notes].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return byRecency.slice(0, limit).map(note => summarize(note));

  const scored = byRecency
    .map((note) => {
      const title = untitled(note).toLowerCase();
      const body = blocksToMarkdown(note.blocks || []).toLowerCase();
      // Title hits weigh more: a note called "Physics revision" is the answer
      // to "physics" even when another note mentions the word in passing.
      const score = terms.reduce((total, term) => {
        if (title.includes(term)) return total + 3;
        if (body.includes(term)) return total + 1;
        return total;
      }, 0);
      return { note, score };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(entry => summarize(entry.note));
}

export function readNote(noteId: string): { note: Note; markdown: string } | null {
  const note = readNotes().find(candidate => candidate.id === noteId);
  if (!note) return null;
  return { note, markdown: blocksToMarkdown(note.blocks || []) };
}

export function createNote(title: string, markdown: string): NoteSummary {
  const notes = readNotes();
  const now = new Date().toISOString();
  const note: Note = {
    id: uid(),
    title: title.trim(),
    blocks: markdownToBlocks(markdown),
    createdAt: now,
    updatedAt: now,
    starred: false,
    emoji: '📝',
  };
  // Newest first, matching what NotesPage shows in the sidebar.
  writeNotes([note, ...notes]);
  return summarize(note);
}

export type NoteEditMode = 'replace' | 'append' | 'prepend';

export function editNote(
  noteId: string,
  changes: { title?: string; markdown?: string; mode?: NoteEditMode },
): NoteSummary | null {
  const notes = readNotes();
  const index = notes.findIndex(candidate => candidate.id === noteId);
  if (index === -1) return null;

  const existing = notes[index];
  const mode = changes.mode ?? 'replace';
  const incoming = changes.markdown ?? '';

  let blocks = existing.blocks || [];
  if (changes.markdown !== undefined) {
    const added = markdownToBlocks(incoming);
    if (mode === 'replace') blocks = added;
    else if (mode === 'append') blocks = [...blocks, ...added];
    else blocks = [...added, ...blocks];
  }

  const updated: Note = {
    ...existing,
    title: changes.title?.trim() ? changes.title.trim() : existing.title,
    blocks,
    updatedAt: new Date().toISOString(),
  };

  const next = [...notes];
  next[index] = updated;
  writeNotes(next);
  return summarize(updated);
}
