import React, { useMemo } from 'react';
import { ArrowLeft, FileText, PanelLeftClose, Plus, Search, Star, StarOff, Trash2 } from 'lucide-react';
import TimeMachineMark from '../icons/TimeMachineMark';
import type { Note } from './notesState';

/* The library rail: Notion's left sidebar, on TimeMachine's material. A
   search field, an "Ask" card, then the pages in Favorites, Recents and
   Private, and one way to make a new one at the foot. Rows are a select
   button with the star and delete as siblings, never nested, so every
   control is its own tab stop. */

export interface NoteSidebarProps {
  notes: Note[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onToggleStar: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  /** Opens the AI panel. Optional so the rail can render without one. */
  onAskAI?: () => void;
  onBack?: () => void;
  onCollapse?: () => void;
}

const SEARCHABLE = new Set(['text', 'heading1', 'heading2', 'heading3', 'bullet-list', 'numbered-list', 'todo', 'quote', 'code', 'callout']);

function matches(note: Note, q: string) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return note.title.toLowerCase().includes(needle)
    || note.blocks.some((b) => SEARCHABLE.has(b.type) && b.content.toLowerCase().includes(needle));
}

export function NoteSidebar({
  notes, activeId, onSelect, onNew, onDelete, onToggleStar, searchQuery, onSearchChange, onAskAI, onBack, onCollapse,
}: NoteSidebarProps) {
  const filtered = useMemo(() => notes.filter((n) => matches(n, searchQuery)), [notes, searchQuery]);
  const favorites = filtered.filter((n) => n.starred);
  const recents = useMemo(
    () => [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
    [filtered],
  );
  const searching = searchQuery.trim().length > 0;

  const row = (note: Note, keyPrefix: string) => {
    const name = note.title || 'New page';
    const active = activeId === note.id;
    return (
      <div key={`${keyPrefix}-${note.id}`} className="tm-notes-row group relative flex items-center" data-active={active ? 'true' : 'false'}>
        <button
          type="button"
          onClick={() => onSelect(note.id)}
          aria-current={active ? 'page' : undefined}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-[10px] py-1.5 pl-2 pr-16 text-left text-[14px]"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[15px] leading-none" aria-hidden="true">
            {note.emoji || <FileText className="h-4 w-4" />}
          </span>
          <span className="truncate">{name}</span>
        </button>
        <div className="tm-notes-row-actions absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">
          <button
            type="button"
            onClick={() => onToggleStar(note.id)}
            aria-label={note.starred ? `Unstar ${name}` : `Star ${name}`}
            className="tm-notes-icon !h-7 !w-7"
          >
            {note.starred ? <Star className="h-3.5 w-3.5 fill-current" style={{ color: 'rgb(250 204 21)' }} /> : <StarOff className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => onDelete(note.id)}
            aria-label={`Delete ${name}`}
            className="tm-notes-icon !h-7 !w-7 hover:!text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Wordmark row */}
      <div className="flex items-center gap-1 px-2 pt-2.5">
        {onBack && (
          <button type="button" onClick={onBack} aria-label="Back to chat" className="tm-notes-icon">
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <span className="flex min-w-0 flex-1 items-baseline gap-1.5 px-1">
          <span
            className="truncate text-[15px] font-bold tracking-tight text-purple-400"
            style={{ fontFamily: 'Montserrat, var(--font-display)', textShadow: '0 0 20px rgb(168 85 247 / 0.5)' }}
          >
            TimeMachine
          </span>
          <span className="text-[13px] font-medium" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.55)' }}>Notes</span>
        </span>
        {onCollapse && (
          <button type="button" onClick={onCollapse} aria-label="Hide sidebar" className="tm-notes-icon">
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <label className="tm-notes-search flex items-center gap-2 rounded-[10px] px-2.5">
          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.45)' }} aria-hidden="true" />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search"
            aria-label="Search notes"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-[14px] outline-hidden"
            style={{ color: 'rgb(var(--tm-ink-rgb) / 0.92)' }}
          />
        </label>
      </div>

      {/* Ask: Notion's "Take quick notes" card, for the co-pilot. */}
      {onAskAI && (
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={onAskAI}
            className="tm-press tm-glass-pill flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left"
            style={{ border: '1px solid rgb(var(--tm-ink-rgb) / 0.1)' }}
          >
            <TimeMachineMark className="h-9 w-9 shrink-0" />
            <span className="min-w-0">
              <span className="block text-[14px] font-medium" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.92)' }}>Ask TimeMachine</span>
              <span className="block text-[12px]" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.5)' }}>Draft, summarize, or fix</span>
            </span>
          </button>
        </div>
      )}

      {/* Pages */}
      <nav className="tm-notes-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2" aria-label="Notes">
        {searching ? (
          <>
            <p className="tm-notes-section">Results</p>
            {filtered.map((n) => row(n, 'r'))}
          </>
        ) : (
          <>
            {favorites.length > 0 && (
              <>
                <p className="tm-notes-section">Favorites</p>
                {favorites.map((n) => row(n, 'f'))}
              </>
            )}
            {recents.length > 0 && (
              <>
                <p className="tm-notes-section">Recents</p>
                {recents.map((n) => row(n, 'c'))}
              </>
            )}
            {filtered.length > 0 && (
              <>
                <p className="tm-notes-section">Private</p>
                {filtered.map((n) => row(n, 'p'))}
              </>
            )}
          </>
        )}
        {filtered.length === 0 && (
          <div className="px-3 py-10 text-center">
            <FileText className="mx-auto mb-2 h-6 w-6" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.3)' }} aria-hidden="true" />
            <p className="text-[13px]" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.5)' }}>
              {searching ? 'Nothing matches that.' : 'No notes yet.'}
            </p>
          </div>
        )}
      </nav>

      {/* New */}
      <div className="p-3" style={{ borderTop: '1px solid rgb(var(--tm-ink-rgb) / 0.06)' }}>
        <button
          type="button"
          onClick={onNew}
          className="tm-press tm-glass-pill flex w-full items-center justify-center gap-2 rounded-full px-3 py-2.5 text-[14px] font-medium"
          style={{ border: '1px solid rgb(var(--tm-ink-rgb) / 0.12)', color: 'rgb(var(--tm-ink-rgb) / 0.9)' }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> New note
        </button>
      </div>
    </div>
  );
}
