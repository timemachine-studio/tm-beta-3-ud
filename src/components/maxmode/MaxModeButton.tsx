/**
 * The Max Mode control, where Heat Level used to be on the PRO header.
 *
 * One click in, one click out: off, the pill turns Max Mode on (in Auto —
 * the mode is a detail to change once you are in, from the pill above the
 * composer, not a decision to make first); on, it leaves.
 */

import { Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { MaxModeIcon } from './MaxModeIcon';

interface MaxModeButtonProps {
  active: boolean;
  legacy?: boolean;
  textColor: string;
  onEnter: () => void;
  onExit?: () => void;
}

export function MaxModeButton({ active, textColor, onEnter, onExit, legacy = false }: MaxModeButtonProps) {
  const styles = {
    border: active ? '1px solid rgba(34, 211, 238, 0.5)' : '1px solid rgba(34, 211, 238, 0.3)',
    background: active
      ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.3), rgb(var(--tm-ink-rgb) / 0.05))'
      : 'linear-gradient(135deg, rgba(34, 211, 238, 0.15), rgb(var(--tm-ink-rgb) / 0.05))',
    boxShadow: active
      ? '0 0 20px rgba(34, 211, 238, 0.4), inset 0 1px 0 rgb(var(--tm-ink-rgb) / 0.15)'
      : '0 0 12px rgba(34, 211, 238, 0.25), inset 0 1px 0 rgb(var(--tm-ink-rgb) / 0.15)',
    // The hue reads as a sticker on paper; light collapses it to the accent.
    color: active ? legacy ? 'rgb(135,206,250)' : 'rgb(var(--tm-accent-rgb, 135 206 250))' : textColor,
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={active ? onExit : onEnter}
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
      aria-pressed={active}
      aria-label={active ? 'Leave Max Mode' : 'Turn on Max Mode'}
      title={active ? 'Leave Max Mode' : 'Turn on Max Mode'}
    >
      {legacy ? <Star style={{ width: '16px', height: '16px', color: styles.color }} /> : <MaxModeIcon size={17} style={{ color: styles.color }} />}
      <span style={{ fontSize: '14px', color: styles.color }}>Max Mode</span>
    </motion.button>
  );
}
