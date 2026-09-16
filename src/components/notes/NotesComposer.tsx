import React, { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Check, FileText, ImagePlus, Loader2, Plus, X } from 'lucide-react';
import SendIcon from '../icons/SendIcon';
import { LoadingSpinner } from '../loading/LoadingSpinner';
import type { NotesAIModel } from '../../services/ai/notesAiService';
import {
  EMPTY_ATTACHMENTS, FILE_ACCEPT, IMAGE_ACCEPT, MAX_FILES, MAX_IMAGES,
  formatBytes, hasAttachments, readAttachmentText, shrinkImage,
  type PendingAttachments,
} from './notesAttachments';
import { NOTES_MODELS } from './notesModels';

/* The Notes composer: the chat composer's lens and controls, asked to do one
   thing. The "+" opens what the chat's does — uploads — plus, on the page bar,
   which mind answers. The panel picks the mind in its header instead. */

/** The two minds as radio rows, for any menu that offers the choice. */
export function ModelOptions({ model, onChange }: { model: NotesAIModel; onChange: (m: NotesAIModel) => void }) {
  return (
    <div role="group" aria-label="Model">
      {NOTES_MODELS.map((m) => {
        const on = m.key === model;
        return (
          <button
            key={m.key}
            type="button"
            role="menuitemradio"
            aria-checked={on}
            onClick={() => onChange(m.key)}
            className="tm-menu-row flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: `rgb(${m.hue})`, boxShadow: on ? `0 0 10px rgb(${m.hue} / 0.7)` : undefined, opacity: on ? 1 : 0.55 }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm" style={{ color: on ? `rgb(${m.hue})` : 'rgb(var(--tm-ink-rgb) / 0.9)' }}>{m.name}</span>
              <span className="block text-[12px]" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.5)' }}>{m.detail}</span>
            </span>
            {on && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: `rgb(${m.hue})` }} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

export interface NotesComposerHandle {
  focus: () => void;
}

interface NotesComposerProps {
  /** `bar` is the single row at the foot of the page; `panel` the card in the AI panel. */
  variant: 'bar' | 'panel';
  model: NotesAIModel;
  onModelChange: (m: NotesAIModel) => void;
  onSend: (instruction: string, attachments: PendingAttachments) => void;
  loading: boolean;
  disabled?: boolean;
  /** Panel only: the page the ask is about. */
  pageName?: string;
  pageEmoji?: string;
}

export const NotesComposer = forwardRef<NotesComposerHandle, NotesComposerProps>(function NotesComposer(
  { variant, model, onModelChange, onSend, loading, disabled, pageName, pageEmoji },
  ref,
) {
  const reduced = useReducedMotion() ?? false;
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachments>(EMPTY_ATTACHMENTS);
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const plusRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({ focus: () => textareaRef.current?.focus() }), []);

  // The "+" menu closes on Escape and on any press outside it.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    const onPointer = (e: PointerEvent) => { if (!plusRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(id);
  }, [notice]);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, []);

  const busy = loading || reading || !!disabled;
  const canSend = !busy && (value.trim().length > 0 || hasAttachments(attachments));

  const submit = useCallback(() => {
    const text = value.trim();
    if (busy || (!text && !hasAttachments(attachments))) return;
    onSend(text || 'Use what I attached to improve this note.', attachments);
    setValue('');
    setAttachments(EMPTY_ATTACHMENTS);
    requestAnimationFrame(resize);
  }, [busy, value, attachments, onSend, resize]);

  const addImages = async (list: FileList | null) => {
    if (!list) return;
    const room = MAX_IMAGES - attachments.images.length;
    const files = Array.from(list).slice(0, Math.max(0, room));
    if (files.length < list.length) setNotice(`Up to ${MAX_IMAGES} images at a time.`);
    if (!files.length) return;
    setReading(true);
    try {
      const shrunk = await Promise.all(files.map(shrinkImage));
      setAttachments((a) => ({ ...a, images: [...a.images, ...shrunk] }));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not read that image.');
    } finally {
      setReading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const room = MAX_FILES - attachments.files.length;
    const files = Array.from(list).slice(0, Math.max(0, room));
    if (files.length < list.length) setNotice(`Up to ${MAX_FILES} files at a time.`);
    if (!files.length) return;
    setReading(true);
    try {
      const read = await Promise.all(files.map(readAttachmentText));
      setAttachments((a) => ({ ...a, files: [...a.files, ...read] }));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not read that file.');
    } finally {
      setReading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    const images = dropped.filter((f) => f.type.startsWith('image/'));
    const others = dropped.filter((f) => !f.type.startsWith('image/'));
    const toList = (arr: File[]) => { const dt = new DataTransfer(); arr.forEach((f) => dt.items.add(f)); return dt.files; };
    if (images.length) void addImages(toList(images));
    if (others.length) void addFiles(toList(others));
  };

  const hue = NOTES_MODELS.find((m) => m.key === model)?.hue ?? '168 85 247';
  const isPanel = variant === 'panel';

  const previews = (attachments.images.length > 0 || attachments.files.length > 0) && (
    <div className={`flex flex-wrap items-center gap-2 ${isPanel ? 'px-1 pt-2' : 'px-2 pb-2'}`}>
      {attachments.images.map((img) => (
        <span key={img.id} className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-xl" style={{ border: '1px solid rgb(var(--tm-ink-rgb) / 0.12)' }}>
          <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => setAttachments((a) => ({ ...a, images: a.images.filter((i) => i.id !== img.id) }))}
            aria-label={`Remove ${img.name}`}
            className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full"
            style={{ background: 'rgb(var(--tm-paper-rgb) / 0.7)', color: 'rgb(var(--tm-ink-rgb) / 0.9)' }}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {attachments.files.map((f) => (
        <span key={f.id} className="tm-notes-ai-chip !min-h-8 gap-2 !pl-2.5">
          <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate" style={{ maxWidth: '10rem' }}>{f.name}</span>
          <span style={{ color: 'rgb(var(--tm-ink-rgb) / 0.45)' }}>{formatBytes(f.size)}</span>
          <button
            type="button"
            onClick={() => setAttachments((a) => ({ ...a, files: a.files.filter((x) => x.id !== f.id) }))}
            aria-label={`Remove ${f.name}`}
            className="-mr-1 flex h-5 w-5 items-center justify-center rounded-full hover:bg-white/10"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );

  const plus = (
    <div className="relative shrink-0" ref={plusRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        disabled={busy}
        className={`tm-press tm-composer-control ${isPanel ? '!h-9 !w-9' : ''}`}
        aria-label={isPanel ? 'Attach photos or files' : 'Attach, or choose a model'}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className={`h-5 w-5 transition-transform duration-200 ${menuOpen ? 'rotate-45' : ''}`} />}
      </button>
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            role="menu"
            aria-label={isPanel ? 'Attachments' : 'Attachments and model'}
            initial={reduced ? false : { opacity: 0, y: 8, scale: 0.98, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={reduced ? undefined : { opacity: 0, y: 6, scale: 0.98, filter: 'blur(6px)' }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="tm-glass tm-chat-menu absolute bottom-full left-0 z-50 mb-3 w-64 origin-bottom-left rounded-3xl p-1.5"
            onKeyDown={(event) => {
              const buttons = Array.from(event.currentTarget.querySelectorAll('button'));
              const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
              }
            }}
          >
            {!isPanel && (
              <>
                <p className="px-3 pb-1 pt-1.5 text-[12px] font-medium" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.45)' }}>Model</p>
                <ModelOptions model={model} onChange={(m) => { onModelChange(m); setMenuOpen(false); }} />
                <div className="mx-3 my-1.5 h-px" style={{ background: 'rgb(var(--tm-ink-rgb) / 0.08)' }} />
              </>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => { setMenuOpen(false); imageInputRef.current?.click(); }}
              className="tm-menu-row flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm"
              style={{ color: 'rgb(var(--tm-ink-rgb) / 0.9)' }}
            >
              <ImagePlus className="h-4 w-4 shrink-0" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.55)' }} aria-hidden="true" />
              Upload photos
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setMenuOpen(false); fileInputRef.current?.click(); }}
              className="tm-menu-row flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm"
              style={{ color: 'rgb(var(--tm-ink-rgb) / 0.9)' }}
            >
              <FileText className="h-4 w-4 shrink-0" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.55)' }} aria-hidden="true" />
              Upload files
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const textarea = (
    <textarea
      ref={textareaRef}
      value={value}
      rows={1}
      disabled={loading || !!disabled}
      onChange={(e) => { setValue(e.target.value); resize(); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
      }}
      placeholder={loading ? 'Reading the note…' : isPanel ? 'Do anything with this note…' : 'Ask to edit this note'}
      aria-label="Ask TimeMachine to edit this note"
      className={`block w-full resize-none bg-transparent outline-hidden disabled:opacity-50 ${isPanel ? 'px-1 py-1 text-[15px]' : 'px-2 py-2.5 text-base sm:px-3'}`}
      style={{ color: 'rgb(var(--tm-ink-rgb) / 0.95)', minHeight: isPanel ? undefined : 44, maxHeight: 150, lineHeight: '24px', overflowY: 'auto' }}
    />
  );

  const send = (
    <button
      type="submit"
      disabled={!canSend}
      aria-label="Send"
      className={`tm-press tm-composer-control tm-composer-send ${isPanel ? '!h-9 !w-9' : ''}`}
    >
      {loading ? <LoadingSpinner size="sm" /> : <SendIcon className={isPanel ? 'h-4 w-4' : 'h-5 w-5'} />}
    </button>
  );

  const inputs = (
    <>
      <input ref={imageInputRef} type="file" accept={IMAGE_ACCEPT} multiple className="hidden" onChange={(e) => void addImages(e.target.files)} />
      <input ref={fileInputRef} type="file" accept={FILE_ACCEPT} multiple className="hidden" onChange={(e) => void addFiles(e.target.files)} />
    </>
  );

  const noticeLine = notice && (
    <p role="status" className="px-3 pt-1.5 text-[12px]" style={{ color: 'rgb(252 165 165)' }}>{notice}</p>
  );

  if (isPanel) {
    return (
      <form
        className="tm-notes-ai-composer p-2.5"
        style={{ '--tm-composer-hue': hue } as React.CSSProperties}
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        {inputs}
        <span className="tm-notes-ai-chip" title={pageName}>
          {pageEmoji ? <span aria-hidden="true">{pageEmoji}</span> : <FileText className="h-3.5 w-3.5" aria-hidden="true" />}
          <span className="truncate">{pageName || 'New page'}</span>
        </span>
        {previews}
        <div className="mt-2">{textarea}</div>
        <div className="mt-1 flex items-center justify-between">
          {plus}
          {send}
        </div>
        {noticeLine}
      </form>
    );
  }

  return (
    <form
      className="tm-composer"
      style={{ '--tm-composer-hue': hue } as React.CSSProperties}
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <div className="tm-glass tm-composer-surface" aria-hidden="true" />
      <div className="relative">
        {inputs}
        {previews && <div className="pt-2">{previews}</div>}
        <div className="flex items-end gap-1 p-2">
          {plus}
          <div className="min-w-0 flex-1">{textarea}</div>
          {send}
        </div>
        {noticeLine && <div className="pb-2">{noticeLine}</div>}
      </div>
    </form>
  );
});
