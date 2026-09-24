import {
  detectNaturalMath,
  detectUnits,
  isMathExpression,
} from '../../components/contour/moduleRegistry';

const LANGUAGES = 'english|bangla|bengali|spanish|french|german|hindi|japanese|korean|chinese|arabic|italian|portuguese|russian';
const FILE_FORMATS = 'png|jpe?g|webp|gif|heic|mp3|wav|flac|mp4|mov|docx|pdf|csv|json';

function distance(left: string, right: string): number {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[right.length];
}

function hasApproximateWord(input: string, targets: readonly string[]): boolean {
  const words = input.toLowerCase().match(/[a-z]+/g) ?? [];
  return words.some(word => targets.some(target => {
    if (word === target) return true;
    const tolerance = target.length >= 8 ? 2 : target.length >= 5 ? 1 : 0;
    return tolerance > 0 && distance(word, target) <= tolerance;
  }));
}

const ACTION_WORDS = [
  'calculate', 'compute', 'multiply', 'divide', 'subtract', 'convert',
  'translate', 'define', 'timer', 'countdown', 'random', 'password', 'uuid',
  'encode', 'decode', 'hash', 'regex', 'graph', 'plot', 'note', 'remember',
  'schedule', 'event', 'search', 'browse', 'settings', 'history', 'album',
  'memories', 'snippet', 'timestamp', 'timezone', 'lorem',
] as const;

const CHAT_FIRST = [
  /^(?:please\s+)?(?:write|draft|compose|create)\s+(?:me\s+)?(?:an?\s+)?(?:paragraph|essay|story|poem|email|message|article|report|caption|post)\b/i,
  /^(?:explain|tell me|describe|discuss|summari[sz]e|brainstorm)\b/i,
  /\b(?:should|could|would)\s+i\b/i,
  /^(?:what do you think|give me advice|help me decide)\b/i,
];

/**
 * Cheap abstention gate before the model. Extended is not a general intent
 * classifier: it is consulted only when the draft contains evidence that one
 * of Contour's bounded actions may be intended.
 */
export function shouldConsultContourExtended(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.length < 3 || trimmed.startsWith('/')) return false;
  if (CHAT_FIRST.some(pattern => pattern.test(trimmed))) return false;
  if (detectNaturalMath(trimmed) || isMathExpression(trimmed) || detectUnits(trimmed)) return true;
  if (/^(?:\{|\[)[\s\S]*(?:\}|\])$/.test(trimmed)) return true;
  if (/\bwork\s+out\b/i.test(trimmed)) return true;
  if (/^(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/\S*)?$/i.test(trimmed)) return true;
  if (new RegExp(`\\b(?:in|to)\\s+(?:${LANGUAGES})\\b`, 'i').test(trimmed)) return true;
  if (/\d[\s\S]*\b(?:to|into|as)\b/i.test(trimmed)) return true;
  return hasApproximateWord(trimmed, ACTION_WORDS);
}

export function isContourCandidateGrounded(
  handler: string | null,
  commandId: string,
  input: string,
): boolean {
  const text = input.toLowerCase().trim();

  switch (handler) {
    case 'calculator': return !!detectNaturalMath(text) || isMathExpression(text) || /\b(?:work out|calculate|compute)\b/.test(text);
    case 'unit-converter': return !!detectUnits(text) || (/\bconvert\w*\b/.test(text) && /\d/.test(text) && /\b(?:to|into|as)\b/.test(text));
    case 'currency-converter': return /\d/.test(text) && /\b(?:to|into|worth|currency|exchange)\b/.test(text) && /\b(?:usd|eur|gbp|jpy|cad|aud|inr|bdt|dollar|euro|pound|yen|taka)\b/.test(text);
    case 'timezone': return /\b(?:timezone|time zone|utc|gmt|est|pst|cst|ist|time in)\b/.test(text);
    case 'color-converter': return /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hex|colou?r)\b/i.test(text);
    case 'date-calculator': return /\b(?:days? (?:until|between|from|ago)|date difference|today|tomorrow|yesterday)\b/.test(text);
    case 'timer': return /\b(?:timer|countdown|stopwatch)\b/.test(text);
    case 'random': return /\b(?:random|roll|dice|coin flip|password|uuid)\b/.test(text);
    case 'word-count': return /\b(?:word count|count (?:the )?(?:words|characters|chars)|wc)\b/.test(text);
    case 'translator': return /\btranslat\w*\b/.test(text) || new RegExp(`\\b(?:say|word|phrase|this)\b[\\s\\S]*\\b(?:in|to)\\s+(?:${LANGUAGES})\\b`, 'i').test(text);
    case 'dictionary': return /\b(?:define|definition|meaning|means|dictionary|synonym|antonym)\b/.test(text);
    case 'lorem': return /\b(?:lorem|ipsum|placeholder text|dummy text)\b/.test(text);
    case 'json-format': return /\bjson\b/.test(text) || /^(?:\{|\[)[\s\S]*(?:\}|\])$/.test(text);
    case 'base64': return /\bbase ?64\b/.test(text);
    case 'url-encode': return /\b(?:url|uri|percent)[ -]?(?:encode|decode)\b|\b(?:encode|decode)[\s\S]*\b(?:url|uri)\b/.test(text);
    case 'hash': return /\b(?:hash|md5|sha-?1|sha-?256|checksum|digest)\b/.test(text);
    case 'regex': return /\b(?:regex|regexp|regular expression)\b/.test(text);
    case 'graph-plotter': return /\b(?:graph|plot|chart|equation|function curve)\b|\by\s*=/.test(text);
    case 'snippets': return /\b(?:snippet|prompt template|text template)\b/.test(text);
    case 'quick-note': return /\b(?:note|jot|remember|capture|stash)\b/.test(text) && !CHAT_FIRST.some(pattern => pattern.test(text));
    case 'quick-event': return /\b(?:schedule|calendar|event|meeting|appointment)\b/.test(text);
    case 'web-viewer': return /\b(?:search|google|browse|look up|open (?:the )?(?:site|website|url))\b/.test(text) || /^(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}/.test(text);
    case 'file-convert': return new RegExp(`\\bconvert\\w*\\b[\\s\\S]*\\b(?:${FILE_FORMATS})\\b`, 'i').test(text);
    case 'help': return /\b(?:contour|timemachine|this app)\b[\s\S]*\b(?:help|how|guide|docs|documentation)\b|\bhelp with contour\b/.test(text);
    case 'uuid': return /\buuid|guid|unique id\b/.test(text);
    case 'timestamp': return /\b(?:unix|epoch)?\s*timestamp\b/.test(text);
    default:
      break;
  }

  const commandPatterns: Record<string, RegExp> = {
    settings: /\b(?:open|show|go to)?\s*(?:app )?(?:settings|preferences)\b/,
    history: /\b(?:open|show|view|go to)\s+(?:my )?(?:chat )?history\b/,
    album: /\b(?:open|show|view|go to)\s+(?:my )?(?:album|image gallery)\b/,
    memories: /\b(?:open|show|view|go to)\s+(?:my )?memories\b/,
    'web-coding': /\b(?:start|open|use)\s+(?:the )?web coding\b/,
    'music-compose': /\b(?:start|open|use)\s+(?:music compose|music mode)\b/,
    healthcare: /\b(?:start|open|use)\s+(?:tm )?healthcare\b/,
  };
  return commandPatterns[commandId]?.test(text) ?? false;
}
