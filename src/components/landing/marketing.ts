import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { markEnteredApp, type LandingHandoff } from './entered';

/* Hooks and constants the marketing pages share. Components live in
   MarketingShell.tsx; this file stays free of them so fast refresh works. */

// Critically damped: nothing that simply appears should overshoot.
export const settle = { type: 'spring', bounce: 0, duration: 0.8 } as const;

/** Fade-up-on-view props for a motion element; honours reduced motion. */
export function useReveal() {
  const reduced = useReducedMotion() ?? false;
  const reveal = useCallback((delay = 0) => ({
    initial: reduced ? false : { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-10% 0px' },
    transition: { ...settle, delay: reduced ? 0 : delay },
  }), [reduced]);
  const enter = useCallback((delay = 0) => ({
    initial: reduced ? false : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { ...settle, delay: reduced ? 0 : delay },
  }), [reduced]);
  return { reduced, reveal, enter };
}

/** Where "Start chatting" and "Log in" go: into the app, through the landing handoff. */
export function useEnterApp() {
  const navigate = useNavigate();
  const open = useCallback((state: LandingHandoff) => {
    markEnteredApp();
    navigate('/', { state });
  }, [navigate]);
  return {
    startChatting: useCallback(() => open({ enter: true }), [open]),
    logIn: useCallback(() => open({ openAuth: true }), [open]),
    sendFirst: useCallback((text: string) => open({ initialPrompt: text }), [open]),
  };
}

