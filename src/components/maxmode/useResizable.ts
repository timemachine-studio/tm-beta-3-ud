import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readStoredWidth(key: string, fallback: number) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw === null ? NaN : Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

interface ResizableOptions {
  /** localStorage key the width is remembered under. */
  storageKey: string;
  fallback: number;
  min: number;
  /** A number, or a function so the ceiling can follow the viewport. */
  max: number | (() => number);
  /** True when the handle sits on the panel's left edge, so dragging left grows it. */
  invert?: boolean;
}

/**
 * A drag-to-resize width, remembered across visits.
 *
 * The handle takes pointer capture, so the drag keeps tracking over the
 * preview iframe and the terminal — neither would otherwise hand the pointer
 * back. Arrow keys move it too, for keyboard users.
 */
export function useResizable({ storageKey, fallback, min, max, invert = false }: ResizableOptions) {
  const ceiling = useCallback(() => (typeof max === 'function' ? max() : max), [max]);
  const bounded = useCallback((value: number) => clamp(value, min, Math.max(min, ceiling())), [min, ceiling]);
  // A width saved from a wider window is clamped as it is read back.
  const [width, setWidth] = useState(() => bounded(readStoredWidth(storageKey, fallback)));

  const persist = useCallback((value: number) => {
    try { localStorage.setItem(storageKey, String(Math.round(value))); } catch { /* per-viewer convenience only */ }
  }, [storageKey]);

  const widthRef = useRef(width);
  useEffect(() => { widthRef.current = width; }, [width]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    const startX = event.clientX;
    const startWidth = widthRef.current;
    let latest = startWidth;
    handle.setPointerCapture(event.pointerId);
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const move = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      latest = bounded(startWidth + (invert ? -delta : delta));
      setWidth(latest);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
      persist(latest);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }, [bounded, invert, persist]);

  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    const step = event.key === 'ArrowLeft' ? -16 : event.key === 'ArrowRight' ? 16 : 0;
    if (!step) return;
    event.preventDefault();
    const next = bounded(widthRef.current + (invert ? -step : step));
    setWidth(next);
    persist(next);
  }, [bounded, invert, persist]);

  return { width, handleProps: { onPointerDown, onKeyDown } };
}

