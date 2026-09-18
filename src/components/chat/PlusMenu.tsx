import { popupExit } from '../../utils/popupMotion';
import { plusMenuItems, type PlusMenuOption } from './plusMenuItems';
export type { PlusMenuOption } from './plusMenuItems';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { toLayoutPx } from '../../utils/pageZoom';

interface PlusMenuProps {
  isVisible: boolean;
  onSelect: (option: PlusMenuOption) => void;
  onClose?: () => void;
}

/* The gap the stack keeps from the screen's edge when the plus button is
   too close to it for centring. */
const EDGE = 12;

/* Below this the stack is not centred on the button at all: it rises from
   the button's left edge, where it is on screen by construction. On phones
   the button sits at the screen's left padding, so centring a 200px stack
   on it means measuring how far it hangs off and pushing it back — and on
   iOS that measurement landed before the transform did, leaving the stack
   cut off at the left. A layout that needs no measuring cannot do that. */
const CENTRED_FROM = '(min-width: 640px)';

/* The legacy menu: a stack of separate pills rising from the plus button,
   one per mode, each its own piece of glass — not a card. The glass is the
   header pill's (.tm-glass), so the stack, the bar and the nav read as one
   material. From 640px the stack is centred on the button; where that would
   push it off the left of the screen it slides right just enough to stay on. */
export function PlusMenu({ isVisible, onSelect, onClose }: PlusMenuProps) {
  const reduced = useReducedMotion();
  const anchorRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<{ centred: boolean; shift: number }>({ centred: false, shift: 0 });

  // Measured on the static anchor, not the animating stack, so the entrance
  // transform cannot skew the number. Rects are real pixels; the layout is
  // zoomed (utils/pageZoom). The anchor is measured with no correction
  // applied, so re-measuring never compounds.
  useLayoutEffect(() => {
    if (!isVisible) return;
    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      if (!window.matchMedia(CENTRED_FROM).matches) {
        el.style.translate = '0 0';
        setPlacement({ centred: false, shift: 0 });
        return;
      }
      el.style.translate = '-50% 0';
      const left = toLayoutPx(el.getBoundingClientRect().left);
      setPlacement({ centred: true, shift: Math.max(0, EDGE - left) });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [isVisible]);

  return (
    <AnimatePresence>
      {isVisible && (
        <div
          ref={anchorRef}
          className={`tm-plus-menu absolute bottom-full z-50 mb-3 ${placement.centred ? 'left-1/2' : 'left-0'}`}
          style={{ translate: placement.centred ? `calc(-50% + ${placement.shift}px) 0` : '0 0' }}
        >
          {/* Transform-only entrance: a backdrop-filter element under an
              animating opacity renders black on iOS for a frame or two
              (the "flicker" on open). The rise and settle carry the entrance. */}
          <motion.div
            data-plus-menu
            role="group"
            aria-label="Attachments and modes"
            initial={reduced ? false : { y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={popupExit}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex flex-col items-center gap-1.5"
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
            {plusMenuItems.map(({ key, label, icon: Icon }, i) => (
              <motion.button
                key={key}
                type="button"
                initial={reduced ? false : { y: 8 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.18, delay: reduced ? 0 : i * 0.03, ease: 'easeOut' }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={(e) => {
                  e.preventDefault();
                  onSelect(key);
                }}
                className="tm-glass tm-glass-pill tm-press tm-plus-pill flex w-[200px] items-center gap-3 rounded-full px-4 py-2.5 text-left"
              >
                <span className="flex shrink-0 items-center" style={{ color: 'rgb(var(--tm-ink-rgb) / 0.7)' }} aria-hidden="true">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm">{label}</span>
              </motion.button>
            ))}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
