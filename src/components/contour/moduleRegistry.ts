/**
 * TimeMachine Contour - Module Registry
 *
 * Centralizes all module metadata, handler mappings, types, and
 * re-exports detect/process functions. Adding a new module requires
 * editing only this file (plus creating its module + view files).
 */

import React from 'react';
import {
  Calculator, ArrowLeftRight, DollarSign, Globe, Palette,
  Timer, Calendar, Shuffle, Type, Braces, Lock, Link, Hash,
  FileSearch, FileText, BookOpen, HelpCircle, TrendingUp,
} from 'lucide-react';

// ─── Result types (re-exported from individual modules) ────────

export type { CalculatorResult } from './modules/calculator';
export type { UnitResult } from './modules/unitConverter';
export type { CurrencyResult } from './modules/currencyConverter';
export type { TimezoneResult } from './modules/timezoneConverter';
export type { ColorResult } from './modules/colorConverter';
export type { DateResult } from './modules/dateCalculator';
export type { TimerState } from './modules/timer';
export type { RandomResult } from './modules/randomGenerator';
export type { WordCountResult } from './modules/wordCounter';
export type { TranslationResult } from './modules/translator';
export type { DictionaryResult } from './modules/dictionary';
export type { LoremResult } from './modules/loremIpsum';
export type { JsonFormatResult } from './modules/jsonFormatter';
export type { Base64Result } from './modules/base64Codec';
export type { UrlEncodeResult } from './modules/urlEncoder';
export type { HashResult } from './modules/hashGenerator';
export type { RegexResult } from './modules/regexTester';
export type { GraphResult } from './modules/graphPlotter';
export type { SnippetResult } from './modules/snippetManager';
export type { NavigationResult } from './modules/appNavigation';
export type { QuickNoteResult } from './modules/quickNote';
export type { QuickEventResult } from './modules/quickEvent';
export type { WebViewerResult } from './modules/webViewer';

// ─── Detect functions (re-exported) ───────────────────────────

export { isMathExpression, evaluateMath } from './modules/calculator';
export { detectUnits } from './modules/unitConverter';
export { detectCurrency, resolveCurrency } from './modules/currencyConverter';
export { detectTimezone } from './modules/timezoneConverter';
export { detectColor } from './modules/colorConverter';
export { detectDate } from './modules/dateCalculator';
export { createTimerState, tickTimer, formatDuration, formatDurationLabel } from './modules/timer';
export { detectRandom } from './modules/randomGenerator';
export { detectWordCount, analyzeText } from './modules/wordCounter';
export { detectTranslation, resolveTranslation } from './modules/translator';
export { detectDictionary, resolveDictionary } from './modules/dictionary';
export { detectLorem } from './modules/loremIpsum';
export { detectJson, formatJson } from './modules/jsonFormatter';
export { detectBase64, processBase64 } from './modules/base64Codec';
export { detectUrlEncoded, processUrl } from './modules/urlEncoder';
export { createHashResult, resolveHash } from './modules/hashGenerator';
export { testRegex } from './modules/regexTester';
export { detectGraph } from './modules/graphPlotter';
export { createSnippetResult } from './modules/snippetManager';
export { detectNavigation } from './modules/appNavigation';
export { detectQuickNote } from './modules/quickNote';
export { detectQuickEvent } from './modules/quickEvent';
export { detectWebViewer } from './modules/webViewer';

// ─── Core types ───────────────────────────────────────────────

import type { CalculatorResult } from './modules/calculator';
import type { UnitResult } from './modules/unitConverter';
import type { CurrencyResult } from './modules/currencyConverter';
import type { TimezoneResult } from './modules/timezoneConverter';
import type { ColorResult } from './modules/colorConverter';
import type { DateResult } from './modules/dateCalculator';
import type { TimerState } from './modules/timer';
import type { RandomResult } from './modules/randomGenerator';
import type { WordCountResult } from './modules/wordCounter';
import type { TranslationResult } from './modules/translator';
import type { DictionaryResult } from './modules/dictionary';
import type { LoremResult } from './modules/loremIpsum';
import type { JsonFormatResult } from './modules/jsonFormatter';
import type { Base64Result } from './modules/base64Codec';
import type { UrlEncodeResult } from './modules/urlEncoder';
import type { HashResult } from './modules/hashGenerator';
import type { RegexResult } from './modules/regexTester';
import type { GraphResult } from './modules/graphPlotter';
import type { SnippetResult } from './modules/snippetManager';
import type { NavigationResult } from './modules/appNavigation';
import type { QuickNoteResult } from './modules/quickNote';
import type { QuickEventResult } from './modules/quickEvent';
import type { WebViewerResult } from './modules/webViewer';

import { ContourCommand, searchCommands, groupByCategory } from './modules/commands';
export { searchCommands, groupByCategory };
export type { ContourCommand };

export type ModuleId =
  | 'calculator' | 'units' | 'currency' | 'timezone' | 'color'
  | 'date' | 'timer' | 'random' | 'wordcount'
  | 'translator' | 'dictionary'
  | 'translator' | 'dictionary'
  | 'lorem' | 'json-format' | 'base64' | 'url-encode' | 'hash' | 'regex'
  | 'graph'
  | 'snippets' | 'navigation'
  | 'quick-note' | 'quick-event'
  | 'web-viewer'
  | 'help';

export type ContourMode = 'hidden' | 'commands' | 'module';

export interface ModuleData {
  id: ModuleId;
  focused: boolean;
  calculator?: CalculatorResult;
  units?: UnitResult;
  currency?: CurrencyResult;
  timezone?: TimezoneResult;
  color?: ColorResult;
  date?: DateResult;
  timer?: TimerState;
  random?: RandomResult;
  wordcount?: WordCountResult;
  translator?: TranslationResult;
  dictionary?: DictionaryResult;
  lorem?: LoremResult;
  jsonFormat?: JsonFormatResult;
  base64?: Base64Result;
  urlEncode?: UrlEncodeResult;
  hash?: HashResult;
  regex?: RegexResult;
  graph?: GraphResult;
  snippets?: SnippetResult;
  navigation?: NavigationResult;
  quickNote?: QuickNoteResult;
  quickEvent?: QuickEventResult;
  webViewer?: WebViewerResult;
}

export interface ContourState {
  mode: ContourMode;
  module: ModuleData | null;
  commands: ContourCommand[];
  commandQuery: string;
  selectedIndex: number;
}

// ─── Handler → Module mapping ─────────────────────────────────

export const HANDLER_TO_MODULE: Record<string, ModuleId> = {
  'calculator': 'calculator',
  'unit-converter': 'units',
  'currency-converter': 'currency',
  'timezone': 'timezone',
  'color-converter': 'color',
  'date-calculator': 'date',
  'timer': 'timer',
  'random': 'random',
  'word-count': 'wordcount',
  'translator': 'translator',
  'dictionary': 'dictionary',
  'lorem': 'lorem',
  'json-format': 'json-format',
  'base64': 'base64',
  'url-encode': 'url-encode',
  'hash': 'hash',
  'regex': 'regex',
  'graph-plotter': 'graph',
  'snippets': 'snippets',
  'web-viewer': 'web-viewer',
  'quick-note': 'quick-note',
  'quick-event': 'quick-event',
  'help': 'help',
};

// ─── Module metadata ──────────────────────────────────────────

export const MODULE_META: Record<ModuleId, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  placeholder: string;
}> = {
  calculator: { icon: Calculator, label: 'Calculator', placeholder: 'Type a math expression... (e.g., 5+3*2)' },
  units: { icon: ArrowLeftRight, label: 'Unit Converter', placeholder: 'e.g., 5km to miles, 100f to c, 2kg to lb' },
  currency: { icon: DollarSign, label: 'Currency Converter', placeholder: 'e.g., 50 usd to eur, 100 gbp to jpy' },
  timezone: { icon: Globe, label: 'Timezone Converter', placeholder: 'e.g., 3pm EST in IST, now in Tokyo' },
  color: { icon: Palette, label: 'Color Converter', placeholder: 'e.g., #ff5733, rgb(255,87,51), coral' },
  date: { icon: Calendar, label: 'Date Calculator', placeholder: 'e.g., days until Dec 25, 30 days from now' },
  timer: { icon: Timer, label: 'Timer', placeholder: 'e.g., 5m, 1h30m, 90s, 10:00' },
  random: { icon: Shuffle, label: 'Random Generator', placeholder: 'e.g., uuid, password 16, roll 2d6, flip coin, random 1-100' },
  wordcount: { icon: Type, label: 'Word Counter', placeholder: 'Type or paste text to count words, characters, sentences...' },
  translator: { icon: Globe, label: 'Translator', placeholder: 'e.g., food in bangla, hello in spanish, translate thanks to french' },
  dictionary: { icon: BookOpen, label: 'Dictionary', placeholder: 'e.g., perplexed meaning, define serendipity' },
  lorem: { icon: FileText, label: 'Lorem Ipsum', placeholder: 'e.g., lorem 3p, lorem 5s, lorem 50w' },
  'json-format': { icon: Braces, label: 'JSON Formatter', placeholder: 'Paste JSON to format or validate...' },
  base64: { icon: Lock, label: 'Base64', placeholder: 'Type text to encode, or paste Base64 to decode' },
  'url-encode': { icon: Link, label: 'URL Encoder', placeholder: 'Type text to encode, or paste encoded URL to decode' },
  hash: { icon: Hash, label: 'Hash Generator', placeholder: 'Type text to generate MD5, SHA-1, SHA-256 hashes' },
  regex: { icon: FileSearch, label: 'Regex Tester', placeholder: 'Type a regex pattern to test...' },
  graph: { icon: TrendingUp, label: 'Graph Plotter', placeholder: 'Type an equation, e.g. sin(x) · x^2+3x+7 · y=2x+1' },
  snippets: { icon: FileText, label: 'Snippets', placeholder: 'Manage your text snippets and prompts...' },
  navigation: { icon: FileText, label: 'Navigation', placeholder: 'Navigate across the app...' },
  'quick-note': { icon: FileText, label: 'Quick Note', placeholder: 'Type notes...' },
  'quick-event': { icon: Calendar, label: 'Quick Event', placeholder: 'Type event...' },
  'web-viewer': { icon: Globe, label: 'Web Viewer', placeholder: 'Search DuckDuckGo or go to URL...' },
  help: { icon: HelpCircle, label: 'Help', placeholder: '' },
};
