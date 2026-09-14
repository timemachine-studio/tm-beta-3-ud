/**
 * Inline glass styles for the Max Mode panel. Inline on purpose —
 * UniversalGlassKit.css says why (backdrop stacking contexts make the
 * classes unreliable) — and written with the theme primitives so light mode
 * can flatten them wholesale.
 */

import type { CSSProperties } from 'react';

export type PillTone = 'default' | 'accent';

export function glassPillStyle(active = false, tone: PillTone = 'default'): CSSProperties {
  if (tone === 'accent') {
    return {
      background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.22), rgb(var(--tm-ink-rgb) / 0.05))',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(34, 211, 238, 0.35)',
      boxShadow: '0 4px 12px rgb(var(--tm-shadow-rgb) / 0.2), inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.15)',
      borderRadius: 9999,
    };
  }
  return {
    background: active ? 'rgb(var(--tm-ink-rgb) / 0.14)' : 'rgb(var(--tm-ink-rgb) / 0.05)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: `1px solid rgb(var(--tm-ink-rgb) / ${active ? 0.18 : 0.1})`,
    boxShadow: '0 4px 12px rgb(var(--tm-shadow-rgb) / 0.2), inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.15)',
    borderRadius: 9999,
  };
}

/** The panel itself: one rounded card, like every other surface in the app. */
export const glassCardStyle: CSSProperties = {
  background: 'rgb(var(--tm-ink-rgb) / 0.04)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgb(var(--tm-ink-rgb) / 0.1)',
  boxShadow: '0 8px 32px rgb(var(--tm-shadow-rgb) / 0.25), inset 0 1px 0 rgb(var(--tm-edge-rgb) / 0.12)',
};

