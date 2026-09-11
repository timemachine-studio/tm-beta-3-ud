/**
 * Shared UI primitives and constants for Contour module views.
 */

import React from 'react';
// ─── Types ─────────────────────────────────────────────────────

export interface AccentTheme {
  bg: string;
  border: string;
  glow: string;
  text: string;
  solid: string;
}

// ─── Constants ─────────────────────────────────────────────────

export const SELECT_ARROW = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='rgb(var(--tm-ink-rgb) / 0.3)' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`;

// ─── Shared Components ─────────────────────────────────────────

export function IconBadge({ icon: Icon, accent }: { icon: React.ComponentType<{ className?: string }>; accent: AccentTheme }) {
  return (
    <div className="p-2.5 rounded-xl shrink-0" style={{ background: accent.bg, border: `1px solid ${accent.border}` }}>
      <Icon className={`w-5 h-5 ${accent.text}`} />
    </div>
  );
}

export function HintView({ icon: Icon, accent, text }: { icon: React.ComponentType<{ className?: string }>; accent: AccentTheme; text: string }) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <IconBadge icon={Icon} accent={accent} />
        <div className="text-white/30 text-sm">{text}</div>
      </div>
    </div>
  );
}

export function FooterHint({ text }: { text: string }) {
  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgb(var(--tm-ink-rgb) / 0.06)' }}>
      <span className="text-[10px] text-white/20">{text}</span>
    </div>
  );
}
