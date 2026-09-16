import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlignLeft, Check, ChevronDown, ListChecks, Loader2, PanelRightClose, PenLine, Scissors, SpellCheck, SquarePen, X,
} from 'lucide-react';
import type { NotesAIModel } from '../../services/ai/notesAiService';
import { EMPTY_ATTACHMENTS, type PendingAttachments } from './notesAttachments';
import { ModelOptions, NotesComposer, type NotesComposerHandle } from './NotesComposer';
import { NOTES_MODELS } from './notesModels';

/* The co-pilot, as Notion keeps it: a column to the right of the page with
   a greeting and suggestions until the first ask, then the conversation,
   the pending changes, and the composer with the page it is working on.
   The header names which mind is answering and lets you change it. */

export interface AiTurn {
  id: string;
  role: 'user' | 'ai';
  text: string;
  /** "2 images, 1 file" — what rode along with a user turn. */
  meta?: string;
}

interface NotesAiPanelProps {
  open: boolean;
  onClose: () => void;
  noteTitle: string;
  noteEmoji?: string;
  loading: boolean;
  transcript: AiTurn[];
  model: NotesAIModel;
  onModelChange: (m: NotesAIModel) => void;
  onSend: (instruction: string, attachments: PendingAttachments) => void;
  onNewChat: () => void;
  pendingCount: number;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  /** Bump to move focus into the composer (Ask, space-for-AI). */
  focusSignal: number;
  disabled?: boolean;
}

const SUGGESTIONS: { icon: React.ComponentType<{ className?: string }>; label: string; prompt: string }[] = [
  { icon: AlignLeft, label: 'Summarize this note', prompt: 'Add a short summary at the top of this note.' },
  { icon: ListChecks, label: 'Turn it into a to-do list', prompt: 'Turn the main points of this note into a to-do list.' },
  { icon: SpellCheck, label: 'Fix spelling and grammar', prompt: 'Fix spelling and grammar throughout, keeping my voice.' },
  { icon: PenLine, label: 'Continue writing', prompt: 'Continue writing from where the note ends, in the same tone.' },
  { icon: Scissors, label: 'Make it shorter', prompt: 'Make this note shorter without losing anything important.' },
];

export function NotesAiPanel({
  open, onClose, noteTitle, noteEmoji, loading, transcript, model, onModelChange, onSend, onNewChat,
  pendingCount, onAcceptAll, onRejectAll, focusSignal, disabled,
}: NotesAiPanelProps) {
  const composerRef = useRef<NotesComposerHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [modelMenu, setModelMenu] = useState(false);
  const modelButtonRef = useRef<HTMLButtonElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || focusSignal === 0) return;
    const id = requestAnimationFrame(() => composerRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open, focusSignal]);

  // Keep the newest turn in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript.length, loading]);

  useEffect(() => {
    if (!modelMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModelMenu(false); };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (modelMenuRef.current?.contains(t) || modelButtonRef.current?.contains(t)) return;
      setModelMenu(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [modelMenu]);

  if (!open) return null;

  const mind = NOTES_MODELS.find((m) => m.key === model) ?? NOTES_MODELS[0];

  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="tm-notes-ai flex w-full shrink-0 flex-col lg:w-[380px]"
      aria-label="Notes AI"
    >
      {/* Header: which mind answers */}
      <div className="flex min-h-[52px] items-center justify-between gap-2 px-3">
        <span className="relative">
          <button
            ref={modelButtonRef}
            type="button"
            onClick={() => setModelMenu((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={modelMenu}
            aria-label={`Model: ${mind.name}`}
            className="tm-press flex items-center gap-2 rounded-full py-1.5 pl-2 pr-2.5 text-[14px] font-medium transition-colors hover:bg-white/[0.06]"
            style={{ color: 'rgb(var(--tm-ink-rgb) / 0.9)' }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: `rgb(${mind.hue})`, boxShadow: `0 0 10px rgb(${mind.hue} / 0.7)` }} aria-hidden="true" />
            {mind.name}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${modelMenu ? 'rotate-180' : ''}`} style={{ color: 'rgb(var(--tm-ink-rgb) / 0.5)' }} aria-hidden="true" />
          </button>
          <AnimatePresence>
            {modelMenu && (
              <motion.div
                ref={modelMenuRef}
                role="menu"
                aria-label="Model"
                initial={{ opacity: 0, y: -6, scale: 0.98, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -4, scale: 0.98, filter: 'blur(6px)' }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="tm-glass tm-notes-menu absolute left-0 top-full z-50 mt-2 w-64 origin-top-left"
              >
                <ModelOptions model={model} onChange={(m) => { onModelChange(m); setModelMenu(false); }} />
              </motion.div>
            )}
          </AnimatePresence>
        </span>
        <span className="flex items-center gap-0.5">
          <button type="button" onClick={onNewChat} aria-label="New AI chat" title="New AI chat" className="tm-notes-icon" disabled={transcript.length === 0 && !loading}>
            <SquarePen className="h-4 w-4" />
          </button>
          <button type="button" onClick={onClose} aria-label="Close AI panel" className="tm-notes-icon">
            <PanelRightClose className="h-4 w-4" />
          </button>
        </span>
      </div>

      {/* Body */}
      <div ref={scrollRef} className="tm-notes-scroll min-h-0 flex-1 overflow-y-auto px-5">
        {transcript.length === 0 && !loading ? (
          <div className="flex h-full flex-col justify-end pb-6 pt-10">
            <h2 className="tm-display tm-notes-ai-greeting">
              What are we <em>writing</em> first?
            </h2>
            <div className="mt-5 -mx-2.5 flex flex-col">
              {SUGGESTIONS.map((s) => (
                <button key={s.label} type="button" onClick={() => onSend(s.prompt, EMPTY_ATTACHMENTS)} disabled={disabled || loading} className="tm-notes-ai-suggest disabled:opacity-40">
                  <s.icon className="h-4 w-4 shrink-0" />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-5">
            {transcript.map((t) => (
              t.role === 'user' ? (
                <div key={t.id} className="flex flex-col items-end gap-1">
                  <p className="tm-notes-ai-user">{t.text}</p>
                  {t.meta && <span className="px-1 text-[12px]" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.45)' }}>{t.meta}</span>}
                </div>
              ) : (
                <div key={t.id} className="tm-notes-ai-reply">
                  <p className="tm-notes-ai-reply-who">{mind.name}</p>
                  <p>{t.text}</p>
                </div>
              )
            ))}
            {loading && (
              <div className="tm-notes-ai-reply flex items-center gap-2" aria-live="polite">
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: `rgb(${mind.hue})` }} />
                <span style={{ color: 'rgb(var(--tm-ink-rgb) / 0.55)' }}>Reading the note…</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pending changes */}
      {pendingCount > 0 && (
        <div className="px-4 pb-3">
          <div className="tm-notes-pending flex items-center justify-between gap-3">
            <span className="text-[13px]" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.85)' }}>
              {pendingCount} change{pendingCount === 1 ? '' : 's'} to review
            </span>
            <span className="flex items-center gap-1.5">
              <button type="button" onClick={onAcceptAll} className="tm-press tm-notes-pending-accept inline-flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Accept all
              </button>
              <button type="button" onClick={onRejectAll} className="tm-press tm-notes-pending-reject inline-flex items-center gap-1">
                <X className="h-3.5 w-3.5" /> Reject
              </button>
            </span>
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="px-4 pb-4">
        <NotesComposer
          ref={composerRef}
          variant="panel"
          model={model}
          onModelChange={onModelChange}
          onSend={onSend}
          loading={loading}
          disabled={disabled}
          pageName={noteTitle || 'New page'}
          pageEmoji={noteEmoji}
        />
      </div>
    </motion.aside>
  );
}
