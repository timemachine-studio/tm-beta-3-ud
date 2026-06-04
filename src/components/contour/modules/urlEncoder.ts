/**
 * TimeMachine Contour - URL Encode/Decode Module
 *
 * Encodes and decodes URL strings using encodeURIComponent/decodeURIComponent.
 */

export interface UrlEncodeResult {
  input: string;
  encoded: string;
  decoded: string;
  mode: 'encode' | 'decode';
  error?: string;
  isPartial: boolean;
}

function safeEncodeUri(input: string): { encoded: string; error?: string } {
  try {
    return { encoded: encodeURIComponent(input) };
  } catch {
    return { encoded: '', error: 'Failed to encode' };
  }
}

function safeDecodeUri(input: string): { decoded: string; error?: string } {
  try {
    return { decoded: decodeURIComponent(input) };
  } catch {
    return { decoded: '', error: 'Invalid URL-encoded string' };
  }
}

export function encodeUrl(input: string): UrlEncodeResult {
  if (!input.trim()) {
    return { input, encoded: '', decoded: '', mode: 'encode', isPartial: true };
  }
  const { encoded, error } = safeEncodeUri(input);
  return { input, encoded, decoded: input, mode: 'encode', error, isPartial: false };
}

export function decodeUrl(input: string): UrlEncodeResult {
  if (!input.trim()) {
    return { input, encoded: '', decoded: '', mode: 'decode', isPartial: true };
  }
  const { decoded, error } = safeDecodeUri(input);
  return { input, encoded: input, decoded, mode: 'decode', error, isPartial: false };
}

export function processUrl(input: string, mode: 'encode' | 'decode'): UrlEncodeResult {
  return mode === 'encode' ? encodeUrl(input) : decodeUrl(input);
}

export function detectUrlEncoded(input: string): UrlEncodeResult | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Auto-detect: strings containing percent-encoded characters
  if (/%[0-9A-Fa-f]{2}/.test(trimmed)) {
    const result = decodeUrl(trimmed);
    if (!result.error) return result;
  }
  return null;
}
