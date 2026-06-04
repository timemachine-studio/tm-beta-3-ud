/**
 * TimeMachine Contour - Dictionary Module
 *
 * Looks up word definitions, phonetics, synonyms, and examples.
 * Detects inputs like "perplexed meaning", "meaning of perplexed", "define serendipity".
 * Uses Free Dictionary API (dictionaryapi.dev) with localStorage caching.
 */

export interface DictionaryMeaning {
  partOfSpeech: string;
  definitions: {
    definition: string;
    example?: string;
  }[];
  synonyms: string[];
  antonyms: string[];
}

export interface DictionaryResult {
  word: string;
  phonetic?: string;
  phoneticAudio?: string;
  meanings: DictionaryMeaning[];
  isLoading: boolean;
  error?: string;
}

// ─── Detection Patterns ───────────────────────────────────────

// "perplexed meaning" / "perplexed means"
const WORD_MEANING_PATTERN = /^(\w[\w\s-]{0,30}?)\s+(?:meaning|means|definition)$/i;

// "meaning of perplexed" / "definition of perplexed"
const MEANING_OF_PATTERN = /^(?:meaning|definition|meanings|definitions)\s+(?:of\s+)?(\w[\w\s-]{0,30}?)$/i;

// "define perplexed"
const DEFINE_PATTERN = /^define\s+(\w[\w\s-]{0,30}?)$/i;

// "perplexed?" — single word with question mark
const QUESTION_PATTERN = /^(\w{2,30})\?$/i;

// Things that should NOT trigger dictionary (avoid clashing with other modules)
const BLOCKLIST = /^(?:\d|#|rgb|hsl|translate|convert|random|roll|flip|uuid|password|timer|count|wc\s)/i;

export function detectDictionary(input: string): DictionaryResult | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length < 2) return null;

  // Skip blocklisted patterns
  if (BLOCKLIST.test(trimmed)) return null;

  let word: string | null = null;

  const m1 = trimmed.match(WORD_MEANING_PATTERN);
  if (m1) word = m1[1].trim();

  if (!word) {
    const m2 = trimmed.match(MEANING_OF_PATTERN);
    if (m2) word = m2[1].trim();
  }

  if (!word) {
    const m3 = trimmed.match(DEFINE_PATTERN);
    if (m3) word = m3[1].trim();
  }

  if (!word) {
    const m4 = trimmed.match(QUESTION_PATTERN);
    if (m4) word = m4[1].trim();
  }

  if (!word) return null;

  // Clean up - dictionary API works best with single words or short phrases
  word = word.toLowerCase().trim();
  if (!word || word.length < 2 || word.length > 40) return null;

  // Skip if it's a common stop word on its own
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'am', 'do', 'does', 'did', 'it', 'to', 'in', 'on', 'at', 'by', 'for', 'of', 'if', 'or', 'and', 'but', 'not', 'no', 'so', 'up', 'my', 'me', 'we', 'he', 'she']);
  if (stopWords.has(word)) return null;

  return {
    word,
    meanings: [],
    isLoading: true,
  };
}

// ─── Dictionary API ───────────────────────────────────────────

const DICT_CACHE_KEY = 'contour_dictionary';
const DICT_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days (definitions don't change)

interface DictCache {
  entries: Record<string, { result: DictionaryResult; timestamp: number }>;
}

let dictCache: DictCache | null = null;

function loadDictCache(): DictCache {
  if (dictCache) return dictCache;
  try {
    const stored = localStorage.getItem(DICT_CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as DictCache;
      // Evict expired entries
      const now = Date.now();
      for (const key of Object.keys(parsed.entries)) {
        if (now - parsed.entries[key].timestamp > DICT_CACHE_TTL) {
          delete parsed.entries[key];
        }
      }
      dictCache = parsed;
      return parsed;
    }
  } catch { /* ignore */ }
  dictCache = { entries: {} };
  return dictCache;
}

function saveDictCache(): void {
  if (!dictCache) return;
  try {
    // Limit cache size to ~50 entries
    const keys = Object.keys(dictCache.entries);
    if (keys.length > 50) {
      const sorted = keys.sort((a, b) =>
        dictCache!.entries[a].timestamp - dictCache!.entries[b].timestamp
      );
      for (let i = 0; i < sorted.length - 50; i++) {
        delete dictCache.entries[sorted[i]];
      }
    }
    localStorage.setItem(DICT_CACHE_KEY, JSON.stringify(dictCache));
  } catch { /* quota exceeded */ }
}

export async function resolveDictionary(result: DictionaryResult): Promise<DictionaryResult> {
  const cache = loadDictCache();
  const key = result.word.toLowerCase();

  // Check cache
  const cached = cache.entries[key];
  if (cached && Date.now() - cached.timestamp < DICT_CACHE_TTL) {
    return { ...cached.result, isLoading: false };
  }

  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(result.word)}`
    );

    if (response.status === 404) {
      const errorResult: DictionaryResult = {
        word: result.word,
        meanings: [],
        isLoading: false,
        error: `No definition found for "${result.word}"`,
      };
      return errorResult;
    }

    if (!response.ok) {
      return { ...result, isLoading: false, error: 'Dictionary service unavailable' };
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return { ...result, isLoading: false, error: 'No definitions found' };
    }

    const entry = data[0];

    // Extract phonetic
    let phonetic = entry.phonetic || '';
    let phoneticAudio = '';
    if (entry.phonetics && Array.isArray(entry.phonetics)) {
      for (const p of entry.phonetics) {
        if (p.text && !phonetic) phonetic = p.text;
        if (p.audio && !phoneticAudio) phoneticAudio = p.audio;
      }
    }

    // Extract meanings
    const meanings: DictionaryMeaning[] = [];
    if (entry.meanings && Array.isArray(entry.meanings)) {
      for (const m of entry.meanings) {
        const defs = (m.definitions || []).slice(0, 3).map((d: { definition?: string; example?: string }) => ({
          definition: d.definition || '',
          example: d.example,
        }));

        meanings.push({
          partOfSpeech: m.partOfSpeech || '',
          definitions: defs,
          synonyms: (m.synonyms || []).slice(0, 5),
          antonyms: (m.antonyms || []).slice(0, 5),
        });
      }
    }

    const resolved: DictionaryResult = {
      word: result.word,
      phonetic: phonetic || undefined,
      phoneticAudio: phoneticAudio || undefined,
      meanings,
      isLoading: false,
    };

    // Cache the result
    cache.entries[key] = { result: resolved, timestamp: Date.now() };
    saveDictCache();

    return resolved;
  } catch {
    return { ...result, isLoading: false, error: 'Network error — check connection' };
  }
}

/**
 * Direct lookup for focused mode UI.
 */
export function lookupWord(word: string): DictionaryResult {
  return {
    word: word.toLowerCase().trim(),
    meanings: [],
    isLoading: true,
  };
}
