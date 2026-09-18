import { popupExit } from '../../utils/popupMotion';
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import {
  MoreHorizontal,
  Plus,
  List,
  ListOrdered,
  CheckSquare,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  Minus,
  Type,
  Trash2,
  Copy,
  GripVertical,
  Palette,
  Check,
  X,
  Sparkles,
  Pencil,
  Eraser,
  ImagePlus,
  TrendingUp,
  Table2,
  Bold,
  Italic,
  Underline,
  Highlighter,
} from 'lucide-react';
import { renderInline } from './renderInline';
import { compileMathExpression } from '../../utils/mathExpression';
import type { Block, BlockType, NoteTheme } from './notesState';
import { getNoteTheme, glassCard } from './noteThemes';
import { toLayoutPx } from '../../utils/pageZoom';

// ─── types ──────────────────────────────────────────────────────────

// ─── AI co-pilot types ──────────────────────────────────────────────

export interface PendingAIEdit {
  blockId: string;
  originalContent: string;
  originalType: BlockType;
  newContent: string;
  newType?: BlockType;
}

export interface PendingNewBlock {
  tempId: string;
  afterBlockId: string;
  type: BlockType;
  content: string;
}


// ─── constants ──────────────────────────────────────────────────────

const BLOCK_MENU_OPTIONS: { type: BlockType; label: string; description: string; icon: React.ReactNode }[] = [
  { type: 'text', label: 'Text', description: 'Plain text block', icon: <Type className="w-4 h-4" /> },
  { type: 'heading1', label: 'Heading 1', description: 'Large section heading', icon: <Heading1 className="w-4 h-4" /> },
  { type: 'heading2', label: 'Heading 2', description: 'Medium section heading', icon: <Heading2 className="w-4 h-4" /> },
  { type: 'heading3', label: 'Heading 3', description: 'Small section heading', icon: <Heading3 className="w-4 h-4" /> },
  { type: 'bullet-list', label: 'Bullet List', description: 'Unordered list item', icon: <List className="w-4 h-4" /> },
  { type: 'numbered-list', label: 'Numbered List', description: 'Ordered list item', icon: <ListOrdered className="w-4 h-4" /> },
  { type: 'todo', label: 'To-do', description: 'Checkbox item', icon: <CheckSquare className="w-4 h-4" /> },
  { type: 'quote', label: 'Quote', description: 'Blockquote text', icon: <Quote className="w-4 h-4" /> },
  { type: 'code', label: 'Code', description: 'Code snippet block', icon: <Code className="w-4 h-4" /> },
  { type: 'divider', label: 'Divider', description: 'Horizontal line', icon: <Minus className="w-4 h-4" /> },
  { type: 'callout', label: 'Callout', description: 'Highlighted callout box', icon: <Palette className="w-4 h-4" /> },
  { type: 'doodle', label: 'Doodle', description: 'Draw freely with pen or brush', icon: <Pencil className="w-4 h-4" /> },
  { type: 'image', label: 'Image', description: 'Insert an image', icon: <ImagePlus className="w-4 h-4" /> },
  { type: 'graph', label: 'Graph', description: 'Plot 1–2 equations on XY axes', icon: <TrendingUp className="w-4 h-4" /> },
  { type: 'table', label: 'Table', description: 'Editable data table', icon: <Table2 className="w-4 h-4" /> },
];


// ─── Doodle block ────────────────────────────────────────────────────

const DOODLE_COLORS = [
  '#ffffff', '#000000', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#06b6d4',
];
const CANVAS_W = 1200;
const CANVAS_H = 600;

interface SpecialBlockProps {
  block: Block;
  onChange: (content: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onResize?: (w: number, h: number) => void;
  dragControls: ReturnType<typeof useDragControls>;
}

function DoodleBlock({ block, onChange, onDelete, onDuplicate, onResize, dragControls }: SpecialBlockProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(4);
  const [showPalette, setShowPalette] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [displaySize, setDisplaySize] = useState({
    w: block.width || 560,
    h: block.height || 280,
  });
  const resizeRef = useRef({ startX: 0, startY: 0, startW: 0, startH: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);

  // Load saved drawing on mount
  useEffect(() => {
    if (block.content && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0);
      };
      img.src = block.content;
    }
    // Mount-only restore: initialContent is captured once, so later edits to
    // block.content do not redraw over the user's strokes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) setShowPalette(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    isDrawing.current = true;
    const pos = getPos(e);
    lastPos.current = pos;
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.beginPath();
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.arc(pos.x, pos.y, (brushSize * 3) / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgb(var(--tm-paper-rgb) / 1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
    }
    ctx.fill();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !lastPos.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgb(var(--tm-paper-rgb) / 1)';
      ctx.lineWidth = brushSize * 6;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    lastPos.current = null;
    const dataUrl = canvasRef.current!.toDataURL('image/png');
    onChange(dataUrl);
  };

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: displaySize.w, startH: displaySize.h };
    const onMove = (ev: MouseEvent) => {
      const newW = Math.max(200, resizeRef.current.startW + (ev.clientX - resizeRef.current.startX));
      const newH = Math.max(120, resizeRef.current.startH + (ev.clientY - resizeRef.current.startY));
      setDisplaySize({ w: newW, h: newH });
    };
    const onUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const newW = Math.max(200, resizeRef.current.startW + (ev.clientX - resizeRef.current.startX));
      const newH = Math.max(120, resizeRef.current.startH + (ev.clientY - resizeRef.current.startY));
      onResize?.(newW, newH);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div className="group relative py-2">
      {/* Drag + context menu controls */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -left-14 top-2 flex items-center gap-0.5">
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-sm hover:bg-white/10 text-ink-muted hover:text-ink-muted transition-colors"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {showMenu && (
            <div className="absolute left-0 top-full mt-1 z-50 rounded-xl overflow-hidden min-w-[160px]" style={glassCard}>
              <button
                onClick={() => { onDuplicate(); setShowMenu(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink hover:bg-white/5 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </button>
              <button
                onClick={() => { onDelete(); setShowMenu(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-white/5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
        <button
          className="p-1 rounded-sm hover:bg-white/10 text-ink-muted hover:text-ink-muted transition-colors cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Canvas card */}
      <div
        className="relative rounded-2xl overflow-hidden select-none"
        style={{
          width: displaySize.w,
          height: displaySize.h,
          maxWidth: '100%',
          background: 'rgb(var(--tm-ink-rgb) / 0.05)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgb(var(--tm-ink-rgb) / 0.1)',
          boxShadow: '0 4px 12px rgb(var(--tm-shadow-rgb) / 0.2), inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.15)',
        }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ width: '100%', height: '100%', touchAction: 'none', display: 'block' }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />

        {/* Pen button — opens palette */}
        <div className="absolute bottom-3 left-3" ref={paletteRef}>
          <button
            onClick={() => setShowPalette(!showPalette)}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
            style={{
              background: showPalette ? 'rgb(var(--tm-ink-rgb) / 0.2)' : 'var(--tm-popover-bg)',
              border: '1px solid rgb(var(--tm-ink-rgb) / 0.2)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: '0 2px 8px rgb(var(--tm-shadow-rgb) / 0.4)',
            }}
          >
            {tool === 'eraser'
              ? <Eraser className="w-4 h-4 text-ink" />
              : <div className="w-4 h-4 flex items-center justify-center"><Pencil className="w-4 h-4" style={{ color }} /></div>
            }
          </button>

          {/* Draw palette */}
          {showPalette && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={popupExit}
              className="absolute bottom-11 left-0 p-3 rounded-2xl z-30"
              style={{
                background: 'var(--tm-popover-bg)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgb(var(--tm-ink-rgb) / 0.12)',
                boxShadow: '0 8px 32px rgb(var(--tm-shadow-rgb) / 0.5)',
                minWidth: 160,
              }}
            >
              {/* Pen / Eraser toggle */}
              <div className="flex gap-1.5 mb-3">
                <button
                  onClick={() => setTool('pen')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    tool === 'pen' ? 'bg-white/20 text-white' : 'text-ink-muted hover:bg-white/10'
                  }`}
                >
                  <Pencil className="w-3 h-3" /> Pen
                </button>
                <button
                  onClick={() => setTool('eraser')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    tool === 'eraser' ? 'bg-white/20 text-white' : 'text-ink-muted hover:bg-white/10'
                  }`}
                >
                  <Eraser className="w-3 h-3" /> Eraser
                </button>
              </div>

              {/* Color swatches */}
              <div className="grid grid-cols-5 gap-1.5 mb-3">
                {DOODLE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => { setColor(c); setTool('pen'); }}
                    className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                    style={{
                      background: c,
                      border: `2px solid ${color === c && tool === 'pen' ? 'white' : 'rgb(var(--tm-ink-rgb) / 0.15)'}`,
                    }}
                  />
                ))}
              </div>

              {/* Brush size */}
              <div className="flex items-center gap-2">
                <span className="text-ink-muted text-xs shrink-0">Size</span>
                <input
                  type="range"
                  min={1}
                  max={24}
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="flex-1 accent-white"
                  style={{ height: 4 }}
                />
                <span className="text-ink-muted text-xs w-4 text-right">{brushSize}</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={onResizeStart}
          className="absolute bottom-1.5 right-1.5 w-5 h-5 flex items-end justify-end cursor-se-resize"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" className="text-ink-muted">
            <line x1="4" y1="12" x2="12" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="8" y1="12" x2="12" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─── Image block ─────────────────────────────────────────────────────

function ImageBlock({ block, onChange, onDelete, onDuplicate, onResize, dragControls }: SpecialBlockProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [displaySize, setDisplaySize] = useState({
    w: block.width || 560,
    h: block.height || 0,
  });
  const [naturalAspect, setNaturalAspect] = useState(0);
  const resizeRef = useRef({ startX: 0, startY: 0, startW: 0, startH: 0, aspect: 0 });

  // Close menu on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // When block.content changes (new image loaded), get natural dimensions
  useEffect(() => {
    if (block.content) {
      const img = new Image();
      img.onload = () => {
        const aspect = img.naturalWidth / img.naturalHeight;
        setNaturalAspect(aspect);
        if (!block.width) {
          const w = Math.min(560, img.naturalWidth);
          setDisplaySize({ w, h: w / aspect });
        }
      };
      img.src = block.content;
    }
  }, [block.content, block.width]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target!.result as string;
      onChange(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: displaySize.w,
      startH: displaySize.h,
      aspect: naturalAspect,
    };
    const onMove = (ev: MouseEvent) => {
      const newW = Math.max(100, resizeRef.current.startW + (ev.clientX - resizeRef.current.startX));
      const newH = resizeRef.current.aspect > 0
        ? newW / resizeRef.current.aspect
        : Math.max(60, resizeRef.current.startH + (ev.clientY - resizeRef.current.startY));
      setDisplaySize({ w: newW, h: newH });
    };
    const onUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const newW = Math.max(100, resizeRef.current.startW + (ev.clientX - resizeRef.current.startX));
      const newH = resizeRef.current.aspect > 0
        ? newW / resizeRef.current.aspect
        : Math.max(60, resizeRef.current.startH + (ev.clientY - resizeRef.current.startY));
      onResize?.(newW, newH);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div className="group relative py-2">
      {/* Drag + context menu controls */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -left-14 top-2 flex items-center gap-0.5">
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-sm hover:bg-white/10 text-ink-muted hover:text-ink-muted transition-colors"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {showMenu && (
            <div className="absolute left-0 top-full mt-1 z-50 rounded-xl overflow-hidden min-w-[160px]" style={glassCard}>
              <button
                onClick={() => { onDuplicate(); setShowMenu(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink hover:bg-white/5 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </button>
              <button
                onClick={() => { onDelete(); setShowMenu(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-white/5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
        <button
          className="p-1 rounded-sm hover:bg-white/10 text-ink-muted hover:text-ink-muted transition-colors cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
      />

      {block.content ? (
        /* Image with resize handle */
        <div
          className="relative inline-block rounded-2xl overflow-hidden"
          style={{ width: displaySize.w, maxWidth: '100%' }}
        >
          <img
            src={block.content}
            alt=""
            style={{ width: displaySize.w, height: displaySize.h || 'auto', display: 'block', maxWidth: '100%', objectFit: 'cover' }}
            className="rounded-2xl"
            draggable={false}
          />
          {/* Replace image button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute top-2 right-2 px-2 py-1 rounded-lg text-xs text-ink hover:text-white transition-colors opacity-0 group-hover:opacity-100"
            style={{
              background: 'rgb(var(--tm-paper-rgb) / 0.6)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgb(var(--tm-ink-rgb) / 0.1)',
            }}
          >
            Replace
          </button>
          {/* Resize handle */}
          <div
            onMouseDown={onResizeStart}
            className="absolute bottom-1.5 right-1.5 w-5 h-5 flex items-end justify-end cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.6)' }}>
              <line x1="4" y1="12" x2="12" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="8" y1="12" x2="12" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      ) : (
        /* Upload prompt */
        <button
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          className="w-full flex flex-col items-center justify-center gap-2 py-10 rounded-2xl text-ink-muted hover:text-ink-muted transition-all"
          style={{
            background: 'rgb(var(--tm-ink-rgb) / 0.03)',
            border: '1.5px dashed rgb(var(--tm-ink-rgb) / 0.1)',
          }}
        >
          <ImagePlus className="w-8 h-8" />
          <span className="text-sm">Click or drop an image</span>
        </button>
      )}
    </div>
  );
}

// ─── graph block ─────────────────────────────────────────────────────

// Convert natural math notation to JS-evaluable expression
// The expression parser lives in src/utils/mathExpression.ts. It used to be a
// string rewriter feeding `new Function` here, which ran anything it did not
// recognise as JavaScript (pre-launch-audit.md A.3).

function formatTick(val: number): string {
  if (Math.abs(val) < 1e-10) return '0';
  if (Math.abs(val) >= 10000 || (Math.abs(val) < 0.001 && val !== 0))
    return val.toExponential(1);
  const s = parseFloat(val.toPrecision(5)).toString();
  return s.length > 7 ? val.toPrecision(3) : s;
}

interface GraphBlockProps {
  block: Block;
  onChange: (content: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  dragControls: ReturnType<typeof useDragControls>;
}

function GraphBlock({ block, onChange, onDelete, onDuplicate, dragControls }: GraphBlockProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [displayW, setDisplayW] = useState(block.width || 540);
  const resizeRef = useRef({ startX: 0, startW: 0 });

  const parsed = useMemo(() => {
    try { return JSON.parse(block.content || '{}'); } catch { return {}; }
  }, [block.content]);

  const [eq1, setEq1] = useState<string>(parsed.eq1 ?? 'sin(x)');
  const [eq2, setEq2] = useState<string>(parsed.eq2 ?? '');
  // View: cx/cy = math coords at SVG center, scale = pixels per math unit
  const [view, setView] = useState({ cx: 0, cy: 0, scale: 50 });
  const panRef = useRef<{ mx: number; my: number; cx: number; cy: number } | null>(null);

  const W = 500, H = 320;

  const toSvgX = useCallback((x: number) => W / 2 + (x - view.cx) * view.scale, [view]);
  const toSvgY = useCallback((y: number) => H / 2 - (y - view.cy) * view.scale, [view]);
  const toMathX = useCallback((sx: number) => (sx - W / 2) / view.scale + view.cx, [view]);
  const toMathY = useCallback((sy: number) => -(sy - H / 2) / view.scale + view.cy, [view]);

  // Build evaluator from equation string
  const buildEval = useCallback((eq: string): ((x: number) => number | null) | null => (
    compileMathExpression(eq)
  ), []);

  // Generate SVG path — adaptive sampling with discontinuity detection
  const genPath = useCallback((evalFn: (x: number) => number | null): string => {
    const steps = 600;
    const xStart = toMathX(0), xEnd = toMathX(W);
    const parts: string[] = [];
    let wasNull = true;
    let prevSy: number | null = null;

    for (let i = 0; i <= steps; i++) {
      const x = xStart + (xEnd - xStart) * i / steps;
      const y = evalFn(x);
      if (y === null) { wasNull = true; prevSy = null; continue; }
      const sx = W / 2 + (x - view.cx) * view.scale;
      const sy = H / 2 - (y - view.cy) * view.scale;
      // Detect near-vertical discontinuity (e.g. tan asymptotes)
      if (prevSy !== null && Math.abs(sy - prevSy) > H * 1.5) { wasNull = true; }
      parts.push(wasNull ? `M${sx.toFixed(1)},${sy.toFixed(1)}` : `L${sx.toFixed(1)},${sy.toFixed(1)}`);
      wasNull = false;
      prevSy = sy;
    }
    return parts.join('');
  }, [view, toMathX]);

  // Compute grid lines with nice step sizes (Desmos-style)
  const { gridLines, xTicks, yTicks } = useMemo(() => {
    const rawStep = 80 / view.scale;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const niceFactors = [1, 2, 5, 10];
    const step = (niceFactors.find((n) => n * mag >= rawStep) ?? 10) * mag;

    const xMin = toMathX(0), xMax = toMathX(W);
    const yMin = toMathY(H), yMax = toMathY(0);

    const gLines: { x1: number; y1: number; x2: number; y2: number; axis: boolean }[] = [];
    const xT: { v: number; sx: number }[] = [];
    const yT: { v: number; sy: number }[] = [];

    const snap = (v: number) => Math.round(v / (step * 1e-9)) * (step * 1e-9);

    for (let gx = Math.ceil(xMin / step) * step; gx <= xMax + step * 0.5; gx += step) {
      const v = snap(gx);
      const sx = toSvgX(v);
      const isAxis = Math.abs(v) < step * 0.01;
      gLines.push({ x1: sx, y1: 0, x2: sx, y2: H, axis: isAxis });
      if (!isAxis) xT.push({ v, sx });
    }
    for (let gy = Math.ceil(yMin / step) * step; gy <= yMax + step * 0.5; gy += step) {
      const v = snap(gy);
      const sy = toSvgY(v);
      const isAxis = Math.abs(v) < step * 0.01;
      gLines.push({ x1: 0, y1: sy, x2: W, y2: sy, axis: isAxis });
      if (!isAxis) yT.push({ v, sy });
    }
    return { gridLines: gLines, xTicks: xT, yTicks: yT };
  }, [view, toMathX, toMathY, toSvgX, toSvgY]);

  // Paths recomputed when equations or view change
  const { path1, path2, err1, err2 } = useMemo(() => {
    const fn1 = buildEval(eq1);
    const fn2 = eq2.trim() ? buildEval(eq2) : null;
    return {
      path1: fn1 ? genPath(fn1) : '',
      path2: fn2 ? genPath(fn2) : '',
      err1: eq1.trim() !== '' && fn1 === null,
      err2: eq2.trim() !== '' && fn2 === null,
    };
  }, [eq1, eq2, buildEval, genPath]);

  // Pan
  const onSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    panRef.current = { mx: e.clientX, my: e.clientY, cx: view.cx, cy: view.cy };
  };
  const onSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!panRef.current) return;
    const dx = (e.clientX - panRef.current.mx) / view.scale;
    const dy = (e.clientY - panRef.current.my) / view.scale;
    setView((v) => ({ ...v, cx: panRef.current!.cx - dx, cy: panRef.current!.cy + dy }));
  };
  const onSvgMouseUp = () => { panRef.current = null; };

  // Zoom toward cursor
  const onSvgWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) / rect.width * W;
    const svgY = (e.clientY - rect.top) / rect.height * H;
    const mxPivot = toMathX(svgX), myPivot = toMathY(svgY);
    setView((v) => {
      const newScale = Math.max(3, Math.min(5000, v.scale * factor));
      return {
        scale: newScale,
        cx: mxPivot - (svgX - W / 2) / newScale,
        cy: myPivot + (svgY - H / 2) / newScale,
      };
    });
  };

  const commit = (e1: string, e2: string) => onChange(JSON.stringify({ eq1: e1, eq2: e2 }));
  const resetView = () => setView({ cx: 0, cy: 0, scale: 50 });

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startW: displayW };
    const onMove = (ev: MouseEvent) => setDisplayW(Math.max(320, resizeRef.current.startW + ev.clientX - resizeRef.current.startX));
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const axisX = Math.max(0, Math.min(W, toSvgX(0)));
  const axisY = Math.max(0, Math.min(H, toSvgY(0)));
  const clipId = `gc-${block.id}`;

  return (
    <div className="group relative py-2">
      {/* Drag / context controls */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -left-14 top-2 flex items-center gap-0.5">
        <div ref={menuRef} className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-1 rounded-sm hover:bg-white/10 text-ink-muted">
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {showMenu && (
            <div className="absolute left-0 top-full mt-1 z-50 rounded-xl overflow-hidden min-w-[160px]" style={glassCard}>
              <button onClick={() => { onDuplicate(); setShowMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink hover:bg-white/5 transition-colors">
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </button>
              <button onClick={() => { onDelete(); setShowMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-white/5 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
        <button className="p-1 rounded-sm hover:bg-white/10 text-ink-muted cursor-grab active:cursor-grabbing" onPointerDown={(e) => dragControls.start(e)}>
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ ...glassCard, width: displayW, maxWidth: '100%' }}>
        {/* Equation inputs */}
        <div className="flex flex-col gap-1 px-4 py-3 border-b border-white/5">
          {/* Eq 1 */}
          <div className={`flex items-center gap-2 rounded-lg px-2 py-1 transition-colors ${err1 ? 'bg-red-500/10' : ''}`}>
            <div className="w-2.5 h-2.5 rounded-full bg-purple-400 shrink-0" />
            <span className="text-xs text-ink-muted font-mono shrink-0">y =</span>
            <input
              type="text"
              value={eq1}
              onChange={(e) => { setEq1(e.target.value); commit(e.target.value, eq2); }}
              placeholder="sin(x)"
              spellCheck={false}
              className={`flex-1 bg-transparent outline-hidden text-sm font-mono ${err1 ? 'text-red-300' : 'text-ink'} placeholder-ink-muted`}
            />
            {err1 && <span className="text-xs text-red-400 shrink-0">invalid</span>}
          </div>
          {/* Eq 2 */}
          <div className={`flex items-center gap-2 rounded-lg px-2 py-1 transition-colors ${err2 ? 'bg-red-500/10' : ''}`}>
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0" />
            <span className="text-xs text-ink-muted font-mono shrink-0">y =</span>
            <input
              type="text"
              value={eq2}
              onChange={(e) => { setEq2(e.target.value); commit(eq1, e.target.value); }}
              placeholder="optional 2nd equation"
              spellCheck={false}
              className={`flex-1 bg-transparent outline-hidden text-sm font-mono ${err2 ? 'text-red-300' : 'text-ink-muted'} placeholder-ink-muted`}
            />
            {err2 && <span className="text-xs text-red-400 shrink-0">invalid</span>}
          </div>
          <p className="text-xs text-ink-muted font-mono mt-0.5 leading-relaxed">
            Supports: <span className="text-ink-muted">x^2 · 2x · sin(x) · cos(x) · tan(x) · sqrt(x) · abs(x) · ln(x) · log(x) · e^x · pi · |x| · (a+b)(a-b)</span>
            &nbsp;·&nbsp; Scroll to zoom · Drag to pan
          </p>
        </div>

        {/* SVG Graph */}
        <div className="relative select-none" style={{ background: 'rgb(var(--tm-paper-rgb) / 0.18)' }}>
          <svg
            width="100%"
            viewBox={`0 0 ${W} ${H}`}
            className="block cursor-grab active:cursor-grabbing"
            onMouseDown={onSvgMouseDown}
            onMouseMove={onSvgMouseMove}
            onMouseUp={onSvgMouseUp}
            onMouseLeave={onSvgMouseUp}
            onWheel={onSvgWheel}
            style={{ display: 'block' }}
          >
            <defs>
              <clipPath id={clipId}>
                <rect x="0" y="0" width={W} height={H} />
              </clipPath>
            </defs>

            {/* Minor grid */}
            {gridLines.filter((l) => !l.axis).map((l, i) => (
              <line key={`g${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="rgb(var(--tm-ink-rgb) / 0.045)" strokeWidth="1" />
            ))}

            {/* Axes */}
            <line x1={0} y1={axisY} x2={W} y2={axisY} stroke="rgb(var(--tm-ink-rgb) / 0.28)" strokeWidth="1.5" />
            <line x1={axisX} y1={0} x2={axisX} y2={H} stroke="rgb(var(--tm-ink-rgb) / 0.28)" strokeWidth="1.5" />

            {/* Tick marks + labels — x axis */}
            {xTicks.map((t, i) => (
              <g key={`xt${i}`}>
                <line x1={t.sx} y1={axisY - 3} x2={t.sx} y2={axisY + 3} stroke="rgb(var(--tm-ink-rgb) / 0.35)" strokeWidth="1" />
                <text
                  x={t.sx}
                  y={Math.min(H - 4, Math.max(14, axisY + 14))}
                  textAnchor="middle"
                  fontSize="9"
                  fill="rgb(var(--tm-ink-rgb) / 0.4)"
                  fontFamily="monospace"
                >{formatTick(t.v)}</text>
              </g>
            ))}

            {/* Tick marks + labels — y axis */}
            {yTicks.map((t, i) => (
              <g key={`yt${i}`}>
                <line x1={axisX - 3} y1={t.sy} x2={axisX + 3} y2={t.sy} stroke="rgb(var(--tm-ink-rgb) / 0.35)" strokeWidth="1" />
                <text
                  x={Math.max(28, Math.min(W - 8, axisX - 6))}
                  y={t.sy + 3.5}
                  textAnchor="end"
                  fontSize="9"
                  fill="rgb(var(--tm-ink-rgb) / 0.4)"
                  fontFamily="monospace"
                >{formatTick(t.v)}</text>
              </g>
            ))}

            {/* Axis labels */}
            <text x={W - 8} y={Math.min(H - 5, Math.max(14, axisY - 7))} fontSize="12" fill="rgb(var(--tm-ink-rgb) / 0.45)" fontStyle="italic" fontFamily="serif">x</text>
            <text x={Math.max(8, Math.min(W - 14, axisX + 7))} y={12} fontSize="12" fill="rgb(var(--tm-ink-rgb) / 0.45)" fontStyle="italic" fontFamily="serif">y</text>

            {/* Origin label */}
            {axisX > 10 && axisX < W - 10 && axisY > 10 && axisY < H - 10 && (
              <text x={axisX - 6} y={axisY + 13} textAnchor="end" fontSize="8" fill="rgb(var(--tm-ink-rgb) / 0.25)" fontFamily="monospace">0</text>
            )}

            {/* Equation curves */}
            {path1 && (
              <path d={path1} fill="none" stroke="rgba(168,85,247,1)" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round" clipPath={`url(#${clipId})`} />
            )}
            {path2 && (
              <path d={path2} fill="none" stroke="rgba(34,211,238,1)" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round" clipPath={`url(#${clipId})`} />
            )}
          </svg>

          {/* Reset view button */}
          <button
            onClick={resetView}
            className="absolute top-2 right-2 px-2 py-1 rounded-lg text-xs text-ink-muted hover:text-ink-muted hover:bg-white/10 transition-all font-mono opacity-0 group-hover:opacity-100"
          >reset</button>

          {/* Resize handle */}
          <div onMouseDown={onResizeStart} className="absolute bottom-1.5 right-1.5 w-5 h-5 flex items-end justify-end cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity">
            <svg width="12" height="12" viewBox="0 0 12 12" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.5)' }}>
              <line x1="4" y1="12" x2="12" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="8" y1="12" x2="12" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── table block ─────────────────────────────────────────────────────

interface TableBlockProps {
  block: Block;
  onChange: (content: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  dragControls: ReturnType<typeof useDragControls>;
}

function TableBlock({ block, onChange, onDelete, onDuplicate, dragControls }: TableBlockProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const parseRows = (): string[][] => {
    try {
      const d = JSON.parse(block.content || '{}');
      if (Array.isArray(d.rows) && d.rows.length > 0) return d.rows;
    } catch { /* empty */ }
    return [['Header 1', 'Header 2', 'Header 3'], ['', '', ''], ['', '', '']];
  };

  const [rows, setRows] = useState<string[][]>(parseRows);

  const save = (newRows: string[][]) => {
    setRows(newRows);
    onChange(JSON.stringify({ rows: newRows }));
  };

  const updateCell = (r: number, c: number, val: string) =>
    save(rows.map((row, ri) => ri === r ? row.map((cell, ci) => ci === c ? val : cell) : [...row]));

  const addRow = () => save([...rows, Array(rows[0]?.length || 3).fill('')]);
  const removeRow = (r: number) => { if (rows.length > 1) save(rows.filter((_, i) => i !== r)); };
  const addCol = () => save(rows.map((row) => [...row, '']));
  const removeCol = (c: number) => { if ((rows[0]?.length || 0) > 1) save(rows.map((row) => row.filter((_, i) => i !== c))); };

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const colCount = rows[0]?.length || 0;

  return (
    <div className="group relative py-2">
      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -left-14 top-2 flex items-center gap-0.5">
        <div ref={menuRef} className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-1 rounded-sm hover:bg-white/10 text-ink-muted">
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {showMenu && (
            <div className="absolute left-0 top-full mt-1 z-50 rounded-xl overflow-hidden min-w-[160px]" style={glassCard}>
              <button onClick={() => { onDuplicate(); setShowMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink hover:bg-white/5 transition-colors">
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </button>
              <button onClick={() => { onDelete(); setShowMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-white/5 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
        <button className="p-1 rounded-sm hover:bg-white/10 text-ink-muted cursor-grab active:cursor-grabbing" onPointerDown={(e) => dragControls.start(e)}>
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden" style={glassCard}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {rows[0]?.map((cell, c) => (
                  <th key={c} className="group/col relative border-b border-r border-white/10 last:border-r-0 text-left p-0">
                    <input
                      value={cell}
                      onChange={(e) => updateCell(0, c, e.target.value)}
                      placeholder={`Col ${c + 1}`}
                      className="w-full bg-transparent outline-hidden px-3 py-2.5 text-sm font-semibold text-ink placeholder-ink-muted min-w-[90px]"
                    />
                    {colCount > 1 && (
                      <button
                        onClick={() => removeCol(c)}
                        className="absolute top-0.5 right-0.5 opacity-0 group-hover/col:opacity-100 w-4 h-4 rounded-sm flex items-center justify-center bg-red-500/20 text-red-400 text-xs hover:bg-red-500/40 transition-all z-10 leading-none"
                      >×</button>
                    )}
                  </th>
                ))}
                <th className="border-b border-white/10 w-8 p-0">
                  <button onClick={addCol} className="w-full h-full flex items-center justify-center py-2.5 hover:bg-white/5 text-ink-muted hover:text-ink-muted transition-colors">
                    <Plus className="w-3 h-3" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((row, rIdx) => {
                const r = rIdx + 1;
                return (
                  <tr key={r} className="group/row border-b border-white/5 last:border-b-0">
                    {row.map((cell, c) => (
                      <td key={c} className="border-r border-white/5 last:border-r-0 p-0">
                        <input
                          value={cell}
                          onChange={(e) => updateCell(r, c, e.target.value)}
                          placeholder="—"
                          className="w-full bg-transparent outline-hidden px-3 py-2 text-sm text-ink placeholder-ink-muted min-w-[90px] hover:bg-white/[0.02] focus:bg-white/[0.03] transition-colors"
                        />
                      </td>
                    ))}
                    <td className="w-8 p-0">
                      {rows.length > 2 && (
                        <button
                          onClick={() => removeRow(r)}
                          className="opacity-0 group-hover/row:opacity-100 w-full flex items-center justify-center py-2 hover:bg-red-500/10 text-red-400/30 hover:text-red-400 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={colCount + 1} className="px-3 py-1.5">
                  <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink-muted transition-colors">
                    <Plus className="w-3 h-3" /> Add row
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── block renderer (textarea-based, no contentEditable) ────────────

interface BlockEditorProps {
  block: Block;
  index: number;
  focused: boolean;
  noteTheme: NoteTheme;
  dragControls: ReturnType<typeof useDragControls>;
  onFocus: () => void;
  onChange: (content: string) => void;
  onChangeType: (type: BlockType) => void;
  onToggleCheck: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onResize?: (w: number, h: number) => void;
  aiPending?: PendingAIEdit | null;
  aiNewBlock?: boolean;
  onAcceptAI?: () => void;
  onRejectAI?: () => void;
}

function BlockEditor({ block, index, focused, noteTheme, dragControls, onFocus, onChange, onChangeType, onToggleCheck, onKeyDown, onDelete, onDuplicate, onResize, aiPending, aiNewBlock, onAcceptAI, onRejectAI }: BlockEditorProps) {
  const themeColors = getNoteTheme(noteTheme);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  // Selection toolbar state
  type SelToolbar = { x: number; y: number; selStart: number; selEnd: number; showColors: false | 'text' | 'bg' };
  const [selToolbar, setSelToolbar] = useState<SelToolbar | null>(null);

  // Hide selection toolbar on outside click
  useEffect(() => {
    if (!selToolbar) return;
    const handle = () => setSelToolbar(null);
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [selToolbar]);

  // Auto-focus when this block becomes focused
  useEffect(() => {
    if (focused && ref.current) {
      ref.current.focus();
      // Move cursor to end
      const len = ref.current.value.length;
      ref.current.setSelectionRange(len, len);
    }
  }, [focused]);

  // Auto-resize textarea
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [block.content, block.type]);

  // Close menus on outside click
  useEffect(() => {
    if (!showMenu && !showTypeMenu) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowTypeMenu(false);
        setSlashFilter('');
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showMenu, showTypeMenu]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;

    // Slash command detection
    if (text.startsWith('/')) {
      setSlashFilter(text.slice(1).toLowerCase());
      setShowTypeMenu(true);
    } else if (showTypeMenu) {
      setShowTypeMenu(false);
      setSlashFilter('');
    }

    onChange(text);
  };

  // Slash command: clear the slash text since user typed "/heading1" etc.
  const handleSlashTypeSelect = (type: BlockType) => {
    onChangeType(type);
    setShowTypeMenu(false);
    setSlashFilter('');
    onChange('');
    setTimeout(() => ref.current?.focus(), 0);
  };

  // Context menu (3-dot): preserve existing content
  const handleContextTypeSelect = (type: BlockType) => {
    onChangeType(type);
    setTimeout(() => ref.current?.focus(), 0);
  };

  const filteredBlockOptions = BLOCK_MENU_OPTIONS.filter(
    (opt) => opt.label.toLowerCase().includes(slashFilter) || opt.type.includes(slashFilter)
  );

  // Selection toolbar: show on mouseup when text is selected
  const handleTextareaMouseUp = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    if (ta.selectionStart !== ta.selectionEnd) {
      setSelToolbar({ x: toLayoutPx(e.clientX), y: toLayoutPx(e.clientY), selStart: ta.selectionStart, selEnd: ta.selectionEnd, showColors: false });
    } else {
      setSelToolbar(null);
    }
  };

  // Apply inline formatting by wrapping selected text with markers
  const applyFormat = (type: string, value?: string) => {
    if (!selToolbar || !ref.current) return;
    const { selStart, selEnd } = selToolbar;
    const text = block.content;
    const selected = text.slice(selStart, selEnd);
    let wrapped = selected;
    if (type === 'bold') wrapped = `**${selected}**`;
    else if (type === 'italic') wrapped = `*${selected}*`;
    else if (type === 'underline') wrapped = `__${selected}__`;
    else if (type === 'color') wrapped = `[color:${value}]${selected}[/color]`;
    else if (type === 'bg') wrapped = `[bg:${value}]${selected}[/bg]`;
    onChange(text.slice(0, selStart) + wrapped + text.slice(selEnd));
    setSelToolbar(null);
    // Restore focus
    setTimeout(() => ref.current?.focus(), 0);
  };

  if (block.type === 'doodle') {
    return (
      <DoodleBlock
        block={block}
        onChange={onChange}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onResize={onResize}
        dragControls={dragControls}
      />
    );
  }

  if (block.type === 'image') {
    return (
      <ImageBlock
        block={block}
        onChange={onChange}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onResize={onResize}
        dragControls={dragControls}
      />
    );
  }

  if (block.type === 'graph') {
    return (
      <GraphBlock
        block={block}
        onChange={onChange}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        dragControls={dragControls}
      />
    );
  }

  if (block.type === 'table') {
    return (
      <TableBlock
        block={block}
        onChange={onChange}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        dragControls={dragControls}
      />
    );
  }

  if (block.type === 'divider') {
    return (
      <div className="group relative flex items-center py-2" onClick={onFocus}>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -left-10 flex items-center gap-1">
          <button onClick={() => setShowMenu(!showMenu)} className="p-1 rounded-sm hover:bg-white/10 text-ink-muted">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
        <div className="w-full h-px bg-white/10" />
      </div>
    );
  }

  const textSizeClass: Record<BlockType, string> = {
    text: 'text-base text-ink',
    'heading1': 'text-3xl font-bold text-white',
    'heading2': 'text-2xl font-semibold text-white',
    'heading3': 'text-xl font-semibold text-ink',
    'bullet-list': 'text-base text-ink',
    'numbered-list': 'text-base text-ink',
    'todo': 'text-base text-ink',
    'quote': 'text-base text-ink-muted italic',
    'code': 'font-mono text-sm text-green-300/90',
    'divider': '',
    'callout': 'text-base text-ink',
    'doodle': '',
    'image': '',
    'graph': '',
    'table': '',
  };

  const wrapperExtra: Record<BlockType, string> = {
    text: '',
    heading1: '',
    heading2: '',
    heading3: '',
    'bullet-list': '',
    'numbered-list': '',
    todo: '',
    quote: `border-l-2 ${themeColors.quoteBorder} pl-4`,
    code: 'bg-white/[0.03] rounded-lg p-3',
    divider: '',
    callout: `${themeColors.calloutBg} border ${themeColors.calloutBorder} rounded-xl p-4`,
    doodle: '',
    image: '',
    graph: '',
    table: '',
  };

  const placeholders: Record<BlockType, string> = {
    text: "Press space for AI, or / for commands",
    'heading1': 'Heading 1',
    'heading2': 'Heading 2',
    'heading3': 'Heading 3',
    'bullet-list': 'List item',
    'numbered-list': 'List item',
    'todo': 'To-do',
    'quote': 'Quote',
    'code': 'Code',
    'divider': '',
    'callout': 'Type something...',
    'doodle': '',
    'image': '',
    'graph': '',
    'table': '',
  };

  const hasAIPending = !!aiPending || !!aiNewBlock;

  return (
    <div className={`tm-notes-block group relative flex items-start py-0.5 transition-all duration-300 ${hasAIPending ? 'rounded-lg -mx-2 px-2' : ''}`}
      style={hasAIPending ? {
        background: `rgba(${themeColors.rgb}, 0.08)`,
        border: `1px solid rgba(${themeColors.rgb}, 0.25)`,
        boxShadow: `0 0 20px rgba(${themeColors.rgb}, 0.1)`,
      } : undefined}
    >
      {/* AI Accept/Reject buttons */}
      {hasAIPending && onAcceptAI && onRejectAI && (
        <div className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full flex items-center gap-1 z-10 ml-2">
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onAcceptAI}
            className="p-1.5 rounded-lg transition-colors"
            style={{
              background: `rgba(${themeColors.rgb}, 0.2)`,
              border: `1px solid rgba(${themeColors.rgb}, 0.3)`,
            }}
            title="Accept"
          >
            <Check className="w-3.5 h-3.5" style={{ color: `rgba(${themeColors.rgb}, 1)` }} />
          </motion.button>
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onRejectAI}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-red-500/20 hover:border-red-500/30 transition-colors"
            title="Reject"
          >
            <X className="w-3.5 h-3.5 text-ink-muted hover:text-red-400" />
          </motion.button>
        </div>
      )}

      {/* AI sparkle indicator */}
      {hasAIPending && (
        <div className="absolute -left-6 top-1/2 -translate-y-1/2">
          <Sparkles className="w-3.5 h-3.5" style={{ color: `rgba(${themeColors.rgb}, 0.7)` }} />
        </div>
      )}

      {/* Hover controls */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -left-14 top-0 flex items-center gap-0.5 pt-1">
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="p-1 rounded-sm hover:bg-white/10 text-ink-muted hover:text-ink-muted transition-colors"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
        <button
          className="p-1 rounded-sm hover:bg-white/10 text-ink-muted hover:text-ink-muted transition-colors cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Block prefix (bullet, number, checkbox) */}
      <div className={`flex items-start gap-2 flex-1 min-w-0 ${wrapperExtra[block.type]}`}>
        {block.type === 'bullet-list' && (
          <span className="text-ink-muted mt-1.5 shrink-0 leading-none">•</span>
        )}
        {block.type === 'numbered-list' && (
          <span className="text-ink-muted mt-1 text-sm font-medium shrink-0 min-w-[1.2em] text-right">{index + 1}.</span>
        )}
        {block.type === 'todo' && (
          <button
            onClick={onToggleCheck}
            className={`mt-1.5 w-4 h-4 rounded-sm border shrink-0 flex items-center justify-center transition-all ${
              block.checked
                ? `${themeColors.checkBg} ${themeColors.checkBorder}`
                : 'border-white/20 hover:border-white/40'
            }`}
          >
            {block.checked && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        )}

        {/* Editable content — textarea when focused, rendered markdown when not */}
        {focused || hasAIPending ? (
          <textarea
            ref={ref}
            value={block.content}
            onChange={handleChange}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            onMouseUp={handleTextareaMouseUp}
            placeholder={placeholders[block.type]}
            rows={1}
            className={`flex-1 bg-transparent outline-hidden resize-none overflow-hidden placeholder-ink-muted ${textSizeClass[block.type]} ${
              block.type === 'todo' && block.checked ? 'line-through text-ink-muted' : ''
            }`}
            style={{ minHeight: '1.5em' }}
            readOnly={hasAIPending}
          />
        ) : (
          <div
            className={`flex-1 min-w-0 cursor-text ${textSizeClass[block.type]} ${
              block.type === 'todo' && block.checked ? 'line-through text-ink-muted' : ''
            }`}
            style={{ minHeight: '1.5em', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            onClick={onFocus}
            dangerouslySetInnerHTML={{
              __html: block.content
                ? renderInline(block.content)
                : `<span style="color:rgb(var(--tm-ink-rgb) / 0.2)">${placeholders[block.type]}</span>`,
            }}
          />
        )}
      </div>

      {/* Selection toolbar */}
      {selToolbar && (
        <div
          className="fixed z-[200] flex flex-col gap-0"
          style={{ left: selToolbar.x - 120, top: selToolbar.y - 52 }}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <div className="flex items-center rounded-xl overflow-hidden shadow-2xl" style={glassCard}>
            {/* Format buttons */}
            <button
              onClick={() => applyFormat('bold')}
              title="Bold (**text**)"
              className="flex items-center justify-center w-9 h-9 hover:bg-white/10 text-ink hover:text-white transition-colors border-r border-white/10"
            ><Bold className="w-3.5 h-3.5" /></button>
            <button
              onClick={() => applyFormat('italic')}
              title="Italic (*text*)"
              className="flex items-center justify-center w-9 h-9 hover:bg-white/10 text-ink hover:text-white transition-colors border-r border-white/10"
            ><Italic className="w-3.5 h-3.5" /></button>
            <button
              onClick={() => applyFormat('underline')}
              title="Underline (__text__)"
              className="flex items-center justify-center w-9 h-9 hover:bg-white/10 text-ink hover:text-white transition-colors border-r border-white/10"
            ><Underline className="w-3.5 h-3.5" /></button>
            {/* Text colour picker */}
            <div className="relative">
              <button
                onClick={() => setSelToolbar((s) => s ? { ...s, showColors: s.showColors === 'text' ? false : 'text' } : s)}
                title="Text colour"
                className="flex items-center justify-center w-9 h-9 hover:bg-white/10 text-ink hover:text-white transition-colors border-r border-white/10"
              ><span className="text-xs font-bold" style={{ textDecoration: 'underline 2px #a855f7' }}>A</span></button>
              {selToolbar.showColors === 'text' && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 flex gap-1 p-1.5 rounded-xl" style={glassCard}>
                  {['#ffffff','#f87171','#fb923c','#fbbf24','#4ade80','#38bdf8','#a78bfa','#f472b6'].map((c) => (
                    <button key={c} onClick={() => applyFormat('color', c)} className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition-transform" style={{ background: c }} />
                  ))}
                </div>
              )}
            </div>
            {/* Background colour picker */}
            <div className="relative">
              <button
                onClick={() => setSelToolbar((s) => s ? { ...s, showColors: s.showColors === 'bg' ? false : 'bg' } : s)}
                title="Highlight colour"
                className="flex items-center justify-center w-9 h-9 hover:bg-white/10 text-ink hover:text-white transition-colors"
              ><Highlighter className="w-3.5 h-3.5" /></button>
              {selToolbar.showColors === 'bg' && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 flex gap-1 p-1.5 rounded-xl" style={glassCard}>
                  {['rgba(168,85,247,0.35)','rgba(248,113,113,0.35)','rgba(251,191,36,0.35)','rgba(74,222,128,0.35)','rgba(56,189,248,0.35)','rgba(255,255,255,0.15)'].map((c, i) => (
                    <button key={i} onClick={() => applyFormat('bg', c)} className="w-5 h-5 rounded-sm border border-white/20 hover:scale-110 transition-transform" style={{ background: c }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Context menu */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={popupExit}
            className="absolute left-0 top-full mt-1 z-50 rounded-xl overflow-hidden min-w-[180px]"
            style={glassCard}
          >
            <div className="py-1">
              <button
                onClick={() => { onDelete(); setShowMenu(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-white/5 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
              <button
                onClick={() => { onDuplicate(); setShowMenu(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink hover:bg-white/5 transition-colors"
              >
                <Copy className="w-4 h-4" /> Duplicate
              </button>
              <div className="border-t border-white/5 my-1" />
              {BLOCK_MENU_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => { handleContextTypeSelect(opt.type); setShowMenu(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/5 transition-colors ${
                    block.type === opt.type ? themeColors.textAccent : 'text-ink'
                  }`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slash command menu */}
      <AnimatePresence>
        {showTypeMenu && filteredBlockOptions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={popupExit}
            className="absolute left-0 top-full mt-1 z-50 rounded-xl overflow-hidden min-w-[240px] max-h-[300px] overflow-y-auto"
            style={glassCard}
          >
            <div className="py-1">
              <p className="px-3 py-1.5 text-xs font-semibold text-ink-muted uppercase tracking-wider">Blocks</p>
              {filteredBlockOptions.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => handleSlashTypeSelect(opt.type)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-ink-muted">
                    {opt.icon}
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-ink font-medium">{opt.label}</p>
                    <p className="text-xs text-ink-muted">{opt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── draggable block wrapper ─────────────────────────────────────────

interface DraggableBlockProps {
  block: Block;
  index: number;
  focused: boolean;
  noteTheme: NoteTheme;
  onFocus: () => void;
  onChange: (content: string) => void;
  onChangeType: (type: BlockType) => void;
  onToggleCheck: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onResize?: (w: number, h: number) => void;
  aiPending?: PendingAIEdit | null;
  aiNewBlock?: boolean;
  onAcceptAI?: () => void;
  onRejectAI?: () => void;
}

export function DraggableBlock(props: DraggableBlockProps) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={props.block}
      dragListener={false}
      dragControls={controls}
      className="list-none"
      whileDrag={{ scale: 1.02, opacity: 0.8 }}
    >
      <BlockEditor
        {...props}
        dragControls={controls}
        aiPending={props.aiPending}
        aiNewBlock={props.aiNewBlock}
        onAcceptAI={props.onAcceptAI}
        onRejectAI={props.onRejectAI}
      />
    </Reorder.Item>
  );
}
