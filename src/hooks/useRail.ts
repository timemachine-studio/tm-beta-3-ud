import { useCallback, useEffect, useState } from 'react';

/* The rail: a column beside the page from 1024px up, a slide-over below
   that. Its open state is remembered per device — but only when the user
   chooses, never on mount, because a value written from a narrow window
   would close the rail on every wide one after. */

const KEY = 'tm-rail-open';
const WIDE = 1024;

export function useRail() {
  const [railWide, setRailWide] = useState(() => typeof window === 'undefined' || window.innerWidth >= WIDE);
  const [railOpen, setRailOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    // A phone never opens on the rail: below the breakpoint it is a
    // slide-over, and a slide-over that is already open on arrival hides
    // the page the person came for.
    if (window.innerWidth < WIDE) return false;
    let stored: string | null = null;
    try { stored = localStorage.getItem(KEY); } catch { /* private mode */ }
    return stored === null ? true : stored === '1';
  });

  useEffect(() => {
    const onResize = () => setRailWide(window.innerWidth >= WIDE);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const openRail = useCallback((open: boolean) => {
    setRailOpen(open);
    try { localStorage.setItem(KEY, open ? '1' : '0'); } catch { /* private mode: not remembered */ }
  }, []);

  return { railOpen, railWide, railInline: railOpen && railWide, openRail };
}
