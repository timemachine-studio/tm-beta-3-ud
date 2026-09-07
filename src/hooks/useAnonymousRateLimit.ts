import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// Rate limits for anonymous users, by persona.
//
// These numbers are DISPLAY FALLBACKS only. The authority is the server
// (api/ai-proxy.ts), which counts per-IP and per-signed-device and returns the
// real remaining count from GET /api/ai-proxy?quota=<persona>. Clearing site
// data resets what is stored here and grants nothing — see
// production-check.md 0.4.
const ANONYMOUS_RATE_LIMITS = {
  default: 3,   // 3 trial messages
  girlie: 0,    // Girlie persona - requires sign up
  pro: 0,       // Pro persona - requires sign up
} as const;

// Storage key for the cached display counts
const STORAGE_KEY = 'timemachine_anon_rate_limits';

interface RateLimitData {
  counts: Record<string, number>;
  resetTime: number; // Timestamp when limits reset (24 hours from first message)
}

/**
 * @param trackedPersona when given, the remaining count for this persona is
 *   pulled from the server on mount and whenever it changes, so the number on
 *   screen is the server's rather than a stale localStorage guess.
 * @param turnInProgress pass the chat's loading flag. The count is re-read when
 *   it falls back to false — i.e. when a turn has actually finished and the
 *   server has decided whether to charge for it. Refreshing any earlier races
 *   the server's own increment.
 */
export function useAnonymousRateLimit(trackedPersona?: string, turnInProgress?: boolean) {
  const { user } = useAuth();

  // Server-reported remaining counts, keyed by persona. Undefined until the
  // first successful probe; the cached local value is used until then.
  const [serverRemaining, setServerRemaining] = useState<Record<string, number>>({});
  const inFlight = useRef<Record<string, boolean>>({});

  const [rateLimitData, setRateLimitData] = useState<RateLimitData>(() => {
    if (typeof window === 'undefined') {
      return { counts: {}, resetTime: 0 };
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Check if reset time has passed
        if (Date.now() > parsed.resetTime) {
          // Reset the limits
          return { counts: {}, resetTime: 0 };
        }
        return parsed;
      } catch {
        return { counts: {}, resetTime: 0 };
      }
    }
    return { counts: {}, resetTime: 0 };
  });

  // Save to localStorage whenever data changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rateLimitData));
    }
  }, [rateLimitData]);

  /**
   * Ask the server what this caller actually has left.
   *
   * Call it after a turn finishes rather than incrementing optimistically: the
   * server only charges quota for a generation that succeeded, so a failed
   * request leaves the displayed number unchanged.
   */
  const refreshFromServer = useCallback(async (persona: string) => {
    if (inFlight.current[persona]) return;
    inFlight.current[persona] = true;
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const response = await fetch(`/api/ai-proxy?quota=${encodeURIComponent(persona)}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!response.ok) return;
      const quota = await response.json();
      if (typeof quota?.remaining !== 'number') return;

      setServerRemaining(prev => ({ ...prev, [persona]: quota.remaining }));
      setRateLimitData(prev => ({
        counts: {
          ...prev.counts,
          [persona]: Math.max(0, (quota.limit ?? 0) - quota.remaining),
        },
        resetTime: prev.resetTime || Date.now() + 24 * 60 * 60 * 1000,
      }));
    } catch {
      // Display-only: a failed probe just leaves the previous number on screen.
    } finally {
      inFlight.current[persona] = false;
    }
  }, []);

  useEffect(() => {
    if (user || !trackedPersona) return;
    void refreshFromServer(trackedPersona);
  }, [user, trackedPersona, refreshFromServer]);

  // Falling edge of the turn: the generation has finished (or failed) and the
  // server has settled the quota, so its number is now the right one to show.
  const wasInProgress = useRef(false);
  useEffect(() => {
    if (wasInProgress.current && !turnInProgress && !user && trackedPersona) {
      void refreshFromServer(trackedPersona);
    }
    wasInProgress.current = Boolean(turnInProgress);
  }, [turnInProgress, user, trackedPersona, refreshFromServer]);

  // Get the rate limit for a persona
  const getRateLimit = useCallback((persona: string): number => {
    return ANONYMOUS_RATE_LIMITS[persona as keyof typeof ANONYMOUS_RATE_LIMITS] ?? 0;
  }, []);

  // Get remaining messages for a persona
  const getRemainingMessages = useCallback((persona: string): number => {
    if (user) return Infinity; // Logged in users have server-side limits

    const fromServer = serverRemaining[persona];
    if (typeof fromServer === 'number') return fromServer;

    const limit = getRateLimit(persona);
    const currentCount = rateLimitData.counts[persona] || 0;
    return Math.max(0, limit - currentCount);
  }, [user, serverRemaining, rateLimitData, getRateLimit]);

  // Check if user has exceeded rate limit for a persona.
  // This only decides what the UI offers — the server enforces the real limit.
  const isRateLimited = useCallback((persona: string): boolean => {
    // Logged in users are not rate limited (by this hook - server handles their limits)
    if (user) return false;
    return getRemainingMessages(persona) <= 0;
  }, [user, getRemainingMessages]);

  // Reset the cached display counts (does not grant server-side quota)
  const resetLimits = useCallback(() => {
    setRateLimitData({ counts: {}, resetTime: 0 });
    setServerRemaining({});
  }, []);

  return {
    isRateLimited,
    getRemainingMessages,
    refreshFromServer,
    getRateLimit,
    resetLimits,
    isAnonymous: !user,
  };
}

export default useAnonymousRateLimit;
