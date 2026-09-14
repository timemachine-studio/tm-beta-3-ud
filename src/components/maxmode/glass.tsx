/**
 * The Max Mode panel's building blocks: the glass pill button and the drag
 * handle that makes the panel and its inner divider resizable.
 */

import type { ButtonHTMLAttributes } from 'react';
import { glassPillStyle, type PillTone } from './glassStyles';
import type { useResizable } from './useResizable';

interface GlassPillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  tone?: PillTone;
}

/** A glass pill button. Size it with className: `h-8 w-8` for an icon, `h-8 px-3` with a label. */
export function GlassPill({ active = false, tone = 'default', className, style, children, ...rest }: GlassPillProps) {
  const text = tone === 'accent' ? 'text-cyan-100' : active ? 'text-white' : 'text-white/70 hover:text-white';
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 text-xs transition-colors disabled:opacity-40 disabled:pointer-events-none ${text} ${className ?? ''}`}
      style={{ ...glassPillStyle(active, tone), ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}

interface ResizeHandleProps {
  handleProps: ReturnType<typeof useResizable>['handleProps'];
  label: string;
  /** Which edge of its (relatively positioned) parent the handle straddles. */
  edge: 'left' | 'right';
  className?: string;
}

/** A 12px-wide invisible grab zone with a hairline that shows on hover. */
export function ResizeHandle({ handleProps, label, edge, className }: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      tabIndex={0}
      className={`group absolute inset-y-0 z-20 w-3 cursor-col-resize touch-none outline-none ${edge === 'left' ? '-left-1.5' : '-right-1.5'} ${className ?? ''}`}
      {...handleProps}
    >
      <div className="absolute inset-y-3 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-transparent transition-colors group-hover:bg-white/20 group-focus-visible:bg-cyan-400/50 group-active:bg-cyan-400/60" />
    </div>
  );
}
