import { useCallback, useEffect, useRef, useState } from 'react';

/** Unmount/recheck aborts and suppresses stale results. A background refresh
 * may retain the last verified snapshot until the new response arrives. */
export function useWorkConnectionCheck<T>() {
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const current = useRef<AbortController | null>(null);
  useEffect(() => () => current.current?.abort(), []);
  const check = useCallback(async (load: (signal: AbortSignal) => Promise<T>, retainPrevious = false) => {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    setChecking(true); setError(null); if (!retainPrevious) setResult(null);
    try {
      const next = await load(controller.signal);
      if (!controller.signal.aborted) setResult(next);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not check this connection. Try again.');
    } finally { if (!controller.signal.aborted) setChecking(false); }
  }, []);
  return { result, error, checking, check };
}
