import { plusMenuItems, type PlusMenuOption } from './plusMenuItems';
export type { PlusMenuOption } from './plusMenuItems';
import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

interface PlusMenuProps {
  isVisible: boolean;
  onSelect: (option: PlusMenuOption) => void;
  onClose?: () => void;
}

export function PlusMenu({ isVisible, onSelect, onClose }: PlusMenuProps) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          data-plus-menu
          role="group"
          aria-label="Attachments and modes"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? undefined : { opacity: 0, y: 8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="tm-glass tm-chat-menu absolute bottom-full left-0 z-50 mb-4 w-60 rounded-3xl p-1.5"
          style={{ maxHeight: 'calc(var(--vh, 1vh) * 100 - 180px)' }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { event.stopPropagation(); onClose?.(); }
            const buttons = Array.from(event.currentTarget.querySelectorAll('button'));
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
            }
          }}
        >
          {plusMenuItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onSelect(key);
              }}
              className="tm-menu-row flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm text-ink"
            >
              <Icon className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
