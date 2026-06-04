/**
 * TimeMachine Contour - Base64 Encode/Decode Module
 *
 * Encodes and decodes Base64 strings.
 */

export interface Base64Result {
  input: string;
  encoded: string;
  decoded: string;
  mode: 'encode' | 'decode';
  error?: string;
  isPartial: boolean;
}

function isBase64(str: string): boolean {
  if (str.length < 4) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(str) && str.length % 4 === 0;
}

function safeEncode(input: string): { encoded: string; error?: string } {
  try {
    // Handle Unicode properly
    const encoded = btoa(unescape(encodeURIComponent(input)));
    return { encoded };
  } catch {
    return { encoded: '', error: 'Failed to encode' };
  }
}

function safeDecode(input: string): { decoded: string; error?: string } {
  try {
    const decoded = decodeURIComponent(escape(atob(input)));
    return { decoded };
  } catch {
    return { decoded: '', error: 'Invalid Base64 string' };
  }
}

export function encodeBase64(input: string): Base64Result {
  if (!input.trim()) {
    return { input, encoded: '', decoded: '', mode: 'encode', isPartial: true };
  }
  const { encoded, error } = safeEncode(input);
  return {
    input,
    encoded,
    decoded: input,
    mode: 'encode',
    error,
    isPartial: false,
  };
}

export function decodeBase64(input: string): Base64Result {
  if (!input.trim()) {
    return { input, encoded: '', decoded: '', mode: 'decode', isPartial: true };
  }
  const { decoded, error } = safeDecode(input);
  return {
    input,
    encoded: input,
    decoded,
    mode: 'decode',
    error,
    isPartial: false,
  };
}

export function processBase64(input: string, mode: 'encode' | 'decode'): Base64Result {
  return mode === 'encode' ? encodeBase64(input) : decodeBase64(input);
}

export function detectBase64(input: string): Base64Result | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length < 8) return null;
  // Auto-detect: if it looks like valid base64, decode it
  if (isBase64(trimmed)) {
    const result = decodeBase64(trimmed);
    if (!result.error) return result;
  }
  return null;
}
