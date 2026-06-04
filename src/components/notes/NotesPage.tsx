import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  MoreHorizontal,
  Search,
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
  FileText,
  Clock,
  Star,
  StarOff,
  Palette,
  Check,
  X,
  Sparkles,
  Loader2,
  Send,
  PanelLeftOpen,
  PanelLeftClose,
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
import { useTheme } from '../../context/ThemeContext';
import { sendNotesAIRequest } from '../../services/ai/notesAiService';

// ─── types ──────────────────────────────────────────────────────────

type BlockType =
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

interface Block {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  width?: number;
  height?: number;
}

type NoteTheme = 'purple' | 'blue' | 'green' | 'pink' | 'orange' | 'red' | 'cyan' | 'yellow';

interface Note {
  id: string;
  title: string;
  blocks: Block[];
  createdAt: string;
  updatedAt: string;
  starred: boolean;
  emoji?: string;
  noteTheme?: NoteTheme;
}

// ─── AI co-pilot types ──────────────────────────────────────────────

interface PendingAIEdit {
  blockId: string;
  originalContent: string;
  originalType: BlockType;
  newContent: string;
  newType?: BlockType;
}

interface PendingNewBlock {
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

const glassCard = {
  background: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
} as const;

const uid = () => Math.random().toString(36).slice(2, 10);

const emptyBlock = (): Block => ({ id: uid(), type: 'text', content: '' });

const STORAGE_KEY = 'tm-notes';

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: 'Smileys', emojis: ['😀', '😂', '🥹', '😍', '🤩', '😎', '🥳', '🤔', '😴', '🫠', '🤗', '😇'] },
  { label: 'Objects', emojis: ['📝', '📒', '📕', '📗', '📘', '📙', '📓', '📔', '📖', '🗒️', '📋', '📎'] },
  { label: 'Symbols', emojis: ['⭐', '🔥', '💡', '❤️', '🎯', '🚀', '✨', '💎', '🏆', '🎨', '🎵', '⚡'] },
  { label: 'Nature', emojis: ['🌸', '🌻', '🍀', '🌈', '🌙', '☀️', '🌊', '🍁', '🌺', '🦋', '🐝', '🌿'] },
  { label: 'Food', emojis: ['☕', '🍕', '🍩', '🧁', '🍎', '🍓', '🫐', '🍰', '🍪', '🧋', '🥑', '🍫'] },
  { label: 'Travel', emojis: ['🏠', '🏖️', '⛰️', '🗺️', '✈️', '🚗', '🛸', '🎡', '🏕️', '🌃', '🗼', '🎢'] },
];

interface NoteThemeConfig {
  key: NoteTheme;
  label: string;
  dot: string;
  // rgba base for dynamic opacity usage
  rgb: string;
  // block accents
  checkBg: string;
  checkBorder: string;
  quoteBorder: string;
  calloutBg: string;
  calloutBorder: string;
  // editor area
  editorGradient: string;
  editorGlow: string;
  // text accent for active type in context menu
  textAccent: string;
}

const NOTE_THEMES: NoteThemeConfig[] = [
  // Purple — from Default/Air persona: rgba(168, 85, 247)
  {
    key: 'purple', label: 'Purple', dot: 'bg-purple-500', rgb: '168, 85, 247',
    checkBg: 'bg-purple-500', checkBorder: 'border-purple-400',
    quoteBorder: 'border-purple-400/50', calloutBg: 'bg-purple-500/10', calloutBorder: 'border-purple-500/20',
    editorGradient: 'linear-gradient(180deg, rgba(168,85,247,0.06) 0%, rgba(168,85,247,0.02) 40%, transparent 100%)',
    editorGlow: '0 0 80px rgba(168,85,247,0.08)',
    textAccent: 'text-purple-400',
  },
  // Pink — from Girlie persona: rgba(236, 72, 153)
  {
    key: 'pink', label: 'Pink', dot: 'bg-pink-500', rgb: '236, 72, 153',
    checkBg: 'bg-pink-500', checkBorder: 'border-pink-400',
    quoteBorder: 'border-pink-400/50', calloutBg: 'bg-pink-500/10', calloutBorder: 'border-pink-500/20',
    editorGradient: 'linear-gradient(180deg, rgba(236,72,153,0.06) 0%, rgba(236,72,153,0.02) 40%, transparent 100%)',
    editorGlow: '0 0 80px rgba(236,72,153,0.08)',
    textAccent: 'text-pink-400',
  },
  // Cyan — from Pro persona: rgba(34, 211, 238)
  {
    key: 'cyan', label: 'Cyan', dot: 'bg-cyan-400', rgb: '34, 211, 238',
    checkBg: 'bg-cyan-500', checkBorder: 'border-cyan-400',
    quoteBorder: 'border-cyan-400/50', calloutBg: 'bg-cyan-500/10', calloutBorder: 'border-cyan-500/20',
    editorGradient: 'linear-gradient(180deg, rgba(34,211,238,0.06) 0%, rgba(34,211,238,0.02) 40%, transparent 100%)',
    editorGlow: '0 0 80px rgba(34,211,238,0.08)',
    textAccent: 'text-cyan-400',
  },
  // Blue
  {
    key: 'blue', label: 'Blue', dot: 'bg-blue-500', rgb: '59, 130, 246',
    checkBg: 'bg-blue-500', checkBorder: 'border-blue-400',
    quoteBorder: 'border-blue-400/50', calloutBg: 'bg-blue-500/10', calloutBorder: 'border-blue-500/20',
    editorGradient: 'linear-gradient(180deg, rgba(59,130,246,0.06) 0%, rgba(59,130,246,0.02) 40%, transparent 100%)',
    editorGlow: '0 0 80px rgba(59,130,246,0.08)',
    textAccent: 'text-blue-400',
  },
  // Green
  {
    key: 'green', label: 'Green', dot: 'bg-green-500', rgb: '34, 197, 94',
    checkBg: 'bg-green-500', checkBorder: 'border-green-400',
    quoteBorder: 'border-green-400/50', calloutBg: 'bg-green-500/10', calloutBorder: 'border-green-500/20',
    editorGradient: 'linear-gradient(180deg, rgba(34,197,94,0.06) 0%, rgba(34,197,94,0.02) 40%, transparent 100%)',
    editorGlow: '0 0 80px rgba(34,197,94,0.08)',
    textAccent: 'text-green-400',
  },
  // Orange
  {
    key: 'orange', label: 'Orange', dot: 'bg-orange-500', rgb: '249, 115, 22',
    checkBg: 'bg-orange-500', checkBorder: 'border-orange-400',
    quoteBorder: 'border-orange-400/50', calloutBg: 'bg-orange-500/10', calloutBorder: 'border-orange-500/20',
    editorGradient: 'linear-gradient(180deg, rgba(249,115,22,0.06) 0%, rgba(249,115,22,0.02) 40%, transparent 100%)',
    editorGlow: '0 0 80px rgba(249,115,22,0.08)',
    textAccent: 'text-orange-400',
  },
  // Red
  {
    key: 'red', label: 'Red', dot: 'bg-red-500', rgb: '239, 68, 68',
    checkBg: 'bg-red-500', checkBorder: 'border-red-400',
    quoteBorder: 'border-red-400/50', calloutBg: 'bg-red-500/10', calloutBorder: 'border-red-500/20',
    editorGradient: 'linear-gradient(180deg, rgba(239,68,68,0.06) 0%, rgba(239,68,68,0.02) 40%, transparent 100%)',
    editorGlow: '0 0 80px rgba(239,68,68,0.08)',
    textAccent: 'text-red-400',
  },
  // Yellow
  {
    key: 'yellow', label: 'Yellow', dot: 'bg-yellow-500', rgb: '234, 179, 8',
    checkBg: 'bg-yellow-500', checkBorder: 'border-yellow-400',
    quoteBorder: 'border-yellow-400/50', calloutBg: 'bg-yellow-500/10', calloutBorder: 'border-yellow-500/20',
    editorGradient: 'linear-gradient(180deg, rgba(234,179,8,0.06) 0%, rgba(234,179,8,0.02) 40%, transparent 100%)',
    editorGlow: '0 0 80px rgba(234,179,8,0.08)',
    textAccent: 'text-yellow-400',
  },
];

function getNoteTheme(key?: NoteTheme) {
  return NOTE_THEMES.find((t) => t.key === key) || NOTE_THEMES[0];
}

// ─── persistence ────────────────────────────────────────────────────

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotes(notes: Note[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

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
      ctx.fillStyle = 'rgba(0,0,0,1)';
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
      ctx.strokeStyle = 'rgba(0,0,0,1)';
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
            className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {showMenu && (
            <div className="absolute left-0 top-full mt-1 z-50 rounded-xl overflow-hidden min-w-[160px]" style={glassCard}>
              <button
                onClick={() => { onDuplicate(); setShowMenu(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors"
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
          className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors cursor-grab active:cursor-grabbing"
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
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
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
              background: showPalette ? 'rgba(255,255,255,0.2)' : 'rgba(20,20,20,0.7)',
              border: '1px solid rgba(255,255,255,0.2)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}
          >
            {tool === 'eraser'
              ? <Eraser className="w-4 h-4 text-white/80" />
              : <div className="w-4 h-4 flex items-center justify-center"><Pencil className="w-4 h-4" style={{ color }} /></div>
            }
          </button>

          {/* Draw palette */}
          {showPalette && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.97 }}
              className="absolute bottom-11 left-0 p-3 rounded-2xl z-30"
              style={{
                background: 'rgba(15,15,15,0.92)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                minWidth: 160,
              }}
            >
              {/* Pen / Eraser toggle */}
              <div className="flex gap-1.5 mb-3">
                <button
                  onClick={() => setTool('pen')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    tool === 'pen' ? 'bg-white/20 text-white' : 'text-white/40 hover:bg-white/10'
                  }`}
                >
                  <Pencil className="w-3 h-3" /> Pen
                </button>
                <button
                  onClick={() => setTool('eraser')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    tool === 'eraser' ? 'bg-white/20 text-white' : 'text-white/40 hover:bg-white/10'
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
                      border: `2px solid ${color === c && tool === 'pen' ? 'white' : 'rgba(255,255,255,0.15)'}`,
                    }}
                  />
                ))}
              </div>

              {/* Brush size */}
              <div className="flex items-center gap-2">
                <span className="text-white/30 text-[10px] shrink-0">Size</span>
                <input
                  type="range"
                  min={1}
                  max={24}
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="flex-1 accent-white"
                  style={{ height: 4 }}
                />
                <span className="text-white/30 text-[10px] w-4 text-right">{brushSize}</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={onResizeStart}
          className="absolute bottom-1.5 right-1.5 w-5 h-5 flex items-end justify-end cursor-se-resize"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" className="text-white/25">
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
  }, [block.content]);

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
            className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {showMenu && (
            <div className="absolute left-0 top-full mt-1 z-50 rounded-xl overflow-hidden min-w-[160px]" style={glassCard}>
              <button
                onClick={() => { onDuplicate(); setShowMenu(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors"
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
          className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors cursor-grab active:cursor-grabbing"
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
            className="absolute top-2 right-2 px-2 py-1 rounded-lg text-xs text-white/70 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
            style={{
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            Replace
          </button>
          {/* Resize handle */}
          <div
            onMouseDown={onResizeStart}
            className="absolute bottom-1.5 right-1.5 w-5 h-5 flex items-end justify-end cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" style={{ color: 'rgba(255,255,255,0.6)' }}>
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
          className="w-full flex flex-col items-center justify-center gap-2 py-10 rounded-2xl text-white/30 hover:text-white/50 transition-all"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1.5px dashed rgba(255, 255, 255, 0.1)',
          }}
        >
          <ImagePlus className="w-8 h-8" />
          <span className="text-sm">Click or drop an image</span>
        </button>
      )}
    </div>
  );
}

// ─── inline markdown renderer ────────────────────────────────────────

function renderInline(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
    .replace(/\*([^*\n]+?)\*/gs, '<em>$1</em>')
    .replace(/__(.+?)__/gs, '<u>$1</u>')
    .replace(/\[color:([^\]]+)\](.*?)\[\/color\]/gs, '<span style="color:$1">$2</span>')
    .replace(/\[bg:([^\]]+)\](.*?)\[\/bg\]/gs, '<span style="background-color:$1;border-radius:3px;padding:0 2px">$2</span>')
    .replace(/\n/g, '<br>');
}

// ─── graph block ─────────────────────────────────────────────────────

// Convert natural math notation to JS-evaluable expression
function parseMathExpr(input: string): string {
  if (!input.trim()) return '';
  let s = input.trim();

  // Strip "y =", "f(x) =", "g(x) =" prefixes
  s = s.replace(/^\s*[yfg]\s*\(\s*x\s*\)\s*=\s*/i, '');
  s = s.replace(/^\s*y\s*=\s*/i, '');

  // Handle |expr| → abs(expr), iteratively for nested
  let prev = '';
  while (prev !== s) { prev = s; s = s.replace(/\|([^|]+)\|/, 'abs($1)'); }

  // Replace ^ with ** (before function names to avoid conflict)
  s = s.replace(/\^/g, '**');

  // Replace functions — longer/specific names first to avoid partial replacement
  const fns: [RegExp, string][] = [
    [/\bsqrt\b/g, 'Math.sqrt'], [/\bcbrt\b/g, 'Math.cbrt'],
    [/\bsinh\b/g, 'Math.sinh'], [/\bcosh\b/g, 'Math.cosh'], [/\btanh\b/g, 'Math.tanh'],
    [/\basin\b/g, 'Math.asin'], [/\bacos\b/g, 'Math.acos'], [/\batan2\b/g, 'Math.atan2'], [/\batan\b/g, 'Math.atan'],
    [/\bsin\b/g,  'Math.sin'],  [/\bcos\b/g,  'Math.cos'],  [/\btan\b/g,  'Math.tan'],
    [/\babs\b/g,  'Math.abs'],  [/\bsign\b/g, 'Math.sign'], [/\bhypot\b/g, 'Math.hypot'],
    [/\bln\b/g,   'Math.log'],  [/\blog10\b/g,'Math.log10'],[/\blog2\b/g, 'Math.log2'],
    [/\blog\b/g,  'Math.log10'],[/\bexp\b/g,  'Math.exp'],
    [/\bceil\b/g, 'Math.ceil'], [/\bfloor\b/g,'Math.floor'],[/\bround\b/g,'Math.round'],
    [/\btrunc\b/g,'Math.trunc'],[/\bpow\b/g,  'Math.pow'],  [/\bmax\b/g,  'Math.max'],
    [/\bmin\b/g,  'Math.min'],  [/\bmod\b/g,  '%'],
  ];
  for (const [re, rep] of fns) s = s.replace(re, rep);

  // Replace constants
  s = s.replace(/\bpi\b/gi, 'Math.PI');
  s = s.replace(/π/g, 'Math.PI');
  s = s.replace(/\be\b/g, 'Math.E');
  s = s.replace(/∞/g, 'Infinity');

  // Implicit multiplication (after function/constant replacement)
  s = s.replace(/(\d)(x)(?!\w)/g, '$1*$2');            // 3x → 3*x
  s = s.replace(/(\d)\s*\(/g, '$1*(');                  // 3( → 3*(
  s = s.replace(/\)\s*\(/g, ')*(');                     // )( → )*(
  s = s.replace(/\)\s*x(?!\w)/g, ')*x');               // )x → )*x
  s = s.replace(/\)\s*(\d)/g, ')*$1');                  // )3 → )*3
  s = s.replace(/x\s*\(/g, 'x*(');                      // x( → x*(
  s = s.replace(/(\d)\s*(Math\.)/g, '$1*$2');           // 3Math. → 3*Math.
  s = s.replace(/\)\s*(Math\.)/g, ')*$2');              // )Math. → )*Math.
  s = s.replace(/x\s*(Math\.)/g, 'x*$2');              // xMath. → x*Math.

  return s;
}

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
  const [err1, setErr1] = useState(false);
  const [err2, setErr2] = useState(false);

  // View: cx/cy = math coords at SVG center, scale = pixels per math unit
  const [view, setView] = useState({ cx: 0, cy: 0, scale: 50 });
  const panRef = useRef<{ mx: number; my: number; cx: number; cy: number } | null>(null);

  const W = 500, H = 320;

  const toSvgX = useCallback((x: number) => W / 2 + (x - view.cx) * view.scale, [view]);
  const toSvgY = useCallback((y: number) => H / 2 - (y - view.cy) * view.scale, [view]);
  const toMathX = useCallback((sx: number) => (sx - W / 2) / view.scale + view.cx, [view]);
  const toMathY = useCallback((sy: number) => -(sy - H / 2) / view.scale + view.cy, [view]);

  // Build evaluator from equation string
  const buildEval = useCallback((eq: string): ((x: number) => number | null) | null => {
    const js = parseMathExpr(eq);
    if (!js) return null;
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('x', `"use strict"; try { const _v=(${js}); return (typeof _v==='number'&&isFinite(_v))?_v:null; } catch(e){return null;}`);
      return fn as (x: number) => number | null;
    } catch { return null; }
  }, []);

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
  const { path1, path2 } = useMemo(() => {
    const fn1 = buildEval(eq1);
    setErr1(eq1.trim() !== '' && fn1 === null);
    const fn2 = eq2.trim() ? buildEval(eq2) : null;
    setErr2(eq2.trim() !== '' && fn2 === null);
    return {
      path1: fn1 ? genPath(fn1) : '',
      path2: fn2 ? genPath(fn2) : '',
    };
  }, [eq1, eq2, view, buildEval, genPath]);

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
          <button onClick={() => setShowMenu(!showMenu)} className="p-1 rounded hover:bg-white/10 text-white/30">
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {showMenu && (
            <div className="absolute left-0 top-full mt-1 z-50 rounded-xl overflow-hidden min-w-[160px]" style={glassCard}>
              <button onClick={() => { onDuplicate(); setShowMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors">
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </button>
              <button onClick={() => { onDelete(); setShowMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-white/5 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
        <button className="p-1 rounded hover:bg-white/10 text-white/30 cursor-grab active:cursor-grabbing" onPointerDown={(e) => dragControls.start(e)}>
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ ...glassCard, width: displayW, maxWidth: '100%' }}>
        {/* Equation inputs */}
        <div className="flex flex-col gap-1 px-4 py-3 border-b border-white/5">
          {/* Eq 1 */}
          <div className={`flex items-center gap-2 rounded-lg px-2 py-1 transition-colors ${err1 ? 'bg-red-500/10' : ''}`}>
            <div className="w-2.5 h-2.5 rounded-full bg-purple-400 shrink-0" />
            <span className="text-xs text-white/30 font-mono shrink-0">y =</span>
            <input
              type="text"
              value={eq1}
              onChange={(e) => { setEq1(e.target.value); commit(e.target.value, eq2); }}
              placeholder="sin(x)"
              spellCheck={false}
              className={`flex-1 bg-transparent outline-none text-sm font-mono ${err1 ? 'text-red-300' : 'text-white/85'} placeholder-white/20`}
            />
            {err1 && <span className="text-[10px] text-red-400 shrink-0">invalid</span>}
          </div>
          {/* Eq 2 */}
          <div className={`flex items-center gap-2 rounded-lg px-2 py-1 transition-colors ${err2 ? 'bg-red-500/10' : ''}`}>
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0" />
            <span className="text-xs text-white/30 font-mono shrink-0">y =</span>
            <input
              type="text"
              value={eq2}
              onChange={(e) => { setEq2(e.target.value); commit(eq1, e.target.value); }}
              placeholder="optional 2nd equation"
              spellCheck={false}
              className={`flex-1 bg-transparent outline-none text-sm font-mono ${err2 ? 'text-red-300' : 'text-white/40'} placeholder-white/20`}
            />
            {err2 && <span className="text-[10px] text-red-400 shrink-0">invalid</span>}
          </div>
          <p className="text-[10px] text-white/20 font-mono mt-0.5 leading-relaxed">
            Supports: <span className="text-white/35">x^2 · 2x · sin(x) · cos(x) · tan(x) · sqrt(x) · abs(x) · ln(x) · log(x) · e^x · pi · |x| · (a+b)(a-b)</span>
            &nbsp;·&nbsp; Scroll to zoom · Drag to pan
          </p>
        </div>

        {/* SVG Graph */}
        <div className="relative select-none" style={{ background: 'rgba(0,0,0,0.18)' }}>
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
              <line key={`g${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="rgba(255,255,255,0.045)" strokeWidth="1" />
            ))}

            {/* Axes */}
            <line x1={0} y1={axisY} x2={W} y2={axisY} stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" />
            <line x1={axisX} y1={0} x2={axisX} y2={H} stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" />

            {/* Tick marks + labels — x axis */}
            {xTicks.map((t, i) => (
              <g key={`xt${i}`}>
                <line x1={t.sx} y1={axisY - 3} x2={t.sx} y2={axisY + 3} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
                <text
                  x={t.sx}
                  y={Math.min(H - 4, Math.max(14, axisY + 14))}
                  textAnchor="middle"
                  fontSize="9"
                  fill="rgba(255,255,255,0.4)"
                  fontFamily="monospace"
                >{formatTick(t.v)}</text>
              </g>
            ))}

            {/* Tick marks + labels — y axis */}
            {yTicks.map((t, i) => (
              <g key={`yt${i}`}>
                <line x1={axisX - 3} y1={t.sy} x2={axisX + 3} y2={t.sy} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
                <text
                  x={Math.max(28, Math.min(W - 8, axisX - 6))}
                  y={t.sy + 3.5}
                  textAnchor="end"
                  fontSize="9"
                  fill="rgba(255,255,255,0.4)"
                  fontFamily="monospace"
                >{formatTick(t.v)}</text>
              </g>
            ))}

            {/* Axis labels */}
            <text x={W - 8} y={Math.min(H - 5, Math.max(14, axisY - 7))} fontSize="12" fill="rgba(255,255,255,0.45)" fontStyle="italic" fontFamily="serif">x</text>
            <text x={Math.max(8, Math.min(W - 14, axisX + 7))} y={12} fontSize="12" fill="rgba(255,255,255,0.45)" fontStyle="italic" fontFamily="serif">y</text>

            {/* Origin label */}
            {axisX > 10 && axisX < W - 10 && axisY > 10 && axisY < H - 10 && (
              <text x={axisX - 6} y={axisY + 13} textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.25)" fontFamily="monospace">0</text>
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
            className="absolute top-2 right-2 px-2 py-1 rounded-lg text-[10px] text-white/30 hover:text-white/60 hover:bg-white/10 transition-all font-mono opacity-0 group-hover:opacity-100"
          >reset</button>

          {/* Resize handle */}
          <div onMouseDown={onResizeStart} className="absolute bottom-1.5 right-1.5 w-5 h-5 flex items-end justify-end cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity">
            <svg width="12" height="12" viewBox="0 0 12 12" style={{ color: 'rgba(255,255,255,0.5)' }}>
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
          <button onClick={() => setShowMenu(!showMenu)} className="p-1 rounded hover:bg-white/10 text-white/30">
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {showMenu && (
            <div className="absolute left-0 top-full mt-1 z-50 rounded-xl overflow-hidden min-w-[160px]" style={glassCard}>
              <button onClick={() => { onDuplicate(); setShowMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors">
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </button>
              <button onClick={() => { onDelete(); setShowMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-white/5 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
        <button className="p-1 rounded hover:bg-white/10 text-white/30 cursor-grab active:cursor-grabbing" onPointerDown={(e) => dragControls.start(e)}>
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
                      className="w-full bg-transparent outline-none px-3 py-2.5 text-sm font-semibold text-white/90 placeholder-white/20 min-w-[90px]"
                    />
                    {colCount > 1 && (
                      <button
                        onClick={() => removeCol(c)}
                        className="absolute top-0.5 right-0.5 opacity-0 group-hover/col:opacity-100 w-4 h-4 rounded flex items-center justify-center bg-red-500/20 text-red-400 text-[10px] hover:bg-red-500/40 transition-all z-10 leading-none"
                      >×</button>
                    )}
                  </th>
                ))}
                <th className="border-b border-white/10 w-8 p-0">
                  <button onClick={addCol} className="w-full h-full flex items-center justify-center py-2.5 hover:bg-white/5 text-white/20 hover:text-white/50 transition-colors">
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
                          className="w-full bg-transparent outline-none px-3 py-2 text-sm text-white/70 placeholder-white/10 min-w-[90px] hover:bg-white/[0.02] focus:bg-white/[0.03] transition-colors"
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
                  <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-white/20 hover:text-white/50 transition-colors">
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
      setSelToolbar({ x: e.clientX, y: e.clientY, selStart: ta.selectionStart, selEnd: ta.selectionEnd, showColors: false });
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
          <button onClick={() => setShowMenu(!showMenu)} className="p-1 rounded hover:bg-white/10 text-white/30">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
        <div className="w-full h-px bg-white/10" />
      </div>
    );
  }

  const textSizeClass: Record<BlockType, string> = {
    text: 'text-base text-white/80',
    'heading1': 'text-3xl font-bold text-white',
    'heading2': 'text-2xl font-semibold text-white',
    'heading3': 'text-xl font-semibold text-white/90',
    'bullet-list': 'text-base text-white/80',
    'numbered-list': 'text-base text-white/80',
    'todo': 'text-base text-white/80',
    'quote': 'text-base text-white/60 italic',
    'code': 'font-mono text-sm text-green-300/90',
    'divider': '',
    'callout': 'text-base text-white/80',
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
    text: "Type '/' for commands...",
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
    <div className={`group relative flex items-start py-0.5 transition-all duration-300 ${hasAIPending ? 'rounded-lg -mx-2 px-2' : ''}`}
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
            <X className="w-3.5 h-3.5 text-white/50 hover:text-red-400" />
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
          className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
        <button
          className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Block prefix (bullet, number, checkbox) */}
      <div className={`flex items-start gap-2 flex-1 min-w-0 ${wrapperExtra[block.type]}`}>
        {block.type === 'bullet-list' && (
          <span className="text-white/40 mt-1.5 shrink-0 leading-none">•</span>
        )}
        {block.type === 'numbered-list' && (
          <span className="text-white/40 mt-1 text-sm font-medium shrink-0 min-w-[1.2em] text-right">{index + 1}.</span>
        )}
        {block.type === 'todo' && (
          <button
            onClick={onToggleCheck}
            className={`mt-1.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all ${
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
            className={`flex-1 bg-transparent outline-none resize-none overflow-hidden placeholder-white/20 ${textSizeClass[block.type]} ${
              block.type === 'todo' && block.checked ? 'line-through text-white/40' : ''
            }`}
            style={{ minHeight: '1.5em' }}
            readOnly={hasAIPending}
          />
        ) : (
          <div
            className={`flex-1 min-w-0 cursor-text ${textSizeClass[block.type]} ${
              block.type === 'todo' && block.checked ? 'line-through text-white/40' : ''
            }`}
            style={{ minHeight: '1.5em', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            onClick={onFocus}
            dangerouslySetInnerHTML={{
              __html: block.content
                ? renderInline(block.content)
                : `<span style="color:rgba(255,255,255,0.2)">${placeholders[block.type]}</span>`,
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
              className="flex items-center justify-center w-9 h-9 hover:bg-white/10 text-white/70 hover:text-white transition-colors border-r border-white/10"
            ><Bold className="w-3.5 h-3.5" /></button>
            <button
              onClick={() => applyFormat('italic')}
              title="Italic (*text*)"
              className="flex items-center justify-center w-9 h-9 hover:bg-white/10 text-white/70 hover:text-white transition-colors border-r border-white/10"
            ><Italic className="w-3.5 h-3.5" /></button>
            <button
              onClick={() => applyFormat('underline')}
              title="Underline (__text__)"
              className="flex items-center justify-center w-9 h-9 hover:bg-white/10 text-white/70 hover:text-white transition-colors border-r border-white/10"
            ><Underline className="w-3.5 h-3.5" /></button>
            {/* Text colour picker */}
            <div className="relative">
              <button
                onClick={() => setSelToolbar((s) => s ? { ...s, showColors: s.showColors === 'text' ? false : 'text' } : s)}
                title="Text colour"
                className="flex items-center justify-center w-9 h-9 hover:bg-white/10 text-white/70 hover:text-white transition-colors border-r border-white/10"
              ><span className="text-[11px] font-bold" style={{ textDecoration: 'underline 2px #a855f7' }}>A</span></button>
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
                className="flex items-center justify-center w-9 h-9 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              ><Highlighter className="w-3.5 h-3.5" /></button>
              {selToolbar.showColors === 'bg' && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 flex gap-1 p-1.5 rounded-xl" style={glassCard}>
                  {['rgba(168,85,247,0.35)','rgba(248,113,113,0.35)','rgba(251,191,36,0.35)','rgba(74,222,128,0.35)','rgba(56,189,248,0.35)','rgba(255,255,255,0.15)'].map((c, i) => (
                    <button key={i} onClick={() => applyFormat('bg', c)} className="w-5 h-5 rounded border border-white/20 hover:scale-110 transition-transform" style={{ background: c }} />
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
            exit={{ opacity: 0, scale: 0.95 }}
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
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors"
              >
                <Copy className="w-4 h-4" /> Duplicate
              </button>
              <div className="border-t border-white/5 my-1" />
              {BLOCK_MENU_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => { handleContextTypeSelect(opt.type); setShowMenu(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/5 transition-colors ${
                    block.type === opt.type ? themeColors.textAccent : 'text-white/70'
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
            exit={{ opacity: 0, y: -4 }}
            className="absolute left-0 top-full mt-1 z-50 rounded-xl overflow-hidden min-w-[240px] max-h-[300px] overflow-y-auto"
            style={glassCard}
          >
            <div className="py-1">
              <p className="px-3 py-1.5 text-[10px] font-semibold text-white/30 uppercase tracking-wider">Blocks</p>
              {filteredBlockOptions.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => handleSlashTypeSelect(opt.type)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/50">
                    {opt.icon}
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-white/80 font-medium">{opt.label}</p>
                    <p className="text-[11px] text-white/30">{opt.description}</p>
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

// ─── sidebar note list ──────────────────────────────────────────────

interface NoteSidebarProps {
  notes: Note[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onToggleStar: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
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

function DraggableBlock(props: DraggableBlockProps) {
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

// ─── sidebar note list ──────────────────────────────────────────────

function NoteSidebar({ notes, activeId, onSelect, onNew, onDelete, onToggleStar, searchQuery, onSearchChange }: NoteSidebarProps) {
  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.blocks.some((b) => !['doodle', 'image', 'graph', 'table'].includes(b.type) && b.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const starred = filtered.filter((n) => n.starred);
  const unstarred = filtered.filter((n) => !n.starred);

  const renderItem = (note: Note) => (
    <motion.button
      key={note.id}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(note.id)}
      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200 group ${
        activeId === note.id ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg mt-0.5 shrink-0">{note.emoji || '📝'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white/80 truncate">{note.title || 'Untitled'}</p>
          <p className="text-[11px] text-white/25 truncate mt-0.5">
            {new Date(note.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' · '}
            {note.blocks.filter((b) => b.content).length} blocks
          </p>
        </div>
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleStar(note.id); }}
            className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-yellow-400 transition-colors"
          >
            {note.starred ? <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> : <StarOff className="w-3 h-3" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
            className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.button>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="px-3 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search notes..."
            className="w-full pl-8 pr-3 py-2 rounded-xl text-sm text-white/70 placeholder-white/20 outline-none transition-colors"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          />
        </div>
      </div>

      {/* New note button */}
      <div className="px-3 pb-3">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-white/70 transition-all"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Plus className="w-4 h-4" /> New Note
        </motion.button>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 space-y-0.5">
        {starred.length > 0 && (
          <>
            <p className="px-3 py-1 text-[10px] font-semibold text-white/20 uppercase tracking-wider">Starred</p>
            {starred.map(renderItem)}
            <div className="h-2" />
          </>
        )}
        {unstarred.length > 0 && (
          <>
            {starred.length > 0 && (
              <p className="px-3 py-1 text-[10px] font-semibold text-white/20 uppercase tracking-wider">All Notes</p>
            )}
            {unstarred.map(renderItem)}
          </>
        )}
        {filtered.length === 0 && (
          <div className="text-center py-8">
            <FileText className="w-8 h-8 text-white/10 mx-auto mb-2" />
            <p className="text-sm text-white/20">{searchQuery ? 'No matches' : 'No notes yet'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── main page ──────────────────────────────────────────────────────

export function NotesPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedBlockIndex, setFocusedBlockIndex] = useState<number | null>(null);
  const [showSidebar, setShowSidebar] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const themeDropdownRef = useRef<HTMLDivElement>(null);

  const activeNote = useMemo(() => notes.find((n) => n.id === activeNoteId) || null, [notes, activeNoteId]);

  // Close emoji picker / theme dropdown on outside click
  useEffect(() => {
    if (!showEmojiPicker && !showThemeDropdown) return;
    const handle = (e: MouseEvent) => {
      if (showEmojiPicker && emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (showThemeDropdown && themeDropdownRef.current && !themeDropdownRef.current.contains(e.target as Node)) {
        setShowThemeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showEmojiPicker, showThemeDropdown]);

  // Persist notes
  useEffect(() => { saveNotes(notes); }, [notes]);

  // Auto-select first or create one
  useEffect(() => {
    if (notes.length === 0) {
      handleNewNote();
    } else if (!activeNoteId) {
      setActiveNoteId(notes[0].id);
    }
  }, []);

  const handleNewNote = useCallback(() => {
    const note: Note = {
      id: uid(),
      title: '',
      blocks: [emptyBlock()],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      starred: false,
      emoji: '📝',
    };
    setNotes((prev) => [note, ...prev]);
    setActiveNoteId(note.id);
    setFocusedBlockIndex(0);
  }, []);

  const updateNote = useCallback((id: string, updater: (note: Note) => Note) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...updater(n), updatedAt: new Date().toISOString() } : n))
    );
  }, []);

  const handleDeleteNote = useCallback((id: string) => {
    setNotes((prev) => {
      const filtered = prev.filter((n) => n.id !== id);
      if (activeNoteId === id) {
        setActiveNoteId(filtered[0]?.id || null);
      }
      return filtered;
    });
  }, [activeNoteId]);

  const handleToggleStar = useCallback((id: string) => {
    updateNote(id, (n) => ({ ...n, starred: !n.starred }));
  }, [updateNote]);

  // Block operations
  const updateBlock = useCallback((blockId: string, updates: Partial<Block>) => {
    if (!activeNoteId) return;
    updateNote(activeNoteId, (n) => ({
      ...n,
      blocks: n.blocks.map((b) => (b.id === blockId ? { ...b, ...updates } : b)),
    }));
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
    if (!activeNoteId || !activeNote) return;
    if (activeNote.blocks.length <= 1) return;
    updateNote(activeNoteId, (n) => ({
      ...n,
      blocks: n.blocks.filter((_, i) => i !== index),
    }));
    setFocusedBlockIndex(Math.max(0, index - 1));
  }, [activeNoteId, activeNote, updateNote]);

  const duplicateBlock = useCallback((index: number) => {
    if (!activeNoteId || !activeNote) return;
    const block = activeNote.blocks[index];
    const copy: Block = { ...block, id: uid() };
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      insertBlockAfter(index);
    } else if (e.key === 'Backspace' && activeNote?.blocks[index]?.content === '') {
      e.preventDefault();
      deleteBlock(index);
    } else if (e.key === 'ArrowUp' && index > 0) {
      const textarea = e.target as HTMLTextAreaElement;
      if (textarea.selectionStart === 0) {
        e.preventDefault();
        setFocusedBlockIndex(index - 1);
      }
    } else if (e.key === 'ArrowDown' && activeNote && index < activeNote.blocks.length - 1) {
      const textarea = e.target as HTMLTextAreaElement;
      if (textarea.selectionStart === textarea.value.length) {
        e.preventDefault();
        setFocusedBlockIndex(index + 1);
      }
    }
  }, [activeNote, insertBlockAfter, deleteBlock]);

  // ─── AI Co-pilot State ────────────────────────────────────────────
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [pendingEdits, setPendingEdits] = useState<PendingAIEdit[]>([]);
  const [pendingNewBlocks, setPendingNewBlocks] = useState<PendingNewBlock[]>([]);

  // Clear AI message when all pending edits are resolved
  useEffect(() => {
    if (aiMessage && pendingEdits.length === 0 && pendingNewBlocks.length === 0) {
      const timer = setTimeout(() => setAiMessage(null), 800);
      return () => clearTimeout(timer);
    }
  }, [aiMessage, pendingEdits.length, pendingNewBlocks.length]);

  const handleAISend = useCallback(async (instruction: string) => {
    if (!activeNoteId || !activeNote || aiLoading) return;

    setAiLoading(true);
    setAiMessage(null);

    // Build block context for the API (skip doodle/image — they hold data URLs)
    const blockContexts = activeNote.blocks
      .filter((b) => b.type !== 'doodle' && b.type !== 'image')
      .map((b, i) => ({
        index: i,
        id: b.id,
        type: b.type,
        content: b.content,
        checked: b.checked,
      }));

    try {
      const response = await sendNotesAIRequest(
        activeNote.title,
        blockContexts,
        instruction
      );

      if (response.error) {
        setAiMessage(response.error);
        setAiLoading(false);
        return;
      }

      // Apply edits as pending (show preview with highlight)
      const newPendingEdits: PendingAIEdit[] = [];

      for (const edit of response.edits) {
        const existingBlock = activeNote.blocks.find((b) => b.id === edit.blockId);
        if (!existingBlock) continue;

        newPendingEdits.push({
          blockId: edit.blockId,
          originalContent: existingBlock.content,
          originalType: existingBlock.type,
          newContent: edit.newContent,
          newType: edit.newType as BlockType | undefined,
        });

        // Apply the AI content immediately (will be reverted on reject)
        updateBlock(edit.blockId, {
          content: edit.newContent,
          ...(edit.newType ? { type: edit.newType as BlockType } : {}),
        });
      }

      // Handle new blocks
      const newPending: PendingNewBlock[] = [];
      if (response.newBlocks && response.newBlocks.length > 0) {
        for (const nb of response.newBlocks) {
          const tempId = uid();
          const newBlock: Block = {
            id: tempId,
            type: nb.type as BlockType,
            content: nb.content,
          };

          newPending.push({
            tempId,
            afterBlockId: nb.afterBlockId,
            type: nb.type as BlockType,
            content: nb.content,
          });

          // Insert the block into the note
          updateNote(activeNoteId, (n) => {
            const blocks = [...n.blocks];
            if (nb.afterBlockId === 'START') {
              blocks.unshift(newBlock);
            } else {
              const afterIdx = blocks.findIndex((b) => b.id === nb.afterBlockId);
              if (afterIdx >= 0) {
                blocks.splice(afterIdx + 1, 0, newBlock);
              } else {
                blocks.push(newBlock);
              }
            }
            return { ...n, blocks };
          });
        }
      }

      setPendingEdits(newPendingEdits);
      setPendingNewBlocks(newPending);
      setAiMessage(response.message);
    } catch (err: any) {
      setAiMessage(err.message || 'AI request failed.');
    } finally {
      setAiLoading(false);
    }
  }, [activeNoteId, activeNote, aiLoading, updateBlock, updateNote]);

  const handleAcceptEdit = useCallback((blockId: string) => {
    // Simply remove from pending — content is already applied
    setPendingEdits((prev) => prev.filter((e) => e.blockId !== blockId));
    setPendingNewBlocks((prev) => prev.filter((e) => e.tempId !== blockId));
  }, []);

  const handleRejectEdit = useCallback((blockId: string) => {
    // Revert edited blocks to original content
    const edit = pendingEdits.find((e) => e.blockId === blockId);
    if (edit) {
      updateBlock(edit.blockId, {
        content: edit.originalContent,
        type: edit.originalType,
      });
      setPendingEdits((prev) => prev.filter((e) => e.blockId !== blockId));
      return;
    }

    // Remove new blocks
    const newBlock = pendingNewBlocks.find((e) => e.tempId === blockId);
    if (newBlock && activeNoteId) {
      updateNote(activeNoteId, (n) => ({
        ...n,
        blocks: n.blocks.filter((b) => b.id !== blockId),
      }));
      setPendingNewBlocks((prev) => prev.filter((e) => e.tempId !== blockId));
    }
  }, [pendingEdits, pendingNewBlocks, updateBlock, updateNote, activeNoteId]);

  const handleAcceptAll = useCallback(() => {
    setPendingEdits([]);
    setPendingNewBlocks([]);
  }, []);

  const handleRejectAll = useCallback(() => {
    // Revert all edits
    for (const edit of pendingEdits) {
      updateBlock(edit.blockId, {
        content: edit.originalContent,
        type: edit.originalType,
      });
    }
    // Remove all new blocks
    if (activeNoteId) {
      const newBlockIds = new Set(pendingNewBlocks.map((nb) => nb.tempId));
      if (newBlockIds.size > 0) {
        updateNote(activeNoteId, (n) => ({
          ...n,
          blocks: n.blocks.filter((b) => !newBlockIds.has(b.id)),
        }));
      }
    }
    setPendingEdits([]);
    setPendingNewBlocks([]);
  }, [pendingEdits, pendingNewBlocks, updateBlock, updateNote, activeNoteId]);

  const hasPendingAI = pendingEdits.length > 0 || pendingNewBlocks.length > 0;

  // Load initial note from localStorage if coming from home page
  useEffect(() => {
    const draft = localStorage.getItem('tm-notes-draft');
    if (draft) {
      localStorage.removeItem('tm-notes-draft');
      const existingNote = notes.find((n) => n.id === activeNoteId);
      if (existingNote) {
        updateNote(existingNote.id, (n) => ({
          ...n,
          blocks: [{ id: uid(), type: 'text' as BlockType, content: draft }, ...n.blocks.filter(b => b.content)],
        }));
      } else {
        const note: Note = {
          id: uid(),
          title: '',
          blocks: [{ id: uid(), type: 'text', content: draft }],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          starred: false,
          emoji: '📝',
        };
        setNotes((prev) => [note, ...prev]);
        setActiveNoteId(note.id);
      }
    }
  }, []);

  return (
    <div
      className={`fixed inset-0 overflow-hidden select-none ${theme.text}`}
      style={{
        minHeight: 'calc(var(--vh, 1vh) * 100)',
        background: activeNote
          ? `linear-gradient(to top, rgba(${getNoteTheme(activeNote.noteTheme).rgb}, 0.35) 0%, black 55%)`
          : '#000',
        transition: 'background 0.5s ease',
      }}
    >

      <div className="h-full flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/')}
              className="p-2 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
            >
              {showSidebar ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
            </button>
            <h1 className="text-lg font-semibold text-white/80">TimeMachine Notes</h1>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleNewNote}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white/50 hover:text-white/70 hover:bg-white/5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Note</span>
            </motion.button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex min-h-0 relative">

          {/* Mobile sidebar overlay backdrop */}
          <AnimatePresence>
            {showSidebar && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowSidebar(false)}
                className="md:hidden fixed inset-0 z-30 bg-black/60"
              />
            )}
          </AnimatePresence>

          {/* Sidebar — inline on desktop, overlay on mobile */}
          {/* Desktop: inline collapsible */}
          <motion.div
            initial={false}
            animate={{ width: showSidebar ? 280 : 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="hidden md:block shrink-0 overflow-hidden border-r border-white/5"
          >
            <div className="w-[280px] h-full pt-2">
              <NoteSidebar
                notes={notes}
                activeId={activeNoteId}
                onSelect={setActiveNoteId}
                onNew={handleNewNote}
                onDelete={handleDeleteNote}
                onToggleStar={handleToggleStar}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            </div>
          </motion.div>

          {/* Mobile: slide-over from left */}
          <AnimatePresence>
            {showSidebar && (
              <motion.div
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                className="md:hidden fixed left-0 top-0 bottom-0 z-40 w-[280px] border-r border-white/5"
                style={{
                  background: 'rgba(0, 0, 0, 0.95)',
                  backdropFilter: 'blur(30px)',
                  WebkitBackdropFilter: 'blur(30px)',
                }}
              >
                <div className="h-full pt-14">
                  <NoteSidebar
                    notes={notes}
                    activeId={activeNoteId}
                    onSelect={(id) => { setActiveNoteId(id); setShowSidebar(false); }}
                    onNew={() => { handleNewNote(); setShowSidebar(false); }}
                    onDelete={handleDeleteNote}
                    onToggleStar={handleToggleStar}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Editor */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
            {activeNote ? (
              <div
                className="flex-1 overflow-y-auto custom-scrollbar transition-all duration-500"
              >
                <div className="max-w-3xl mx-auto px-6 md:px-16 py-8 pb-40">
                  {/* Theme pill dropdown - top right */}
                  <div className="flex justify-end mb-4">
                    <div className="relative" ref={themeDropdownRef}>
                      <button
                        onClick={() => setShowThemeDropdown(!showThemeDropdown)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-white/70 hover:text-white/90 transition-all"
                        style={{
                          background: `rgba(${getNoteTheme(activeNote.noteTheme).rgb}, 0.1)`,
                          border: `1px solid rgba(${getNoteTheme(activeNote.noteTheme).rgb}, 0.2)`,
                        }}
                      >
                        <div className={`w-2.5 h-2.5 rounded-full ${getNoteTheme(activeNote.noteTheme).dot}`} />
                        {getNoteTheme(activeNote.noteTheme).label} Theme
                        <Palette className="w-3 h-3" />
                      </button>
                      <AnimatePresence>
                        {showThemeDropdown && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -4 }}
                            className="absolute right-0 top-full mt-2 z-50 rounded-2xl overflow-hidden min-w-[160px]"
                            style={glassCard}
                          >
                            <div className="py-1.5">
                              <p className="px-3 py-1 text-[10px] font-semibold text-white/30 uppercase tracking-wider">Theme</p>
                              {NOTE_THEMES.map((t) => (
                                <button
                                  key={t.key}
                                  onClick={() => {
                                    updateNote(activeNote.id, (n) => ({ ...n, noteTheme: t.key }));
                                    setShowThemeDropdown(false);
                                  }}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/5 transition-colors ${
                                    (activeNote.noteTheme || 'purple') === t.key ? 'text-white/90' : 'text-white/50'
                                  }`}
                                >
                                  <div className={`w-3 h-3 rounded-full ${t.dot}`} />
                                  {t.label} Theme
                                  {(activeNote.noteTheme || 'purple') === t.key && (
                                    <svg className="w-3.5 h-3.5 ml-auto text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Emoji + Title */}
                  <div className="mb-6">
                    <div className="relative inline-block" ref={emojiPickerRef}>
                      <div
                        className="text-4xl mb-3 cursor-pointer hover:scale-110 transition-transform inline-block"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      >
                        {activeNote.emoji || '📝'}
                      </div>
                      <AnimatePresence>
                        {showEmojiPicker && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -4 }}
                            className="absolute left-0 top-full z-50 rounded-2xl overflow-hidden w-[320px] max-h-[340px] overflow-y-auto custom-scrollbar"
                            style={glassCard}
                          >
                            <div className="p-3 space-y-3">
                              {EMOJI_CATEGORIES.map((cat) => (
                                <div key={cat.label}>
                                  <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1.5">{cat.label}</p>
                                  <div className="grid grid-cols-6 gap-1">
                                    {cat.emojis.map((emoji) => (
                                      <button
                                        key={emoji}
                                        onClick={() => {
                                          updateNote(activeNote.id, (n) => ({ ...n, emoji }));
                                          setShowEmojiPicker(false);
                                        }}
                                        className="text-2xl p-1.5 rounded-xl hover:bg-white/10 transition-colors text-center"
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <input
                      value={activeNote.title}
                      onChange={(e) => updateNote(activeNote.id, (n) => ({ ...n, title: e.target.value }))}
                      placeholder="Untitled"
                      className="w-full text-4xl font-bold text-white placeholder-white/15 bg-transparent outline-none"
                    />
                    <p className="text-white/20 text-sm mt-2">
                      <Clock className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                      {new Date(activeNote.updatedAt).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>

                  {/* Blocks */}
                  <Reorder.Group axis="y" values={activeNote.blocks} onReorder={reorderBlocks} className="space-y-0.5 list-none p-0 m-0">
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

                  {/* Accept / Reject All bar */}
                  <AnimatePresence>
                    {hasPendingAI && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="mt-4 flex items-center justify-between rounded-xl px-4 py-3"
                        style={{
                          background: `rgba(${getNoteTheme(activeNote.noteTheme).rgb}, 0.08)`,
                          border: `1px solid rgba(${getNoteTheme(activeNote.noteTheme).rgb}, 0.2)`,
                        }}
                      >
                        <div className="flex items-center gap-2 text-sm text-white/50">
                          <Sparkles className="w-4 h-4" style={{ color: `rgba(${getNoteTheme(activeNote.noteTheme).rgb}, 0.8)` }} />
                          <span>{pendingEdits.length + pendingNewBlocks.length} AI change{pendingEdits.length + pendingNewBlocks.length !== 1 ? 's' : ''} pending</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleAcceptAll}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                            style={{
                              background: `rgba(${getNoteTheme(activeNote.noteTheme).rgb}, 0.2)`,
                              color: `rgba(${getNoteTheme(activeNote.noteTheme).rgb}, 1)`,
                              border: `1px solid rgba(${getNoteTheme(activeNote.noteTheme).rgb}, 0.3)`,
                            }}
                          >
                            <Check className="w-3.5 h-3.5" /> Accept All
                          </button>
                          <button
                            onClick={handleRejectAll}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 bg-white/5 border border-white/10 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" /> Reject All
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Add block button */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => insertBlockAfter(activeNote.blocks.length - 1)}
                    className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl text-white/15 hover:text-white/40 hover:bg-white/[0.03] transition-all text-sm"
                  >
                    <Plus className="w-4 h-4" /> Add a block
                  </motion.button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <FileText className="w-12 h-12 text-white/10 mx-auto mb-3" />
                  <p className="text-white/25 text-lg">Select or create a note</p>
                </div>
              </div>
            )}

            {/* AI status message — centered in editor area, above textbox */}
            <AnimatePresence>
              {aiMessage && (
                <div className="absolute bottom-[5.25rem] left-0 right-0 z-20 flex justify-center px-4 pointer-events-none">
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  style={{ width: '100%', maxWidth: '42rem' }}
                >
                  <div
                    className="px-4 py-3 rounded-2xl pointer-events-auto"
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                    }}
                  >
                    <p className="text-xs font-medium text-purple-400 opacity-60 mb-1">TimeMachine Air</p>
                    <p className="text-sm text-white/70">{aiMessage}</p>
                  </div>
                </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Floating AI Co-pilot Textbox — centered in editor area */}
            <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center px-4">
              <div style={{ width: '100%', maxWidth: '42rem' }}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = (e.target as HTMLFormElement).elements.namedItem('ai-input') as HTMLInputElement;
                  if (input.value.trim()) {
                    handleAISend(input.value.trim());
                    input.value = '';
                  }
                }}
              >
                <div className="relative flex items-center">
                  <input
                    name="ai-input"
                    type="text"
                    placeholder={aiLoading ? 'Thinking...' : 'Ask to edit, enhance or add to notes'}
                    disabled={aiLoading || !activeNoteId}
                    className="w-full pl-5 pr-16 rounded-[28px] text-white placeholder-gray-400 outline-none disabled:opacity-50 transition-all duration-300 text-base"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                      height: '56px',
                      fontSize: '1rem',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        const form = e.currentTarget.form;
                        if (form) form.requestSubmit();
                      }
                    }}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      disabled={aiLoading || !activeNoteId}
                      className="p-3 rounded-full text-white disabled:opacity-50 relative group transition-all duration-300"
                      style={{
                        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(255, 255, 255, 0.05))',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(168, 85, 247, 0.4)',
                        boxShadow: '0 0 15px rgba(168, 85, 247, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                      }}
                    >
                      {aiLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5 relative z-10" />
                      )}
                    </motion.button>
                  </div>
                </div>
              </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
