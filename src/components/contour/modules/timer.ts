/**
 * TimeMachine Contour - Timer Module
 *
 * Provides timer/stopwatch functionality inside the Contour panel.
 * Detects patterns like "5m", "1h30m", "90s", "10:00" when in focused mode.
 */

export interface TimerState {
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  isComplete: boolean;
  label: string;
  display: string;
  progress: number; // 0-1
}

/**
 * Parse a duration string into seconds.
 * Supports: "5m", "1h30m", "90s", "1h", "2m30s", "5:00", "1:30:00", "300"
 */
export function parseDuration(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // "5:00" or "1:30:00" format
  const colonMatch = trimmed.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (colonMatch) {
    if (colonMatch[3]) {
      // H:MM:SS
      const h = parseInt(colonMatch[1]);
      const m = parseInt(colonMatch[2]);
      const s = parseInt(colonMatch[3]);
      if (m > 59 || s > 59) return null;
      return h * 3600 + m * 60 + s;
    }
    // M:SS
    const m = parseInt(colonMatch[1]);
    const s = parseInt(colonMatch[2]);
    if (s > 59) return null;
    return m * 60 + s;
  }

  // "1h30m", "5m", "90s", "1h", "2m30s", "1h30m15s"
  const hmsMatch = trimmed.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m(?:in)?)?\s*(?:(\d+)\s*s(?:ec)?)?$/);
  if (hmsMatch && (hmsMatch[1] || hmsMatch[2] || hmsMatch[3])) {
    const h = parseInt(hmsMatch[1] || '0');
    const m = parseInt(hmsMatch[2] || '0');
    const s = parseInt(hmsMatch[3] || '0');
    const total = h * 3600 + m * 60 + s;
    return total > 0 ? total : null;
  }

  // Just a number: treat as seconds if small, minutes if reasonable
  const numMatch = trimmed.match(/^(\d+)$/);
  if (numMatch) {
    const n = parseInt(numMatch[1]);
    if (n > 0 && n <= 86400) return n; // treat as seconds (up to 24h)
    return null;
  }

  return null;
}

/**
 * Format seconds into a readable display string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) seconds = 0;

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Format duration in human-readable form
 */
export function formatDurationLabel(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ');
}

/**
 * Create initial timer state from a duration input
 */
export function createTimerState(input: string): TimerState | null {
  const seconds = parseDuration(input);
  if (seconds === null || seconds <= 0) return null;

  return {
    totalSeconds: seconds,
    remainingSeconds: seconds,
    isRunning: false,
    isComplete: false,
    label: formatDurationLabel(seconds),
    display: formatDuration(seconds),
    progress: 1,
  };
}

/**
 * Tick the timer by 1 second
 */
export function tickTimer(state: TimerState): TimerState {
  if (!state.isRunning || state.isComplete) return state;

  const remaining = state.remainingSeconds - 1;

  if (remaining <= 0) {
    return {
      ...state,
      remainingSeconds: 0,
      isRunning: false,
      isComplete: true,
      display: '0:00',
      progress: 0,
    };
  }

  return {
    ...state,
    remainingSeconds: remaining,
    display: formatDuration(remaining),
    progress: remaining / state.totalSeconds,
  };
}

/**
 * Detect timer intent from focused mode input
 */
export function detectTimer(input: string): { seconds: number; label: string } | null {
  const seconds = parseDuration(input);
  if (seconds === null || seconds <= 0) return null;
  return { seconds, label: formatDurationLabel(seconds) };
}
