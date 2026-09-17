/**
 * Contour — File Converter view.
 *
 * Drop files, pick what each becomes, convert, download. Everything runs on
 * the device (src/services/convert); the engines that need a download say so
 * on the row while they load. The queue outlives the panel: dismissing
 * Contour and typing /convert again brings the same files back, so a
 * conversion in progress is not lost to an Escape.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, Download, FileAudio, FileImage, FileText, FileVideo, FolderInput, Loader2, Package, Repeat, Trash2, Upload, X } from 'lucide-react';
import type { ModuleData } from '../moduleRegistry';
import { AccentTheme, IconBadge, HintView, SELECT_ARROW } from './shared';
import {
  ACCEPT_ATTRIBUTE, CATEGORY_LABEL, ConversionError, type ConversionProgress, type ConvertedFile, type FileFormat, type FormatCategory,
  convertFile, converterSupported, downloadBlob, formatBytes, formatOfFile, groupTargets, imageNeedsEngine, targetsFor, zipFiles,
} from '../../../services/convert';

export const CONVERT_EVENT = 'tm-contour-convert';

type Status = 'queued' | 'working' | 'done' | 'failed';

interface QueueItem {
  id: string;
  file: File;
  source: FileFormat;
  /** The format picked when the file was added. */
  target: FileFormat;
  /** The format the user picked from the row's menu; wins over the textbox. */
  chosen?: FileFormat;
  status: Status;
  progress?: ConversionProgress;
  result?: ConvertedFile;
  error?: string;
  controller?: AbortController;
}

const CATEGORY_ICON: Record<FormatCategory, React.ComponentType<{ className?: string }>> = {
  image: FileImage, audio: FileAudio, video: FileVideo, document: FileText,
};

const LOSSY = new Set(['jpeg', 'webp', 'avif', 'jxl', 'heic', 'mp3', 'aac', 'm4a', 'm4b', 'ogg', 'opus', 'weba', 'wma', 'ac3', 'mp2', 'mp4', 'mov', 'mkv', 'ts', '3gp', 'webm']);

/** The queue survives the panel closing; see the header comment. */
let persistedQueue: QueueItem[] = [];
let persistedQuality = 85;

/**
 * What a row converts to: the row's own choice, else whatever the textbox
 * names if this file can take it, else the default it was added with.
 * Derived on every render, so a target typed later applies without any
 * state having to be rewritten.
 */
function resolveTarget(item: QueueItem, typed: FileFormat | null): FileFormat {
  if (item.chosen) return item.chosen;
  if (typed && targetsFor(item.source).some((format) => format.ext === typed.ext)) return typed;
  return item.target;
}

/** The first target a file of this format becomes when nothing was asked for. */
function defaultTarget(source: FileFormat, preferred: FileFormat | null): FileFormat | null {
  const targets = targetsFor(source);
  if (preferred && targets.some((format) => format.ext === preferred.ext)) return preferred;
  const favourite: Partial<Record<string, string>> = {
    heic: 'jpeg', png: 'webp', webp: 'png', jpeg: 'png', gif: 'png', svg: 'png', tiff: 'png', bmp: 'png', avif: 'png', jxl: 'png', psd: 'png',
    wav: 'mp3', flac: 'mp3', mp3: 'wav', m4a: 'mp3', aac: 'mp3', ogg: 'mp3', opus: 'mp3', wma: 'mp3',
    mp4: 'mp3', mov: 'mp4', mkv: 'mp4', avi: 'mp4', webm: 'mp4', wmv: 'mp4', flv: 'mp4',
    docx: 'md', md: 'docx', txt: 'md', html: 'md', pdf: 'md', csv: 'json', tsv: 'csv', json: 'csv',
  };
  const wanted = favourite[source.ext];
  return targets.find((format) => format.ext === wanted) ?? targets[0] ?? null;
}

export function FileConvertView({ module, accent }: { module: ModuleData; accent: AccentTheme }) {
  const typedTarget = module.fileConvert?.target ?? null;
  const [queue, setQueue] = useState<QueueItem[]>(() => persistedQueue);
  const [quality, setQuality] = useState(() => persistedQuality);
  const [dragging, setDragging] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const supported = useMemo(() => converterSupported(), []);
  // The Enter listener below outlives any one render; it reads the target
  // through this ref rather than closing over a stale one.
  const typedTargetRef = useRef<FileFormat | null>(typedTarget);

  useEffect(() => { persistedQueue = queue; }, [queue]);
  useEffect(() => { persistedQuality = quality; }, [quality]);
  useEffect(() => { typedTargetRef.current = typedTarget; }, [typedTarget]);

  const patch = useCallback((id: string, changes: Partial<QueueItem>) => {
    setQueue((items) => items.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const accepted: QueueItem[] = [];
    const refused: string[] = [];
    for (const file of Array.from(files)) {
      const source = formatOfFile(file);
      const target = source ? defaultTarget(source, typedTarget) : null;
      if (!source || !target) { refused.push(file.name); continue; }
      accepted.push({ id: crypto.randomUUID(), file, source, target, status: 'queued' });
    }
    if (accepted.length > 0) setQueue((items) => [...items, ...accepted]);
    setRejected(refused);
  }, [typedTarget]);

  const runOne = useCallback(async (item: QueueItem, target: FileFormat) => {
    const controller = new AbortController();
    patch(item.id, { status: 'working', controller, error: undefined, result: undefined, progress: { phase: 'convert', label: 'Starting', ratio: undefined } });
    try {
      const result = await convertFile(item.file, target, { quality, signal: controller.signal }, (progress) => patch(item.id, { progress }));
      patch(item.id, { status: 'done', result, progress: undefined, controller: undefined });
    } catch (error) {
      const message = error instanceof ConversionError ? error.message : 'Something went wrong while converting.';
      patch(item.id, { status: 'failed', error: message, progress: undefined, controller: undefined });
    }
  }, [patch, quality]);

  const runAll = useCallback(() => {
    // Sequential: the media engine queues anyway, and two ImageMagick runs at
    // once would only fight for memory.
    const pending = persistedQueue.filter((item) => item.status === 'queued' || item.status === 'failed');
    const typed = typedTargetRef.current;
    void (async () => { for (const item of pending) await runOne(item, resolveTarget(item, typed)); })();
  }, [runOne]);

  // Enter in the textbox (ChatInput dispatches this while the tool is focused).
  useEffect(() => {
    const onConvert = () => runAll();
    window.addEventListener(CONVERT_EVENT, onConvert);
    return () => window.removeEventListener(CONVERT_EVENT, onConvert);
  }, [runAll]);

  const remove = (item: QueueItem) => {
    item.controller?.abort();
    setQueue((items) => items.filter((other) => other.id !== item.id));
  };

  const clearAll = () => {
    queue.forEach((item) => item.controller?.abort());
    setQueue([]);
    setRejected([]);
  };

  const downloadAll = async () => {
    const done = queue.filter((item) => item.result).map((item) => item.result as ConvertedFile);
    if (done.length === 1) { downloadBlob(done[0].blob, done[0].name); return; }
    setZipping(true);
    try {
      downloadBlob(await zipFiles(done), 'converted.zip');
    } finally {
      setZipping(false);
    }
  };

  // Drops inside the panel must not reach ChatInput, which would attach the
  // file to the message instead.
  const onDragOver = (event: React.DragEvent) => { event.preventDefault(); event.stopPropagation(); setDragging(true); };
  const onDragLeave = (event: React.DragEvent) => { event.stopPropagation(); setDragging(false); };
  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
  };

  const pendingCount = queue.filter((item) => item.status === 'queued' || item.status === 'failed').length;
  const workingCount = queue.filter((item) => item.status === 'working').length;
  const doneCount = queue.filter((item) => item.status === 'done').length;
  const showQuality = queue.some((item) => LOSSY.has(resolveTarget(item, typedTarget).ext));

  if (!supported) {
    return <HintView icon={Repeat} accent={accent} text="This browser cannot run the converter — it needs WebAssembly and web workers." />;
  }

  return (
    <div className="p-4 space-y-3" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <div className="flex items-center gap-3">
        <IconBadge icon={Repeat} accent={accent} />
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-medium">File Converter</div>
          <div className="text-ink-muted text-xs">
            {typedTarget
              ? <>Everything you add becomes <span className={accent.text}>{typedTarget.label}</span>. Converted on your device — nothing is uploaded.</>
              : 'Images, audio, video and documents. Converted on your device — nothing is uploaded.'}
          </div>
        </div>
        {queue.length > 0 && (
          <button
            type="button"
            onClick={runAll}
            disabled={pendingCount === 0}
            className="shrink-0 h-8 px-3 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-40"
            style={{ background: accent.bg, border: `1px solid ${accent.border}`, color: accent.solid }}
          >
            {workingCount > 0 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Repeat className="w-3.5 h-3.5" />}
            {workingCount > 0 ? 'Converting' : pendingCount > 1 ? `Convert ${pendingCount}` : 'Convert'}
          </button>
        )}
      </div>

      {/* Drop zone */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-2xl px-4 py-5 flex flex-col items-center gap-1.5 text-center transition-all"
        style={{
          border: `1.5px dashed ${dragging ? accent.border.replace('0.25', '0.7') : 'rgb(var(--tm-ink-rgb) / 0.14)'}`,
          background: dragging ? accent.bg : 'rgb(var(--tm-ink-rgb) / 0.02)',
          boxShadow: dragging ? accent.glow : undefined,
        }}
      >
        {dragging ? <FolderInput className={`w-5 h-5 ${accent.text}`} /> : <Upload className="w-5 h-5 text-ink-muted" />}
        <span className="text-sm text-ink">{dragging ? 'Drop to add' : 'Drop files here, or click to choose'}</span>
        <span className="text-[11px] text-ink-muted">HEIC · PNG · WebP · TIFF · RAW · MP3 · WAV · FLAC · MP4 · MOV · DOCX · PDF · CSV and more</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ''; }}
      />

      {rejected.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-amber-300/80">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Skipped {rejected.length === 1 ? rejected[0] : `${rejected.length} files`} — not a format the converter reads.</span>
        </div>
      )}

      {/* Queue */}
      {queue.length > 0 && (
        <div className="space-y-1.5">
          {queue.map((item) => (
            <QueueRow
              key={item.id}
              item={item}
              target={resolveTarget(item, typedTarget)}
              accent={accent}
              onTarget={(chosen) => patch(item.id, { chosen, status: item.status === 'done' ? 'queued' : item.status, result: undefined, error: undefined })}
              onRun={() => runOne(item, resolveTarget(item, typedTarget))}
              onRemove={() => remove(item)}
            />
          ))}
        </div>
      )}

      {/* Footer controls */}
      {queue.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-2" style={{ borderTop: '1px solid rgb(var(--tm-ink-rgb) / 0.06)' }}>
          {showQuality && (
            <label className="flex items-center gap-2 text-xs text-ink-muted mr-auto">
              Quality
              <input
                type="range" min={30} max={100} step={5} value={quality}
                onChange={(event) => setQuality(Number(event.target.value))}
                className="w-24 accent-current"
                style={{ color: accent.solid }}
                aria-label="Output quality"
              />
              <span className="font-mono w-7 text-right">{quality}</span>
            </label>
          )}
          <div className="flex items-center gap-2 ml-auto">
            {doneCount > 0 && (
              <button
                type="button"
                onClick={() => void downloadAll()}
                disabled={zipping}
                className="h-8 px-3 rounded-full text-xs font-medium flex items-center gap-1.5 text-ink transition-colors disabled:opacity-50"
                style={{ background: 'rgb(var(--tm-ink-rgb) / 0.06)', border: '1px solid rgb(var(--tm-ink-rgb) / 0.1)' }}
              >
                {zipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                {doneCount > 1 ? `Download all (${doneCount}) as .zip` : 'Download'}
              </button>
            )}
            <button
              type="button"
              onClick={clearAll}
              className="h-8 px-3 rounded-full text-xs font-medium flex items-center gap-1.5 text-ink-muted hover:text-ink transition-colors"
              style={{ background: 'rgb(var(--tm-ink-rgb) / 0.03)', border: '1px solid rgb(var(--tm-ink-rgb) / 0.06)' }}
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────────

function QueueRow({ item, target, accent, onTarget, onRun, onRemove }: {
  item: QueueItem;
  target: FileFormat;
  accent: AccentTheme;
  onTarget: (target: FileFormat) => void;
  onRun: () => void;
  onRemove: () => void;
}) {
  const Icon = CATEGORY_ICON[item.source.category];
  const groups = useMemo(() => groupTargets(targetsFor(item.source)), [item.source]);
  const needsEngine = item.status === 'queued' && (
    (item.source.category === 'image' && imageNeedsEngine(item.source, target))
    || item.source.category === 'audio' || item.source.category === 'video'
  );
  const slow = item.status === 'queued' && item.source.category === 'video' && target.category === 'video';

  return (
    <div
      className="rounded-xl px-3 py-2 flex items-center gap-2.5"
      style={{ background: 'rgb(var(--tm-ink-rgb) / 0.03)', border: `1px solid ${item.status === 'failed' ? 'rgb(248 113 113 / 0.35)' : 'rgb(var(--tm-ink-rgb) / 0.06)'}` }}
    >
      <div className="p-1.5 rounded-lg shrink-0" style={{ background: 'rgb(var(--tm-ink-rgb) / 0.05)' }}>
        <Icon className="w-4 h-4 text-ink-muted" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm text-ink truncate" title={item.file.name}>{item.result?.name ?? item.file.name}</div>
        <div className="text-[11px] text-ink-muted truncate">
          {item.status === 'working' && item.progress && (
            <ProgressLine progress={item.progress} accent={accent} />
          )}
          {item.status === 'done' && item.result && (
            <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> {formatBytes(item.result.blob.size)} · was {formatBytes(item.file.size)}</span>
          )}
          {item.status === 'failed' && (
            <span className="text-red-400/80">{item.error}</span>
          )}
          {item.status === 'queued' && (
            <span>
              {formatBytes(item.file.size)} · {item.source.label}
              {needsEngine && <> · loads the {item.source.category === 'image' ? 'image' : 'media'} engine once</>}
              {slow && <> · video re-encodes on your device, so give it time</>}
              {target.note && <> · {target.note}</>}
            </span>
          )}
        </div>
      </div>

      <span className="text-ink-muted text-xs shrink-0">→</span>
      <select
        value={target.ext}
        disabled={item.status === 'working'}
        onChange={(event) => {
          const next = groups.flatMap((group) => group.formats).find((format) => format.ext === event.target.value);
          if (next) onTarget(next);
        }}
        className="w-[104px] shrink-0 bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-hidden focus:border-white/25 transition-colors appearance-none cursor-pointer pr-6 disabled:opacity-50"
        style={{ backgroundImage: SELECT_ARROW, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
        aria-label={`Convert ${item.file.name} to`}
      >
        {groups.map((group) => (
          <optgroup key={group.category} label={CATEGORY_LABEL[group.category]} style={{ background: 'var(--color-surface)', color: 'var(--color-ink)' }}>
            {group.formats.map((format) => (
              <option key={format.ext} value={format.ext} style={{ background: 'var(--color-surface)', color: 'var(--color-ink)' }}>{format.label}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {item.status === 'done' && item.result ? (
        <button type="button" onClick={() => downloadBlob(item.result!.blob, item.result!.name)} aria-label={`Download ${item.result.name}`} className="p-1.5 rounded-lg transition-colors shrink-0" style={{ color: accent.solid, background: accent.bg, border: `1px solid ${accent.border}` }}>
          <Download className="w-3.5 h-3.5" />
        </button>
      ) : item.status === 'working' ? (
        <button type="button" onClick={onRemove} aria-label="Cancel" className="p-1.5 rounded-lg text-ink-muted hover:text-ink transition-colors shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button type="button" onClick={onRun} aria-label={item.status === 'failed' ? 'Try again' : 'Convert this file'} className="p-1.5 rounded-lg text-ink-muted hover:text-ink transition-colors shrink-0" style={{ background: 'rgb(var(--tm-ink-rgb) / 0.04)', border: '1px solid rgb(var(--tm-ink-rgb) / 0.08)' }}>
          <Repeat className="w-3.5 h-3.5" />
        </button>
      )}
      {item.status !== 'working' && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${item.file.name}`} className="p-1.5 rounded-lg text-ink-muted hover:text-ink transition-colors shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function ProgressLine({ progress, accent }: { progress: ConversionProgress; accent: AccentTheme }) {
  const percent = progress.ratio != null ? Math.round(progress.ratio * 100) : null;
  return (
    <span className="flex items-center gap-2">
      <Loader2 className="w-3 h-3 animate-spin shrink-0" style={{ color: accent.solid }} />
      <span className="shrink-0">{progress.label}{percent != null ? ` ${percent}%` : '…'}</span>
      <span className="flex-1 h-1 rounded-full overflow-hidden min-w-[40px]" style={{ background: 'rgb(var(--tm-ink-rgb) / 0.08)' }}>
        <span
          className={`block h-full rounded-full transition-[width] duration-300 ${percent == null ? 'animate-pulse' : ''}`}
          style={{ width: percent != null ? `${percent}%` : '40%', background: accent.solid }}
        />
      </span>
    </span>
  );
}
