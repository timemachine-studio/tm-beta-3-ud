/**
 * TimeMachine Contour - Regex Tester Module
 *
 * Tests regular expressions against test strings with match highlighting.
 */

export interface RegexMatch {
  match: string;
  index: number;
  length: number;
  groups?: Record<string, string>;
}

export interface RegexResult {
  pattern: string;
  flags: string;
  testString: string;
  matches: RegexMatch[];
  matchCount: number;
  isValid: boolean;
  error?: string;
  isPartial: boolean;
}

export function testRegex(pattern: string, testString: string, flags: string = 'g'): RegexResult {
  if (!pattern) {
    return {
      pattern, flags, testString,
      matches: [], matchCount: 0, isValid: true, isPartial: true,
    };
  }

  try {
    // Ensure 'g' flag is present for matchAll
    const effectiveFlags = flags.includes('g') ? flags : flags + 'g';
    const regex = new RegExp(pattern, effectiveFlags);
    const matches: RegexMatch[] = [];

    if (testString) {
      const allMatches = [...testString.matchAll(regex)];
      for (const m of allMatches) {
        matches.push({
          match: m[0],
          index: m.index ?? 0,
          length: m[0].length,
          groups: m.groups ? { ...m.groups } : undefined,
        });
      }
    }

    return {
      pattern, flags, testString,
      matches,
      matchCount: matches.length,
      isValid: true,
      isPartial: !testString,
    };
  } catch (e) {
    return {
      pattern, flags, testString,
      matches: [], matchCount: 0,
      isValid: false,
      error: e instanceof Error ? e.message : 'Invalid regex',
      isPartial: false,
    };
  }
}

export const REGEX_FLAGS = [
  { flag: 'g', label: 'Global', description: 'Find all matches' },
  { flag: 'i', label: 'Case-insensitive', description: 'Ignore case' },
  { flag: 'm', label: 'Multiline', description: '^ and $ match line boundaries' },
  { flag: 's', label: 'Dotall', description: '. matches newlines' },
] as const;

export const REGEX_PRESETS = [
  { name: 'Email', pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', test: 'user@example.com hello@test.org' },
  { name: 'URL', pattern: 'https?://[^\\s]+', test: 'Visit https://example.com or http://test.org today' },
  { name: 'Phone', pattern: '\\+?\\d[\\d\\s-]{7,}\\d', test: 'Call +1 555-123-4567 or 555 987 6543' },
  { name: 'IP Address', pattern: '\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}', test: 'Server at 192.168.1.1 and 10.0.0.1' },
] as const;
