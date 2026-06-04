/**
 * TimeMachine Contour - Translator Module
 *
 * Detects phrases like "food in bangla", "hello in spanish", "translate thank you to french".
 * Uses MyMemory Translation API (free, no key required) with localStorage caching.
 */

export interface TranslationResult {
  sourceText: string;
  sourceLang: string;
  sourceLangCode: string;
  targetLang: string;
  targetLangCode: string;
  translatedText: string | null;
  transliteration?: string;
  isPartial: boolean;
  isLoading: boolean;
  error?: string;
}

// ─── Language Database ────────────────────────────────────────

interface LangDef {
  code: string;
  name: string;
  nativeName: string;
  aliases: string[];
}

const LANGUAGES: LangDef[] = [
  { code: 'en', name: 'English', nativeName: 'English', aliases: ['english', 'eng'] },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', aliases: ['bengali', 'bangla', 'bangali'] },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', aliases: ['hindi'] },
  { code: 'es', name: 'Spanish', nativeName: 'Español', aliases: ['spanish', 'español', 'espanol'] },
  { code: 'fr', name: 'French', nativeName: 'Français', aliases: ['french', 'français', 'francais'] },
  { code: 'de', name: 'German', nativeName: 'Deutsch', aliases: ['german', 'deutsch'] },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', aliases: ['italian', 'italiano'] },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', aliases: ['portuguese', 'português', 'portugues'] },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', aliases: ['russian'] },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', aliases: ['japanese', 'nihongo'] },
  { code: 'ko', name: 'Korean', nativeName: '한국어', aliases: ['korean'] },
  { code: 'zh', name: 'Chinese', nativeName: '中文', aliases: ['chinese', 'mandarin', 'zhongwen'] },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', aliases: ['arabic'] },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', aliases: ['turkish', 'türkçe', 'turkce'] },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', aliases: ['thai'] },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', aliases: ['vietnamese'] },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', aliases: ['dutch', 'nederlands'] },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', aliases: ['polish', 'polski'] },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', aliases: ['ukrainian'] },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', aliases: ['swedish', 'svenska'] },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', aliases: ['danish', 'dansk'] },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', aliases: ['norwegian', 'norsk'] },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', aliases: ['finnish', 'suomi'] },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', aliases: ['greek'] },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', aliases: ['czech'] },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', aliases: ['romanian', 'romana'] },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', aliases: ['hungarian', 'magyar'] },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', aliases: ['indonesian', 'bahasa'] },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', aliases: ['malay', 'melayu'] },
  { code: 'tl', name: 'Filipino', nativeName: 'Filipino', aliases: ['filipino', 'tagalog'] },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', aliases: ['swahili'] },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', aliases: ['tamil'] },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', aliases: ['telugu'] },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', aliases: ['urdu'] },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', aliases: ['persian', 'farsi'] },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', aliases: ['hebrew'] },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', aliases: ['marathi'] },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', aliases: ['gujarati'] },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', aliases: ['kannada'] },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', aliases: ['malayalam'] },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', aliases: ['punjabi'] },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', aliases: ['nepali'] },
  { code: 'si', name: 'Sinhala', nativeName: 'සිංහල', aliases: ['sinhala', 'sinhalese'] },
  { code: 'my', name: 'Burmese', nativeName: 'ဗမာ', aliases: ['burmese', 'myanmar'] },
  { code: 'km', name: 'Khmer', nativeName: 'ខ្មែរ', aliases: ['khmer', 'cambodian'] },
  { code: 'lo', name: 'Lao', nativeName: 'ລາວ', aliases: ['lao', 'laotian'] },
  { code: 'ka', name: 'Georgian', nativeName: 'ქართული', aliases: ['georgian'] },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ', aliases: ['amharic'] },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', aliases: ['afrikaans'] },
  { code: 'sq', name: 'Albanian', nativeName: 'Shqip', aliases: ['albanian'] },
  { code: 'eu', name: 'Basque', nativeName: 'Euskara', aliases: ['basque'] },
  { code: 'ca', name: 'Catalan', nativeName: 'Català', aliases: ['catalan'] },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', aliases: ['croatian'] },
  { code: 'sr', name: 'Serbian', nativeName: 'Српски', aliases: ['serbian'] },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina', aliases: ['slovak'] },
  { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina', aliases: ['slovenian'] },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български', aliases: ['bulgarian'] },
  { code: 'et', name: 'Estonian', nativeName: 'Eesti', aliases: ['estonian'] },
  { code: 'lv', name: 'Latvian', nativeName: 'Latviešu', aliases: ['latvian'] },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių', aliases: ['lithuanian'] },
];

function findLang(name: string): LangDef | null {
  const lower = name.toLowerCase().trim();
  return LANGUAGES.find(l =>
    l.name.toLowerCase() === lower ||
    l.nativeName.toLowerCase() === lower ||
    l.code === lower ||
    l.aliases.includes(lower)
  ) || null;
}

// ─── Detection Patterns ───────────────────────────────────────

// Build language name pattern (sorted longest first for greedy match)
const langNames = LANGUAGES.flatMap(l => [l.name, ...l.aliases])
  .sort((a, b) => b.length - a.length);
const langPattern = langNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

// "PHRASE in LANGUAGE" — e.g., "food in bangla", "thank you in japanese"
const IN_PATTERN = new RegExp(
  `^(.+?)\\s+in\\s+(${langPattern})\\s*$`,
  'i'
);

// "translate PHRASE to LANGUAGE" — e.g., "translate hello to spanish"
const TRANSLATE_PATTERN = new RegExp(
  `^translate\\s+(.+?)\\s+(?:to|into)\\s+(${langPattern})\\s*$`,
  'i'
);

// "PHRASE to LANGUAGE" (shorter form) — e.g., "hello to french"
const TO_PATTERN = new RegExp(
  `^(.+?)\\s+to\\s+(${langPattern})\\s*$`,
  'i'
);

// Things that should NOT trigger translation (avoid clashing with unit/currency converters)
const BLOCKLIST = /^\s*-?[\d.,]+\s*(km|mi|lb|kg|oz|g|m|cm|ft|in|usd|eur|gbp|jpy|inr|c|f|k)\b/i;

export function detectTranslation(input: string): TranslationResult | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length < 3) return null;

  // Skip if it looks like a unit/currency conversion
  if (BLOCKLIST.test(trimmed)) return null;

  // Try patterns in order: "translate X to Y" > "X in Y" > "X to Y"
  let match = trimmed.match(TRANSLATE_PATTERN);
  if (!match) match = trimmed.match(IN_PATTERN);
  if (!match) match = trimmed.match(TO_PATTERN);

  if (!match) return null;

  const sourceText = match[1].trim();
  const targetLangName = match[2].trim();

  // Don't trigger for very short source text that could be other things
  if (sourceText.length < 1) return null;

  const targetLang = findLang(targetLangName);
  if (!targetLang) return null;

  // Skip if source text is purely numeric
  if (/^[\d.,\s]+$/.test(sourceText)) return null;

  return {
    sourceText,
    sourceLang: 'Auto',
    sourceLangCode: 'auto',
    targetLang: targetLang.name,
    targetLangCode: targetLang.code,
    translatedText: null,
    isPartial: false,
    isLoading: true,
  };
}

// ─── Translation API ──────────────────────────────────────────

const TRANSLATE_CACHE_KEY = 'contour_translations';
const TRANSLATE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface TranslateCache {
  entries: Record<string, { text: string; timestamp: number }>;
}

let translateCache: TranslateCache | null = null;

function loadTranslateCache(): TranslateCache {
  if (translateCache) return translateCache;
  try {
    const stored = localStorage.getItem(TRANSLATE_CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as TranslateCache;
      // Evict expired entries
      const now = Date.now();
      for (const key of Object.keys(parsed.entries)) {
        if (now - parsed.entries[key].timestamp > TRANSLATE_CACHE_TTL) {
          delete parsed.entries[key];
        }
      }
      translateCache = parsed;
      return parsed;
    }
  } catch { /* ignore */ }
  translateCache = { entries: {} };
  return translateCache;
}

function cacheKey(text: string, from: string, to: string): string {
  return `${from}:${to}:${text.toLowerCase().trim()}`;
}

function saveTranslateCache(): void {
  if (!translateCache) return;
  try {
    localStorage.setItem(TRANSLATE_CACHE_KEY, JSON.stringify(translateCache));
  } catch { /* quota exceeded */ }
}

export async function resolveTranslation(result: TranslationResult): Promise<TranslationResult> {
  if (result.isPartial) return result;

  const cache = loadTranslateCache();
  const key = cacheKey(result.sourceText, result.sourceLangCode, result.targetLangCode);

  // Check cache
  const cached = cache.entries[key];
  if (cached && Date.now() - cached.timestamp < TRANSLATE_CACHE_TTL) {
    return {
      ...result,
      translatedText: cached.text,
      isLoading: false,
    };
  }

  try {
    // MyMemory Translation API - free, no key needed
    const sourceLang = result.sourceLangCode === 'auto' ? 'en' : result.sourceLangCode;
    const langpair = `${sourceLang}|${result.targetLangCode}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(result.sourceText)}&langpair=${encodeURIComponent(langpair)}`;

    const response = await fetch(url);
    if (!response.ok) {
      return { ...result, isLoading: false, error: 'Translation service unavailable' };
    }

    const data = await response.json();

    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      const translated = data.responseData.translatedText;

      // Cache the result
      cache.entries[key] = { text: translated, timestamp: Date.now() };
      saveTranslateCache();

      // Detect source language from response if available
      const detectedLang = data.responseData?.detectedLanguage;
      let sourceLangName = result.sourceLang;
      let sourceLangCodeFinal = result.sourceLangCode;
      if (detectedLang) {
        const detected = LANGUAGES.find(l => l.code === detectedLang);
        if (detected) {
          sourceLangName = detected.name;
          sourceLangCodeFinal = detected.code;
        }
      }

      return {
        ...result,
        translatedText: translated,
        sourceLang: sourceLangName,
        sourceLangCode: sourceLangCodeFinal,
        isLoading: false,
      };
    }

    return { ...result, isLoading: false, error: data.responseData?.translatedText || 'Translation failed' };
  } catch {
    return { ...result, isLoading: false, error: 'Network error — check connection' };
  }
}

// ─── Interactive Mode Helpers ─────────────────────────────────

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
}

export const POPULAR_LANGUAGES = ['en', 'bn', 'hi', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'ar', 'pt', 'ru'];

export function getLanguageList(): LanguageOption[] {
  return LANGUAGES.map(l => ({
    code: l.code,
    name: l.name,
    nativeName: l.nativeName,
  }));
}

export function getLanguageName(code: string): string {
  const lang = LANGUAGES.find(l => l.code === code);
  return lang ? lang.name : code.toUpperCase();
}

/**
 * Direct translation for interactive UI (focused mode).
 * Returns a TranslationResult that needs resolving.
 */
export function translateDirect(text: string, fromCode: string, toCode: string): TranslationResult {
  const fromLang = LANGUAGES.find(l => l.code === fromCode);
  const toLang = LANGUAGES.find(l => l.code === toCode);

  return {
    sourceText: text,
    sourceLang: fromLang?.name || 'Auto',
    sourceLangCode: fromCode,
    targetLang: toLang?.name || toCode,
    targetLangCode: toCode,
    translatedText: null,
    isPartial: false,
    isLoading: true,
  };
}
