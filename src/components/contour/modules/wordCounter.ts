/**
 * TimeMachine Contour - Word Counter Module
 *
 * Counts words, characters, sentences, paragraphs, and reading time.
 * Activated via /word-count command (focused mode) or by typing "count words ..." / "wc ...".
 * Pure client-side, no API calls.
 */

export interface WordCountResult {
  text: string;
  characters: number;
  charactersNoSpaces: number;
  words: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  readingTime: string;
  speakingTime: string;
  isPartial: boolean;
}

// ─── Core Counting Logic ──────────────────────────────────────

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function countSentences(text: string): number {
  if (!text.trim()) return 0;
  // Split on sentence-ending punctuation followed by space or end-of-string
  const matches = text.match(/[.!?]+(?:\s|$)/g);
  return matches ? matches.length : (text.trim().length > 0 ? 1 : 0);
}

function countParagraphs(text: string): number {
  if (!text.trim()) return 0;
  return text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length || 1;
}

function countLines(text: string): number {
  if (!text.trim()) return 0;
  return text.split(/\n/).filter(l => l.trim().length > 0).length;
}

function formatTime(minutes: number): string {
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function computeStats(text: string): WordCountResult {
  const words = countWords(text);
  const readingMinutes = words / 238; // Average adult reading speed
  const speakingMinutes = words / 150; // Average speaking speed

  return {
    text,
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, '').length,
    words,
    sentences: countSentences(text),
    paragraphs: countParagraphs(text),
    lines: countLines(text),
    readingTime: formatTime(readingMinutes),
    speakingTime: formatTime(speakingMinutes),
    isPartial: false,
  };
}

// ─── Detection ────────────────────────────────────────────────

// Auto-detect patterns:
// "count words in <text>" / "word count <text>" / "wc <text>" / "count <text>"
const WC_PREFIX_PATTERN = /^(?:(?:count\s+(?:words|chars?|characters?)\s+(?:in\s+)?)|(?:word\s*count\s+)|(?:wc\s+))(.+)$/is;

export function detectWordCount(input: string): WordCountResult | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = trimmed.match(WC_PREFIX_PATTERN);
  if (match) {
    const text = match[1].trim();
    if (text.length > 0) {
      return computeStats(text);
    }
  }

  return null;
}

/**
 * Direct analysis for focused mode - any text gets counted.
 */
export function analyzeText(text: string): WordCountResult {
  return computeStats(text);
}

// ─── Stat Display Helpers ─────────────────────────────────────

export interface StatItem {
  label: string;
  value: string | number;
  icon: string;
}

export function getStatItems(result: WordCountResult): StatItem[] {
  return [
    { label: 'Words', value: result.words.toLocaleString(), icon: 'Type' },
    { label: 'Characters', value: result.characters.toLocaleString(), icon: 'LetterText' },
    { label: 'No Spaces', value: result.charactersNoSpaces.toLocaleString(), icon: 'RemoveFormatting' },
    { label: 'Sentences', value: result.sentences.toLocaleString(), icon: 'MessageSquare' },
    { label: 'Paragraphs', value: result.paragraphs.toLocaleString(), icon: 'AlignLeft' },
    { label: 'Lines', value: result.lines.toLocaleString(), icon: 'List' },
    { label: 'Reading', value: result.readingTime, icon: 'BookOpen' },
    { label: 'Speaking', value: result.speakingTime, icon: 'Mic' },
  ];
}
