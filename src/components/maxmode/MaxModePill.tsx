import { popupExit } from '../../utils/popupMotion';
/**
 * The mode picker in Max Mode: a glass pill above the composer, on the left,
 * that names the current mode (Plan / Edit / Auto) and expands upward to
 * change it. Entering Max Mode is the header's job; this only picks how the
 * agent is allowed to work on the next turn.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronUp, ListChecks, Pencil, Zap } from 'lucide-react';
import { MAX_MODE_KINDS, MAX_MODE_LABELS, type MaxModeKind } from '../../../shared/maxMode';
import { GlassPill } from './glass';

const MODE_ICONS: Record<MaxModeKind, typeof Zap> = { plan: ListChecks, edit: Pencil, auto: Zap };

interface MaxModePillProps {
  mode: MaxModeKind;
  onSelect: (mode: MaxModeKind) => void;
}

export function MaxModePill({ mode, onSelect }: MaxModePillProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const Icon = MODE_ICONS[mode];

  return (
    <div className="relative" ref={rootRef}>
      <GlassPill
        active={open}
        className="h-8 pl-3 pr-2.5 text-[13px]"
        onClick={() => setOpen(value => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Max Mode: ${MAX_MODE_LABELS[mode].name}`}
      >
        <Icon className="w-3.5 h-3.5 text-cyan-300" />
        <span>{MAX_MODE_LABELS[mode].name}</span>
        <ChevronUp className={`w-3.5 h-3.5 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </GlassPill>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={popupExit}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            role="menu"
            className="absolute bottom-full left-0 mb-2 w-72 overflow-hidden rounded-3xl border border-white/5 backdrop-blur-3xl z-50"
            style={{ background: 'linear-gradient(145deg, rgb(var(--tm-paper-rgb) / 0.92), rgb(var(--tm-paper-rgb) / 0.85))' }}
          >
            <div className="px-4 pt-3 pb-2 text-[11px] uppercase tracking-wider text-white/40">Mode</div>
            {MAX_MODE_KINDS.map(kind => {
              const selected = mode === kind;
              const KindIcon = MODE_ICONS[kind];
              return (
                <motion.button
                  key={kind}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  whileHover={{ background: 'linear-gradient(90deg, rgba(34,211,238,0.2) 0%, transparent 100%)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setOpen(false); onSelect(kind); }}
                  className={`w-full px-4 py-3 text-left flex items-start gap-3 last:border-b-0 border-b border-white/5 ${selected ? 'text-cyan-300' : 'text-white'}`}
                  style={{ background: selected ? 'linear-gradient(to right, rgba(34,211,238,0.2), transparent)' : 'transparent' }}
                >
                  <KindIcon className="w-4 h-4 mt-0.5 shrink-0 opacity-80" />
                  <div className="flex-1">
                    <div className="font-bold text-sm">{MAX_MODE_LABELS[kind].name}</div>
                    <div className="text-xs opacity-70">{MAX_MODE_LABELS[kind].description}</div>
                  </div>
                  {selected && <Check className="w-4 h-4 mt-0.5 shrink-0" />}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
