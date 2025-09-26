import { AI_PERSONAS, PERSONA_LIMITS } from './constants';

export interface UsageLimit {
  [key: string]: {
    dailyLimit: number;
    currentCount: number;
    lastReset: string; // Store as ISO string for better serialization
  };
}

export interface DevControls {
  isOnline: boolean;
  personaLimits: {
    [K in keyof typeof AI_PERSONAS]: number;
  };
  usageTracking: {
    [ip: string]: UsageLimit;
  };
}

// Default configuration using environment variables
export const DEFAULT_DEV_CONTROLS: DevControls = {
  isOnline: true,
  personaLimits: {
    default: PERSONA_LIMITS.default,
    girlie: PERSONA_LIMITS.girlie,
    pro: PERSONA_LIMITS.pro
  },
  usageTracking: {}
};

// Local storage key
const STORAGE_KEY = 'timeMachine_devControls';

// Load controls from localStorage
export function loadDevControls(): DevControls {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Convert stored date strings back to Date objects
      Object.values(parsed.usageTracking).forEach(tracking => {
        Object.values(tracking as UsageLimit).forEach(limit => {
          limit.lastReset = new Date(limit.lastReset).toISOString();
        });
      });
      return parsed;
    }
  } catch (error) {
    console.error('Failed to load dev controls:', error);
  }
  return DEFAULT_DEV_CONTROLS;
}

// Save controls to localStorage
export function saveDevControls(controls: DevControls): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(controls));
  } catch (error) {
    console.error('Failed to save dev controls:', error);
  }
}

// Get current controls
export function getDevControls(): DevControls {
  return loadDevControls();
}

// Update online status
export function setOnlineStatus(isOnline: boolean): void {
  const controls = loadDevControls();
  controls.isOnline = isOnline;
  saveDevControls(controls);
}

export function checkUsageLimit(
  ip: string,
  persona: keyof typeof AI_PERSONAS
): boolean {
  const controls = loadDevControls();

  // Check if app is online
  if (!controls.isOnline) {
    return false;
  }

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Initialize tracking for new IP
  if (!controls.usageTracking[ip]) {
    controls.usageTracking[ip] = {};
  }

  // Initialize tracking for new persona
  if (!controls.usageTracking[ip][persona]) {
    controls.usageTracking[ip][persona] = {
      dailyLimit: controls.personaLimits[persona],
      currentCount: 0,
      lastReset: now.toISOString()
    };
  }

  const usage = controls.usageTracking[ip][persona];
  const lastResetDate = new Date(usage.lastReset).toISOString().split('T')[0];

  // Reset count if it's a new day
  if (lastResetDate !== today) {
    usage.currentCount = 0;
    usage.lastReset = now.toISOString();
  }

  // Save changes
  saveDevControls(controls);

  // Check if usage is within limits
  return usage.currentCount < usage.dailyLimit;
}

export function incrementUsage(
  ip: string,
  persona: keyof typeof AI_PERSONAS
): void {
  const controls = loadDevControls();
  if (controls.usageTracking[ip]?.[persona]) {
    controls.usageTracking[ip][persona].currentCount++;
    saveDevControls(controls);
  }
}

export function getRemainingUsage(
  ip: string,
  persona: keyof typeof AI_PERSONAS
): number {
  const controls = loadDevControls();
  if (!controls.usageTracking[ip]?.[persona]) {
    return controls.personaLimits[persona];
  }

  const usage = controls.usageTracking[ip][persona];
  return Math.max(0, usage.dailyLimit - usage.currentCount);
}

export function getTotalUsageCount(
  ip: string,
  persona: keyof typeof AI_PERSONAS
): number {
  const controls = loadDevControls();
  return controls.usageTracking[ip]?.[persona]?.currentCount || 0;
}