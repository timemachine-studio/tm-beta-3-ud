// ─── Core components & hook ────────────────────────────────────
export { ContourPanel } from './ContourPanel';
export { useContour } from './useContour';

// ─── Types (from centralized registry) ────────────────────────
export type { ContourState, ContourMode, ModuleId, ModuleData } from './moduleRegistry';
export { MODULE_META, HANDLER_TO_MODULE } from './moduleRegistry';

// ─── Commands ─────────────────────────────────────────────────
export type { ContourCommand, ContourCategory, ContourAction } from './modules/commands';
export { searchCommands, CONTOUR_COMMANDS, CATEGORY_INFO, getRecentCommands, recordCommandUsage } from './modules/commands';

// ─── Module functions (re-exported from registry) ─────────────
export {
  evaluateMath, isMathExpression,
  detectUnits,
  detectCurrency, resolveCurrency,
  detectTimezone,
  detectColor,
  detectDate,
  createTimerState, tickTimer, formatDuration, formatDurationLabel,
  detectRandom,
  detectWordCount, analyzeText,
  detectTranslation, resolveTranslation,
  detectDictionary, resolveDictionary,
  detectLorem,
  detectJson, formatJson,
  detectBase64, processBase64,
  detectUrlEncoded, processUrl,
  createHashResult, resolveHash,
  testRegex,
} from './moduleRegistry';

// ─── Module-specific extras (not in registry) ─────────────────
export { parseDuration } from './modules/timer';
export { regenerate, QUICK_ACTIONS } from './modules/randomGenerator';
export { getStatItems } from './modules/wordCounter';
export { getLanguageList, POPULAR_LANGUAGES } from './modules/translator';
export { lookupWord } from './modules/dictionary';
export { generateLorem } from './modules/loremIpsum';
export { REGEX_FLAGS, REGEX_PRESETS } from './modules/regexTester';
