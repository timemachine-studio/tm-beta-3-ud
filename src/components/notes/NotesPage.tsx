import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  Copy,
  ImagePlus,
  ListChecks,
  Lock,
  MoreHorizontal,
  Palette,
  PanelLeftOpen,
  PanelRightOpen,
  Pencil,
  Plus,
  Star,
  Table2,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import TimeMachineMark from '../icons/TimeMachineMark';
import { useTheme } from '../../context/ThemeContext';
import { sendNotesAIRequest, type NotesAIModel } from '../../services/ai/notesAiService';
import { aiBlockType, createInitialNotesState, type Block, type BlockType, type Note } from './notesState';
import { DraggableBlock, type PendingAIEdit, type PendingNewBlock } from './NoteBlocks';
import { NoteSidebar } from './NoteSidebar';
import { NotesAiPanel, type AiTurn } from './NotesAiPanel';
import { NotesComposer } from './NotesComposer';
import { EMPTY_ATTACHMENTS, describeAttachments, toPayload, type PendingAttachments } from './notesAttachments';
import { EMOJI_CATEGORIES, NOTE_THEMES, emptyBlock, getNoteTheme, loadNotes, saveNotes, uid } from './noteThemes';

export { NoteSidebar } from './NoteSidebar';

// ─── helpers ────────────────────────────────────────────────────────

/** "Edited just now", "Edited 4m ago", "Edited Sep 12". */
function editedLabel(iso: string, now: number) {
  const then = new Date(iso).getTime();
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 45) return 'Edited just now';
  if (s < 3600) return `Edited ${Math.round(s / 60)}m ago`;
  if (s < 86400) return `Edited ${Math.round(s / 3600)}h ago`;
  return `Edited ${new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

/** A page with nothing on it yet: no title and a single empty text block. */
function isBlankPage(note: Note) {
  return !note.title.trim() && note.blocks.length === 1 && note.blocks[0].type === 'text' && !note.blocks[0].content;
}

const STARTERS: { label: string; icon: React.ComponentType<{ className?: string }>; type?: BlockType; ai?: boolean }[] = [
  { label: 'Ask AI', icon: TimeMachineMark, ai: true },
  { label: 'To-do list', icon: ListChecks, type: 'todo' },
  { label: 'Table', icon: Table2, type: 'table' },
  { label: 'Graph', icon: TrendingUp, type: 'graph' },
  { label: 'Doodle', icon: Pencil, type: 'doodle' },
  { label: 'Image', icon: ImagePlus, type: 'image' },
];

/** A glass menu hanging from a chrome button. Closes on Escape and outside click. */
function ChromeMenu({ open, onClose, anchorRef, align = 'right', children, label }: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  align?: 'left' | 'right';
  children: React.ReactNode;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, onClose, anchorRef]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="menu"
          aria-label={label}
          initial={{ opacity: 0, y: -6, scale: 0.98, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -4, scale: 0.98, filter: 'blur(6px)' }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className={`tm-glass tm-notes-menu absolute top-full z-50 mt-2 ${align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── page ───────────────────────────────────────────────────────────

export function NotesPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [initialState] = useState(() =>
    createInitialNotesState(
      loadNotes(),
      localStorage.getItem('tm-notes-draft'),
      new Date().toISOString(),
      uid,
    ),
  );
  // The draft is a one-shot handoff from the home composer. Read in the
  // initializer, cleared after commit; both are idempotent, so a discarded
  // StrictMode/Suspense render cannot lose it.
  useEffect(() => { localStorage.removeItem('tm-notes-draft'); }, []);

  // ?note=<id> targets one note — how "Open in Notes" on a chat card lands on
  // the note the assistant just wrote rather than on whatever is newest.
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedNoteId = searchParams.get('note');
  const [notes, setNotes] = useState<Note[]>(initialState.notes);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(() =>
    requestedNoteId && initialState.notes.some((note) => note.id === requestedNoteId)
      ? requestedNoteId
      : initialState.activeNoteId,
  );
  useEffect(() => {
    if (!requestedNoteId) return;
    setSearchParams((params) => { params.delete('note'); return params; }, { replace: true });
  }, [requestedNoteId, setSearchParams]);

  const [searchQuery, setSearchQuery] = useState('');
  const [focusedBlockIndex, setFocusedBlockIndex] = useState<number | null>(initialState.focusedBlockIndex);
  const wide = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const [showSidebar, setShowSidebar] = useState(wide >= 768);
  const [aiOpen, setAiOpen] = useState(wide >= 1280);
  const [aiFocusSignal, setAiFocusSignal] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const themeButtonRef = useRef<HTMLButtonElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const activeNote = useMemo(() => notes.find((n) => n.id === activeNoteId) || null, [notes, activeNoteId]);
  const activeTheme = getNoteTheme(activeNote?.noteTheme);
  const hue = activeTheme.rgb.replace(/,/g, ' ');

  // "Edited …" ticks once a minute so it never lies for long.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handle = (e: PointerEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) setShowEmojiPicker(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowEmojiPicker(false); };
    document.addEventListener('pointerdown', handle);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', handle);
      document.removeEventListener('keydown', onKey);
    };
  }, [showEmojiPicker]);

  useEffect(() => { saveNotes(notes); }, [notes]);

  const openAi = useCallback(() => {
    setAiOpen(true);
    setAiFocusSignal((n) => n + 1);
  }, []);

  // ─── notes ────────────────────────────────────────────────────────

  const handleNewNote = useCallback(() => {
    const stamp = new Date().toISOString();
    const note: Note = { id: uid(), title: '', blocks: [emptyBlock()], createdAt: stamp, updatedAt: stamp, starred: false, emoji: '📝' };
    setNotes((prev) => [note, ...prev]);
    setActiveNoteId(note.id);
    setFocusedBlockIndex(0);
    if (window.innerWidth < 768) setShowSidebar(false);
  }, []);

  const updateNote = useCallback((id: string, updater: (note: Note) => Note) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...updater(n), updatedAt: new Date().toISOString() } : n)));
  }, []);

  const handleDeleteNote = useCallback((id: string) => {
    setNotes((prev) => {
      const filtered = prev.filter((n) => n.id !== id);
      if (activeNoteId === id) setActiveNoteId(filtered[0]?.id || null);
      return filtered;
    });
  }, [activeNoteId]);

  const handleDuplicateNote = useCallback((id: string) => {
    setNotes((prev) => {
      const source = prev.find((n) => n.id === id);
      if (!source) return prev;
      const stamp = new Date().toISOString();
      const copy: Note = {
        ...source,
        id: uid(),
        title: source.title ? `${source.title} (copy)` : '',
        blocks: source.blocks.map((b) => ({ ...b, id: uid() })),
        createdAt: stamp,
        updatedAt: stamp,
        starred: false,
      };
      setActiveNoteId(copy.id);
      return [copy, ...prev];
    });
  }, []);

  const handleToggleStar = useCallback((id: string) => {
    updateNote(id, (n) => ({ ...n, starred: !n.starred }));
  }, [updateNote]);

  // ─── blocks ───────────────────────────────────────────────────────

  const updateBlock = useCallback((blockId: string, updates: Partial<Block>) => {
    if (!activeNoteId) return;
    updateNote(activeNoteId, (n) => ({ ...n, blocks: n.blocks.map((b) => (b.id === blockId ? { ...b, ...updates } : b)) }));
  }, [activeNoteId, updateNote]);

  const insertBlockAfter = useCallback((afterIndex: number, type: BlockType = 'text') => {
    if (!activeNoteId) return;
    const newBlock: Block = { id: uid(), type, content: '' };
    updateNote(activeNoteId, (n) => {
      const blocks = [...n.blocks];
      blocks.splice(afterIndex + 1, 0, newBlock);
      return { ...n, blocks };
    });
    setFocusedBlockIndex(afterIndex + 1);
  }, [activeNoteId, updateNote]);

  const deleteBlock = useCallback((index: number) => {
    if (!activeNoteId || !activeNote || activeNote.blocks.length <= 1) return;
    updateNote(activeNoteId, (n) => ({ ...n, blocks: n.blocks.filter((_, i) => i !== index) }));
    setFocusedBlockIndex(Math.max(0, index - 1));
  }, [activeNoteId, activeNote, updateNote]);

  const duplicateBlock = useCallback((index: number) => {
    if (!activeNoteId || !activeNote) return;
    const copy: Block = { ...activeNote.blocks[index], id: uid() };
    updateNote(activeNoteId, (n) => {
      const blocks = [...n.blocks];
      blocks.splice(index + 1, 0, copy);
      return { ...n, blocks };
    });
  }, [activeNoteId, activeNote, updateNote]);

  const reorderBlocks = useCallback((newBlocks: Block[]) => {
    if (!activeNoteId) return;
    updateNote(activeNoteId, (n) => ({ ...n, blocks: newBlocks }));
  }, [activeNoteId, updateNote]);

  const handleBlockKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    const block = activeNote?.blocks[index];
    if (e.key === ' ' && block && block.type === 'text' && block.content === '') {
      // Notion's "press space for AI": an empty line hands off to the co-pilot.
      e.preventDefault();
      openAi();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      insertBlockAfter(index);
    } else if (e.key === 'Backspace' && block?.content === '') {
      e.preventDefault();
      deleteBlock(index);
    } else if (e.key === 'ArrowUp' && index > 0) {
      const textarea = e.target as HTMLTextAreaElement;
      if (textarea.selectionStart === 0) { e.preventDefault(); setFocusedBlockIndex(index - 1); }
    } else if (e.key === 'ArrowDown' && activeNote && index < activeNote.blocks.length - 1) {
      const textarea = e.target as HTMLTextAreaElement;
      if (textarea.selectionStart === textarea.value.length) { e.preventDefault(); setFocusedBlockIndex(index + 1); }
    }
  }, [activeNote, insertBlockAfter, deleteBlock, openAi]);

  /** "Get started with": turn the blank page's one block into that kind. */
  const startWith = useCallback((type: BlockType) => {
    if (!activeNote) return;
    updateBlock(activeNote.blocks[0].id, { type, content: '' });
    setFocusedBlockIndex(0);
  }, [activeNote, updateBlock]);

  // ─── AI co-pilot ──────────────────────────────────────────────────

  const [aiLoading, setAiLoading] = useState(false);
  const [transcript, setTranscript] = useState<AiTurn[]>([]);
  // Which mind edits. Remembered per device, like the chat's persona.
  const [aiModel, setAiModel] = useState<NotesAIModel>(() =>
    localStorage.getItem('tm-notes-ai-model') === 'pro' ? 'pro' : 'air',
  );
  useEffect(() => { localStorage.setItem('tm-notes-ai-model', aiModel); }, [aiModel]);
  const [pendingEdits, setPendingEdits] = useState<PendingAIEdit[]>([]);
  const [pendingNewBlocks, setPendingNewBlocks] = useState<PendingNewBlock[]>([]);

  const handleAISend = useCallback(async (instruction: string, attachments: PendingAttachments = EMPTY_ATTACHMENTS) => {
    if (!activeNoteId || !activeNote || aiLoading) return;
    setAiLoading(true);
    const meta = describeAttachments(attachments);
    setTranscript((t) => [...t, { id: uid(), role: 'user', text: instruction, ...(meta ? { meta } : {}) }]);

    // Doodle and image blocks hold data URLs; the model never sees them.
    const blockContexts = activeNote.blocks
      .filter((b) => b.type !== 'doodle' && b.type !== 'image')
      .map((b, i) => ({ index: i, id: b.id, type: b.type, content: b.content, checked: b.checked }));

    try {
      const response = await sendNotesAIRequest(activeNote.title, blockContexts, instruction, {
        model: aiModel,
        attachments: toPayload(attachments),
      });
      if (response.error) {
        setTranscript((t) => [...t, { id: uid(), role: 'ai', text: response.error as string }]);
        return;
      }

      const newPendingEdits: PendingAIEdit[] = [];
      for (const edit of response.edits) {
        const existing = activeNote.blocks.find((b) => b.id === edit.blockId);
        if (!existing) continue;
        const newType = aiBlockType(edit.newType);
        newPendingEdits.push({
          blockId: edit.blockId,
          originalContent: existing.content,
          originalType: existing.type,
          newContent: edit.newContent,
          newType,
        });
        // Applied now, reverted on reject. The type is validated: model output
        // may not turn a block into a graph, table, image or doodle.
        updateBlock(edit.blockId, { content: edit.newContent, ...(newType ? { type: newType } : {}) });
      }

      const newPending: PendingNewBlock[] = [];
      if (response.newBlocks && response.newBlocks.length > 0) {
        const toInsert: { newBlock: Block; pending: PendingNewBlock }[] = [];
        for (const nb of response.newBlocks) {
          const tempId = uid();
          const blockType = aiBlockType(nb.type) ?? 'text';
          const pending: PendingNewBlock = { tempId, afterBlockId: nb.afterBlockId, type: blockType, content: nb.content };
          toInsert.push({ newBlock: { id: tempId, type: blockType, content: nb.content }, pending });
          newPending.push(pending);
        }
        // One state update so sequential inserts after the same block keep
        // their order.
        updateNote(activeNoteId, (n) => {
          const blocks = [...n.blocks];
          const insertionTargets: Record<string, string> = {};
          for (const item of toInsert) {
            const originalTarget = item.pending.afterBlockId;
            const targetId = insertionTargets[originalTarget] || originalTarget;
            if (targetId === 'START') {
              blocks.unshift(item.newBlock);
            } else {
              const afterIdx = blocks.findIndex((b) => b.id === targetId);
              if (afterIdx >= 0) blocks.splice(afterIdx + 1, 0, item.newBlock);
              else blocks.push(item.newBlock);
            }
            insertionTargets[originalTarget] = item.newBlock.id;
          }
          return { ...n, blocks };
        });
      }

      setPendingEdits(newPendingEdits);
      setPendingNewBlocks(newPending);
      setTranscript((t) => [...t, { id: uid(), role: 'ai', text: response.message }]);
    } catch (err: unknown) {
      setTranscript((t) => [...t, { id: uid(), role: 'ai', text: (err instanceof Error ? err.message : String(err)) || 'That request failed. Try again.' }]);
    } finally {
      setAiLoading(false);
    }
  }, [activeNoteId, activeNote, aiLoading, aiModel, updateBlock, updateNote]);

  const handleAcceptEdit = useCallback((blockId: string) => {
    setPendingEdits((prev) => prev.filter((e) => e.blockId !== blockId));
    setPendingNewBlocks((prev) => prev.filter((e) => e.tempId !== blockId));
  }, []);

  const handleRejectEdit = useCallback((blockId: string) => {
    const edit = pendingEdits.find((e) => e.blockId === blockId);
    if (edit) {
      updateBlock(edit.blockId, { content: edit.originalContent, type: edit.originalType });
      setPendingEdits((prev) => prev.filter((e) => e.blockId !== blockId));
      return;
    }
    const added = pendingNewBlocks.find((e) => e.tempId === blockId);
    if (added && activeNoteId) {
      updateNote(activeNoteId, (n) => ({ ...n, blocks: n.blocks.filter((b) => b.id !== blockId) }));
      setPendingNewBlocks((prev) => prev.filter((e) => e.tempId !== blockId));
    }
  }, [pendingEdits, pendingNewBlocks, updateBlock, updateNote, activeNoteId]);

  const handleAcceptAll = useCallback(() => {
    setPendingEdits([]);
    setPendingNewBlocks([]);
  }, []);

  const handleRejectAll = useCallback(() => {
    for (const edit of pendingEdits) updateBlock(edit.blockId, { content: edit.originalContent, type: edit.originalType });
    if (activeNoteId) {
      const ids = new Set(pendingNewBlocks.map((nb) => nb.tempId));
      if (ids.size > 0) updateNote(activeNoteId, (n) => ({ ...n, blocks: n.blocks.filter((b) => !ids.has(b.id)) }));
    }
    setPendingEdits([]);
    setPendingNewBlocks([]);
  }, [pendingEdits, pendingNewBlocks, updateBlock, updateNote, activeNoteId]);

  // A new chat forgets the conversation, not the unreviewed changes.
  const handleNewChat = useCallback(() => setTranscript([]), []);

  const pendingCount = pendingEdits.length + pendingNewBlocks.length;
  const blank = activeNote ? isBlankPage(activeNote) : false;

  const sidebar = (
    <NoteSidebar
      notes={notes}
      activeId={activeNoteId}
      onSelect={(id) => { setActiveNoteId(id); if (window.innerWidth < 768) setShowSidebar(false); }}
      onNew={handleNewNote}
      onDelete={handleDeleteNote}
      onToggleStar={handleToggleStar}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onAskAI={() => { openAi(); if (window.innerWidth < 768) setShowSidebar(false); }}
      onBack={() => navigate('/')}
      onCollapse={() => setShowSidebar(false)}
    />
  );

  return (
    <div
      className={`tm-notes fixed inset-0 overflow-hidden ${theme.text}`}
      style={{
        '--tm-notes-hue': hue,
        '--tm-atmo-rgb': hue,
      } as React.CSSProperties}
    >
      {/* The weather, in the note's hue. */}
      <div className="tm-atmosphere" aria-hidden="true">
        <div className="tm-orb tm-orb-a left-[-12%] bottom-[-24%] h-[60vmax] w-[60vmax]" style={{ background: `rgb(${hue} / 0.22)` }} />
        <div className="tm-orb tm-orb-b right-[-10%] bottom-[-16%] h-[46vmax] w-[46vmax]" style={{ background: `rgb(${activeTheme.secondaryRgb.replace(/,/g, ' ')} / 0.12)` }} />
      </div>

      <div className="relative z-[1] flex h-full">
        {/* Rail: inline on desktop, a slide-over on phones. */}
        <AnimatePresence initial={false}>
          {showSidebar && (
            <>
              <motion.div
                key="scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowSidebar(false)}
                className="fixed inset-0 z-30 md:hidden"
                style={{ background: 'rgb(var(--tm-paper-rgb) / 0.5)' }}
                aria-hidden="true"
              />
              <motion.aside
                key="rail"
                initial={{ width: 0, x: -24, opacity: 0 }}
                animate={{ width: 264, x: 0, opacity: 1 }}
                exit={{ width: 0, x: -24, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="tm-notes-rail h-full shrink-0 overflow-hidden"
                aria-label="Library"
              >
                <div className="h-full w-[264px]">{sidebar}</div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* The page */}
        <section className="relative flex min-w-0 flex-1 flex-col">
          <header className="tm-notes-topbar flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              {!showSidebar && (
                <>
                  <button type="button" onClick={() => navigate('/')} aria-label="Back to chat" className="tm-notes-icon">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setShowSidebar(true)} aria-label="Show sidebar" className="tm-notes-icon">
                    <PanelLeftOpen className="h-4 w-4" />
                  </button>
                </>
              )}
              {activeNote && (
                <span className="flex min-w-0 items-center gap-2 px-1.5">
                  <span className="tm-notes-crumb flex min-w-0 items-center gap-1.5">
                    {activeNote.emoji && <span aria-hidden="true">{activeNote.emoji}</span>}
                    <span className="truncate">{activeNote.title || 'New page'}</span>
                  </span>
                  <span className="tm-notes-crumb-muted hidden items-center gap-1 sm:flex">
                    <Lock className="h-3 w-3" aria-hidden="true" /> Private
                  </span>
                </span>
              )}
            </div>

            {activeNote && (
              <div className="flex shrink-0 items-center gap-0.5">
                <span className="tm-notes-crumb-muted mr-2 hidden md:inline">{editedLabel(activeNote.updatedAt, now)}</span>
                <button
                  type="button"
                  onClick={() => handleToggleStar(activeNote.id)}
                  aria-pressed={activeNote.starred}
                  aria-label={activeNote.starred ? 'Remove from favorites' : 'Add to favorites'}
                  className="tm-notes-icon"
                >
                  <Star className="h-4 w-4" style={activeNote.starred ? { color: 'rgb(250 204 21)', fill: 'currentColor' } : undefined} />
                </button>

                <span className="relative">
                  <button
                    ref={themeButtonRef}
                    type="button"
                    onClick={() => { setShowThemeMenu((o) => !o); setShowMoreMenu(false); }}
                    aria-haspopup="menu"
                    aria-expanded={showThemeMenu}
                    aria-label="Note colour"
                    className="tm-notes-icon"
                  >
                    <Palette className="h-4 w-4" />
                  </button>
                  <ChromeMenu open={showThemeMenu} onClose={() => setShowThemeMenu(false)} anchorRef={themeButtonRef} label="Note colour">
                    <p className="px-3 pb-1 pt-1.5 text-[12px] font-medium" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.45)' }}>Colour</p>
                    <div className="grid w-[15rem] grid-cols-2 gap-0.5">
                      {NOTE_THEMES.map((t) => {
                        const on = (activeNote.noteTheme || 'purple') === t.key;
                        return (
                          <button
                            key={t.key}
                            type="button"
                            role="menuitemradio"
                            aria-checked={on}
                            onClick={() => { updateNote(activeNote.id, (n) => ({ ...n, noteTheme: t.key })); setShowThemeMenu(false); }}
                            className="tm-menu-row flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px]"
                            style={{ color: on ? 'rgb(var(--tm-ink-rgb) / 0.95)' : 'rgb(var(--tm-ink-rgb) / 0.72)' }}
                          >
                            <span className="h-3 w-3 rounded-full" style={{ background: `rgb(${t.rgb})`, boxShadow: on ? `0 0 10px rgb(${t.rgb} / 0.7)` : undefined }} aria-hidden="true" />
                            {t.label}
                            {on && <Check className="ml-auto h-3.5 w-3.5" aria-hidden="true" />}
                          </button>
                        );
                      })}
                    </div>
                  </ChromeMenu>
                </span>

                <button
                  type="button"
                  onClick={() => (aiOpen ? setAiOpen(false) : openAi())}
                  aria-pressed={aiOpen}
                  data-lit={aiOpen ? 'true' : 'false'}
                  aria-label={aiOpen ? 'Hide AI panel' : 'Ask AI'}
                  title="Ask AI"
                  className="tm-notes-icon"
                >
                  <PanelRightOpen className="h-4 w-4" />
                </button>

                <span className="relative">
                  <button
                    ref={moreButtonRef}
                    type="button"
                    onClick={() => { setShowMoreMenu((o) => !o); setShowThemeMenu(false); }}
                    aria-haspopup="menu"
                    aria-expanded={showMoreMenu}
                    aria-label="More"
                    className="tm-notes-icon"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  <ChromeMenu open={showMoreMenu} onClose={() => setShowMoreMenu(false)} anchorRef={moreButtonRef} label="Page">
                    <div className="w-[13rem]">
                      <button type="button" role="menuitem" onClick={() => { handleDuplicateNote(activeNote.id); setShowMoreMenu(false); }} className="tm-menu-row flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[14px]" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.88)' }}>
                        <Copy className="h-4 w-4" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.55)' }} aria-hidden="true" /> Duplicate
                      </button>
                      <button type="button" role="menuitem" onClick={() => { handleDeleteNote(activeNote.id); setShowMoreMenu(false); }} className="tm-menu-row flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[14px]" style={{ color: 'rgb(252 165 165)' }}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
                      </button>
                    </div>
                  </ChromeMenu>
                </span>
              </div>
            )}
          </header>

          {activeNote ? (
            <div className="tm-notes-scroll min-h-0 flex-1 overflow-y-auto">
              <div className="tm-notes-column">
                {/* Icon */}
                <div className="relative inline-block" ref={emojiPickerRef}>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((o) => !o)}
                    aria-haspopup="dialog"
                    aria-expanded={showEmojiPicker}
                    aria-label="Change icon"
                    className="tm-notes-emoji -ml-2 px-2 py-1"
                  >
                    {activeNote.emoji || '📝'}
                  </button>
                  <AnimatePresence>
                    {showEmojiPicker && (
                      <motion.div
                        role="dialog"
                        aria-label="Choose an icon"
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.98 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className="tm-glass tm-notes-scroll absolute left-0 top-full z-50 mt-2 max-h-[340px] w-[min(320px,calc(100vw-48px))] overflow-y-auto rounded-3xl p-3"
                      >
                        {EMOJI_CATEGORIES.map((cat) => (
                          <div key={cat.label} className="mb-3 last:mb-0">
                            <p className="mb-1 px-1 text-[12px] font-medium" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.45)' }}>{cat.label}</p>
                            <div className="grid grid-cols-6 gap-0.5">
                              {cat.emojis.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => { updateNote(activeNote.id, (n) => ({ ...n, emoji })); setShowEmojiPicker(false); }}
                                  className="tm-menu-row rounded-xl p-1.5 text-center text-2xl"
                                  aria-label={emoji}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Title */}
                <input
                  value={activeNote.title}
                  onChange={(e) => updateNote(activeNote.id, (n) => ({ ...n, title: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    // Down into the first line. The block is already index 0 on a
                    // fresh page, so the focus effect will not fire; focus it here.
                    e.preventDefault();
                    setFocusedBlockIndex(0);
                    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.tm-notes-block textarea')?.focus());
                  }}
                  placeholder="New page"
                  aria-label="Title"
                  className="tm-display tm-note-title bg-transparent outline-hidden"
                />

                {/* Blocks */}
                <Reorder.Group axis="y" values={activeNote.blocks} onReorder={reorderBlocks} className="m-0 mt-5 list-none p-0">
                  {activeNote.blocks.map((block, index) => {
                    const pendingEdit = pendingEdits.find((e) => e.blockId === block.id) || null;
                    const isNewBlock = pendingNewBlocks.some((nb) => nb.tempId === block.id);
                    return (
                      <DraggableBlock
                        key={block.id}
                        block={block}
                        index={index}
                        focused={focusedBlockIndex === index}
                        noteTheme={activeNote.noteTheme || 'purple'}
                        onFocus={() => setFocusedBlockIndex(index)}
                        onChange={(content) => updateBlock(block.id, { content })}
                        onChangeType={(type) => updateBlock(block.id, { type })}
                        onToggleCheck={() => updateBlock(block.id, { checked: !block.checked })}
                        onKeyDown={(e) => handleBlockKeyDown(e, index)}
                        onDelete={() => deleteBlock(index)}
                        onDuplicate={() => duplicateBlock(index)}
                        onResize={(w, h) => updateBlock(block.id, { width: w, height: h })}
                        aiPending={pendingEdit}
                        aiNewBlock={isNewBlock}
                        onAcceptAI={() => handleAcceptEdit(block.id)}
                        onRejectAI={() => handleRejectEdit(block.id)}
                      />
                    );
                  })}
                </Reorder.Group>

                {blank ? (
                  /* Notion's foot of an empty page. */
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-16"
                  >
                    <p className="mb-3 text-[13px]" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.45)' }}>Get started with</p>
                    <div className="flex flex-wrap gap-2">
                      {STARTERS.map((s) => (
                        <button
                          key={s.label}
                          type="button"
                          data-ai={s.ai ? 'true' : 'false'}
                          onClick={() => (s.ai ? openAi() : s.type && startWith(s.type))}
                          className="tm-press tm-glass-pill tm-notes-starter"
                        >
                          <s.icon className="h-4 w-4" />
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <button
                    type="button"
                    onClick={() => insertBlockAfter(activeNote.blocks.length - 1)}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-[14px] transition-colors hover:bg-white/[0.04]"
                    style={{ color: 'rgb(var(--tm-ink-rgb) / 0.4)' }}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" /> Add a block
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <h2 className="tm-display text-4xl" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.9)' }}>
                Nothing here <em>yet.</em>
              </h2>
              <button
                type="button"
                onClick={handleNewNote}
                className="tm-press mt-6 inline-flex items-center gap-2 rounded-full bg-pill px-4 py-2 text-sm font-medium text-pill-ink hover:opacity-90"
              >
                <Plus className="h-4 w-4" aria-hidden="true" /> New note
              </button>
            </div>
          )}

          {/* The quick-ask bar: the chat composer at the foot of the page. An
              ask from here opens the panel so the reply and the changes have
              somewhere to land. */}
          {activeNote && !aiOpen && (
            <div className="tm-notes-dock pointer-events-none absolute inset-x-0 bottom-0 z-20">
              <div className="tm-notes-quick pointer-events-auto">
                <NotesComposer
                  variant="bar"
                  model={aiModel}
                  onModelChange={setAiModel}
                  loading={aiLoading}
                  onSend={(text, attachments) => { void handleAISend(text, attachments); setAiOpen(true); }}
                />
              </div>
            </div>
          )}
        </section>

        {/* The co-pilot */}
        <AnimatePresence>
          {aiOpen && (
            <>
              <motion.div
                key="ai-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setAiOpen(false)}
                className="fixed inset-0 z-30 lg:hidden"
                style={{ background: 'rgb(var(--tm-paper-rgb) / 0.5)' }}
                aria-hidden="true"
              />
              <NotesAiPanel
                key="ai"
                open
                onClose={() => setAiOpen(false)}
                noteTitle={activeNote?.title ?? ''}
                noteEmoji={activeNote?.emoji}
                loading={aiLoading}
                transcript={transcript}
                model={aiModel}
                onModelChange={setAiModel}
                onSend={(text, attachments) => { void handleAISend(text, attachments); }}
                onNewChat={handleNewChat}
                pendingCount={pendingCount}
                onAcceptAll={handleAcceptAll}
                onRejectAll={handleRejectAll}
                focusSignal={aiFocusSignal}
                disabled={!activeNote}
              />
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
