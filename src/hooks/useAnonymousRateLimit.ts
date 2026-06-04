import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

// Rate limits for anonymous users - by model/persona
// Only ChatGPT (default) gets 3 trial messages
// All other models and personas require sign up
const ANONYMOUS_RATE_LIMITS = {
  // Default persona models
  default: 3,   // ChatGPT - 3 trial messages
  chatgpt: 3,   // Explicit @chatgpt mention - 3 trial messages
  gemini: 0,    // @gemini - requires sign up
  claude: 0,    // @claude - requires sign up
  grok: 0,      // @grok - requires sign up
  // Other personas
  girlie: 0,    // Girlie persona - requires sign up
  pro: 0,       // Pro persona - requires sign up
} as const;

// Storage key for anonymous rate limits
const STORAGE_KEY = 'timemachine_anon_rate_limits';

interface RateLimitData {
  counts: Record<string, number>;
  resetTime: number; // Timestamp when limits reset (24 hours from first message)
}

export function useAnonymousRateLimit() {
  const { user } = useAuth();
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

  // Check if user has exceeded rate limit for a persona
  const isRateLimited = useCallback((persona: string): boolean => {
    // Logged in users are not rate limited (by this hook - server handles their limits)
    if (user) return false;

    const limit = ANONYMOUS_RATE_LIMITS[persona as keyof typeof ANONYMOUS_RATE_LIMITS] ?? 3;
    const currentCount = rateLimitData.counts[persona] || 0;

    return currentCount >= limit;
  }, [user, rateLimitData]);

  // Get remaining messages for a persona
  const getRemainingMessages = useCallback((persona: string): number => {
    if (user) return Infinity; // Logged in users have server-side limits

    const limit = ANONYMOUS_RATE_LIMITS[persona as keyof typeof ANONYMOUS_RATE_LIMITS] ?? 3;
    const currentCount = rateLimitData.counts[persona] || 0;

    return Math.max(0, limit - currentCount);
  }, [user, rateLimitData]);

  // Increment the count for a persona
  const incrementCount = useCallback((persona: string) => {
    if (user) return; // Don't track for logged in users

    setRateLimitData(prev => {
      const newCounts = { ...prev.counts };
      newCounts[persona] = (newCounts[persona] || 0) + 1;

      // Set reset time to 24 hours from now if not already set
      const resetTime = prev.resetTime || Date.now() + 24 * 60 * 60 * 1000;

      return { counts: newCounts, resetTime };
    });
  }, [user]);

  // Get the rate limit for a persona
  const getRateLimit = useCallback((persona: string): number => {
    return ANONYMOUS_RATE_LIMITS[persona as keyof typeof ANONYMOUS_RATE_LIMITS] ?? 3;
  }, []);

  // Reset rate limits (for testing or admin purposes)
  const resetLimits = useCallback(() => {
    setRateLimitData({ counts: {}, resetTime: 0 });
  }, []);

  return {
    isRateLimited,
    getRemainingMessages,
    incrementCount,
    getRateLimit,
    resetLimits,
    isAnonymous: !user,
  };
}

export default useAnonymousRateLimit;
