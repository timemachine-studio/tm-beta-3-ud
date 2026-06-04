/**
 * TimeMachine Contour - JSON Formatter Module
 *
 * Formats, validates, and minifies JSON strings.
 */

export interface JsonFormatResult {
  input: string;
  formatted: string;
  minified: string;
  isValid: boolean;
  error?: string;
  keyCount: number;
  depth: number;
  isPartial: boolean;
}

function getDepth(obj: unknown, current: number = 0): number {
  if (typeof obj !== 'object' || obj === null) return current;
  let max = current;
  for (const val of Object.values(obj)) {
    max = Math.max(max, getDepth(val, current + 1));
  }
  return max;
}

function countKeys(obj: unknown): number {
  if (typeof obj !== 'object' || obj === null) return 0;
  let count = 0;
  if (Array.isArray(obj)) {
    for (const item of obj) count += countKeys(item);
  } else {
    count = Object.keys(obj).length;
    for (const val of Object.values(obj)) count += countKeys(val);
  }
  return count;
}

export function formatJson(input: string): JsonFormatResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { input, formatted: '', minified: '', isValid: false, keyCount: 0, depth: 0, isPartial: true };
  }

  try {
    const parsed = JSON.parse(trimmed);
    const formatted = JSON.stringify(parsed, null, 2);
    const minified = JSON.stringify(parsed);
    return {
      input: trimmed,
      formatted,
      minified,
      isValid: true,
      keyCount: countKeys(parsed),
      depth: getDepth(parsed),
      isPartial: false,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Invalid JSON';
    return {
      input: trimmed,
      formatted: trimmed,
      minified: trimmed,
      isValid: false,
      error,
      keyCount: 0,
      depth: 0,
      isPartial: false,
    };
  }
}

export function detectJson(input: string): JsonFormatResult | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Only trigger for things that look like JSON objects or arrays
  if (!/^\s*[\[{]/.test(trimmed)) return null;
  // Must have a closing bracket somewhere
  if (!trimmed.includes('}') && !trimmed.includes(']')) return null;
  return formatJson(trimmed);
}
