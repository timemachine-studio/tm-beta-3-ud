/**
 * The Max Mode control, where Heat Level used to be on the PRO header.
 *
 * Off: a pill that opens the mode picker; choosing a mode turns Max Mode on.
 * On: the pill names the mode, and the picker lets the user switch modes,
 * leave Max Mode, or — on a phone, where the workspace and the chat take
 * turns — flip to the workspace.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Cpu, LogOut, PanelRight } from 'lucide-react';
import { MAX_MODE_KINDS, MAX_MODE_LABELS, type MaxModeKind } from '../../../shared/maxMode';

interface MaxModeButtonProps {
  mode: MaxModeKind | null;
  textColor: string;
  onSelect: (mode: MaxModeKind) => void;
  onExit?: () => void;
  onToggleWorkspace?: () => void;
}

export function MaxModeButton({ mode, textColor, onSelect, onExit, onToggleWorkspace }: MaxModeButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = mode !== null;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const glow = active || open;
  const styles = {
    border: glow ? '1px solid rgba(34, 211, 238, 0.5)' : '1px solid rgba(34, 211, 238, 0.3)',
    background: glow
      ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.3), rgb(var(--tm-ink-rgb) / 0.05))'
      : 'linear-gradient(135deg, rgba(34, 211, 238, 0.15), rgb(var(--tm-ink-rgb) / 0.05))',
    boxShadow: glow
      ? '0 0 20px rgba(34, 211, 238, 0.4), inset 0 1px 0 rgb(var(--tm-ink-rgb) / 0.15)'
      : '0 0 12px rgba(34, 211, 238, 0.25), inset 0 1px 0 rgb(var(--tm-ink-rgb) / 0.15)',
    color: glow ? 'rgb(135,206,250)' : textColor,
  };

  return (
    <div className="relative flex items-center gap-2" ref={rootRef}>
      {onToggleWorkspace && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onToggleWorkspace}
          className="lg:hidden flex items-center justify-center w-9 h-9 rounded-full bg-white/5 border border-white/10"
          aria-label="Toggle workspace"
        >
          <PanelRight className="w-4 h-4" style={{ color: textColor }} />
        </motion.button>
      )}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(value => !value)}
        style={{
          ...styles,
          borderRadius: '9999px',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          outline: 'none',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.3s ease',
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={active ? `Max Mode: ${MAX_MODE_LABELS[mode].name}` : 'Turn on Max Mode'}
      >
        <Cpu style={{ width: '16px', height: '16px', color: styles.color }} />
        <span style={{ fontSize: '14px', color: styles.color }}>
          {active ? `Max Mode · ${MAX_MODE_LABELS[mode].name}` : 'Max Mode'}
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            role="menu"
            className="absolute top-full right-0 mt-3 w-72 backdrop-blur-3xl rounded-3xl z-50 overflow-hidden border border-white/5"
            style={{ background: 'linear-gradient(145deg, rgb(var(--tm-paper-rgb) / 0.92), rgb(var(--tm-paper-rgb) / 0.85))' }}
          >
            <div className="px-4 pt-3 pb-2 text-[11px] uppercase tracking-wider text-white/40">
              {active ? 'Mode' : 'Turn PRO into a coding agent'}
            </div>
            {MAX_MODE_KINDS.map(kind => {
              const selected = mode === kind;
              return (
                <motion.button
                  key={kind}
                  role="menuitemradio"
                  aria-checked={selected}
                  whileHover={{ background: 'linear-gradient(90deg, rgba(34,211,238,0.2) 0%, transparent 100%)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setOpen(false); onSelect(kind); }}
                  className={`w-full px-4 py-3 text-left flex items-start gap-3 border-b border-white/5 ${selected ? 'text-cyan-300' : 'text-white'}`}
                  style={{ background: selected ? 'linear-gradient(to right, rgba(34,211,238,0.2), transparent)' : 'transparent' }}
                >
                  <div className="flex-1">
                    <div className="font-bold text-sm">{MAX_MODE_LABELS[kind].name}</div>
                    <div className="text-xs opacity-70">{MAX_MODE_LABELS[kind].description}</div>
                  </div>
                  {selected && <Check className="w-4 h-4 mt-0.5 shrink-0" />}
                </motion.button>
              );
            })}
            {active && onExit && (
              <motion.button
                role="menuitem"
                whileHover={{ background: 'rgba(255,255,255,0.06)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setOpen(false); onExit(); }}
                className="w-full px-4 py-3 text-left flex items-center gap-3 text-white/70 text-sm"
              >
                <LogOut className="w-4 h-4" />
                Leave Max Mode
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
