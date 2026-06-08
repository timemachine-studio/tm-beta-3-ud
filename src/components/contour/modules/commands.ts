/**
 * TimeMachine Contour - Slash Commands Registry
 *
 * Defines all available commands accessible via "/" in the textbox.
 * Each command has a name, description, icon, category, and action type.
 */

export interface ContourCommand {
  id: string;
  name: string;
  description: string;
  icon: string;       // Lucide icon name
  category: ContourCategory;
  keywords: string[]; // Extra search terms
  action: ContourAction;
}

export type ContourCategory =
  | 'calculator'
  | 'converter'
  | 'utility'
  | 'system'
  | 'search'
  | 'developer'
  | 'productivity'
  | 'recents';

export type ContourAction =
  | { type: 'inline'; handler: string }  // Runs inline in the contour panel
  | { type: 'navigate'; path: string }   // Navigate to a route
  | { type: 'mode'; mode: string }       // Activate a mode (like plus menu)
  | { type: 'clipboard'; handler: string } // Copy something to clipboard
  | { type: 'external'; url: string };    // Open external link

export const CONTOUR_COMMANDS: ContourCommand[] = [
  // Calculator & Math
  {
    id: 'calculator',
    name: 'Calculator',
    description: 'Quick math calculations',
    icon: 'Calculator',
    category: 'calculator',
    keywords: ['math', 'calc', 'compute', 'add', 'subtract', 'multiply', 'divide'],
    action: { type: 'inline', handler: 'calculator' },
  },
  {
    id: 'graph-plotter',
    name: 'Graph Plotter',
    description: 'Plot equations like y=sin(x), x²+3x+7, e^x',
    icon: 'TrendingUp',
    category: 'calculator',
    keywords: ['graph', 'plot', 'equation', 'function', 'curve', 'desmos', 'sin', 'cos', 'math', 'chart'],
    action: { type: 'inline', handler: 'graph-plotter' },
  },

  // Unit Converters
  {
    id: 'convert-units',
    name: 'Unit Converter',
    description: 'Convert between units (km, miles, kg, etc.)',
    icon: 'ArrowLeftRight',
    category: 'converter',
    keywords: ['convert', 'units', 'km', 'miles', 'celsius', 'fahrenheit', 'kg', 'pounds', 'meters', 'feet'],
    action: { type: 'inline', handler: 'unit-converter' },
  },
  {
    id: 'convert-currency',
    name: 'Currency Converter',
    description: 'Convert between currencies',
    icon: 'DollarSign',
    category: 'converter',
    keywords: ['money', 'usd', 'eur', 'gbp', 'exchange', 'rate', 'forex'],
    action: { type: 'inline', handler: 'currency-converter' },
  },
  {
    id: 'convert-timezone',
    name: 'Timezone Converter',
    description: 'Convert time between zones',
    icon: 'Globe',
    category: 'converter',
    keywords: ['time', 'zone', 'utc', 'est', 'pst', 'gmt', 'ist', 'world clock'],
    action: { type: 'inline', handler: 'timezone' },
  },
  {
    id: 'convert-color',
    name: 'Color Converter',
    description: 'Convert between HEX, RGB, HSL',
    icon: 'Palette',
    category: 'converter',
    keywords: ['hex', 'rgb', 'hsl', 'color', 'colour', 'picker'],
    action: { type: 'inline', handler: 'color-converter' },
  },

  // Utilities
  {
    id: 'timer',
    name: 'Timer',
    description: 'Set a quick timer or stopwatch',
    icon: 'Timer',
    category: 'utility',
    keywords: ['countdown', 'stopwatch', 'alarm', 'clock'],
    action: { type: 'inline', handler: 'timer' },
  },
  {
    id: 'date-calc',
    name: 'Date Calculator',
    description: 'Calculate days between dates or add/subtract days',
    icon: 'Calendar',
    category: 'utility',
    keywords: ['days', 'between', 'date', 'ago', 'from now', 'difference'],
    action: { type: 'inline', handler: 'date-calculator' },
  },
  {
    id: 'random',
    name: 'Random Generator',
    description: 'Generate random numbers, UUIDs, passwords',
    icon: 'Shuffle',
    category: 'utility',
    keywords: ['random', 'uuid', 'password', 'generate', 'dice', 'coin', 'flip'],
    action: { type: 'inline', handler: 'random' },
  },
  {
    id: 'word-count',
    name: 'Word Counter',
    description: 'Count words, characters, and sentences',
    icon: 'Type',
    category: 'utility',
    keywords: ['count', 'words', 'characters', 'length', 'text'],
    action: { type: 'inline', handler: 'word-count' },
  },

  // Language
  {
    id: 'translator',
    name: 'Translator',
    description: 'Translate text between languages',
    icon: 'Languages',
    category: 'utility',
    keywords: ['translate', 'translation', 'language', 'bangla', 'spanish', 'french', 'hindi', 'japanese', 'korean', 'chinese', 'arabic'],
    action: { type: 'inline', handler: 'translator' },
  },
  {
    id: 'dictionary',
    name: 'Dictionary',
    description: 'Look up word definitions, synonyms, and examples',
    icon: 'BookOpen',
    category: 'utility',
    keywords: ['dictionary', 'define', 'meaning', 'definition', 'synonym', 'antonym', 'word', 'lookup'],
    action: { type: 'inline', handler: 'dictionary' },
  },

  // Developer Tools
  {
    id: 'json-format',
    name: 'JSON Formatter',
    description: 'Format and validate JSON',
    icon: 'Braces',
    category: 'developer',
    keywords: ['json', 'format', 'prettify', 'validate', 'parse'],
    action: { type: 'inline', handler: 'json-format' },
  },
  {
    id: 'base64',
    name: 'Base64 Encode/Decode',
    description: 'Encode or decode Base64 strings',
    icon: 'Lock',
    category: 'developer',
    keywords: ['base64', 'encode', 'decode', 'encryption'],
    action: { type: 'inline', handler: 'base64' },
  },
  {
    id: 'url-encode',
    name: 'URL Encode/Decode',
    description: 'Encode or decode URL strings',
    icon: 'Link',
    category: 'developer',
    keywords: ['url', 'encode', 'decode', 'percent', 'uri'],
    action: { type: 'inline', handler: 'url-encode' },
  },
  {
    id: 'hash',
    name: 'Hash Generator',
    description: 'Generate MD5, SHA-1, SHA-256 hashes',
    icon: 'Hash',
    category: 'developer',
    keywords: ['hash', 'md5', 'sha', 'checksum', 'digest'],
    action: { type: 'inline', handler: 'hash' },
  },
  {
    id: 'regex-test',
    name: 'Regex Tester',
    description: 'Test regular expressions live',
    icon: 'FileSearch',
    category: 'developer',
    keywords: ['regex', 'regexp', 'pattern', 'match', 'test'],
    action: { type: 'inline', handler: 'regex' },
  },
  {
    id: 'lorem',
    name: 'Lorem Ipsum',
    description: 'Generate placeholder text',
    icon: 'FileText',
    category: 'developer',
    keywords: ['lorem', 'ipsum', 'placeholder', 'dummy', 'text'],
    action: { type: 'inline', handler: 'lorem' },
  },

  // System / Navigation
  {
    id: 'settings',
    name: 'Settings',
    description: 'Open app settings',
    icon: 'Settings',
    category: 'system',
    keywords: ['settings', 'preferences', 'config', 'options'],
    action: { type: 'navigate', path: '/settings' },
  },
  {
    id: 'history',
    name: 'Chat History',
    description: 'View past conversations',
    icon: 'History',
    category: 'system',
    keywords: ['history', 'past', 'conversations', 'chats', 'previous'],
    action: { type: 'navigate', path: '/history' },
  },
  {
    id: 'album',
    name: 'Album',
    description: 'View generated images',
    icon: 'Image',
    category: 'system',
    keywords: ['album', 'gallery', 'images', 'photos', 'generated'],
    action: { type: 'navigate', path: '/album' },
  },
  {
    id: 'memories',
    name: 'Memories',
    description: 'View saved memories',
    icon: 'Brain',
    category: 'system',
    keywords: ['memories', 'saved', 'remember', 'notes'],
    action: { type: 'navigate', path: '/memories' },
  },
  {
    id: 'help',
    name: 'Help',
    description: 'Get help and documentation',
    icon: 'HelpCircle',
    category: 'system',
    keywords: ['help', 'docs', 'documentation', 'how', 'guide', 'contour'],
    action: { type: 'inline', handler: 'help' },
  },

  // Modes
  {
    id: 'web-viewer',
    name: 'Web Search',
    description: 'Type /search <query> or /google <query> or just a URL',
    icon: 'Globe',
    category: 'search',
    keywords: ['web', 'search', 'google', 'duckduckgo', 'browser', 'internet'],
    action: { type: 'inline', handler: 'web-viewer' },
  },
  {
    id: 'quick-note',
    name: 'Quick Note',
    description: 'Type /note <text> to quickly save thoughts',
    icon: 'FileText',
    category: 'productivity',
    keywords: ['note', 'capture', 'quick', 'thought', 'write'],
    action: { type: 'inline', handler: 'quick-note' },
  },
  {
    id: 'quick-event',
    name: 'Quick Event',
    description: 'Type /event <text> to schedule quickly',
    icon: 'Calendar',
    category: 'productivity',
    keywords: ['event', 'calendar', 'schedule', 'meeting'],
    action: { type: 'inline', handler: 'quick-event' },
  },
  {
    id: 'snippets',
    name: 'Snippets Manager',
    description: 'Manage and copy text snippets/prompts',
    icon: 'FileText',
    category: 'productivity',
    keywords: ['snippets', 'templates', 'prompts', 'text', 'expansion'],
    action: { type: 'inline', handler: 'snippets' },
  },
  {
    id: 'web-coding',
    name: 'Web Coding Mode',
    description: 'Start a web coding session',
    icon: 'Code',
    category: 'productivity',
    keywords: ['code', 'coding', 'web', 'html', 'css', 'javascript', 'programming'],
    action: { type: 'mode', mode: 'web-coding' },
  },
  {
    id: 'music-compose',
    name: 'Music Compose',
    description: 'Compose music with AI',
    icon: 'Music',
    category: 'productivity',
    keywords: ['music', 'compose', 'song', 'melody', 'audio'],
    action: { type: 'mode', mode: 'music-compose' },
  },
  {
    id: 'healthcare',
    name: 'TM Healthcare',
    description: 'Health assistant mode',
    icon: 'HeartPulse',
    category: 'productivity',
    keywords: ['health', 'healthcare', 'medical', 'fitness', 'wellness'],
    action: { type: 'mode', mode: 'tm-healthcare' },
  },

  // Clipboard utilities
  {
    id: 'copy-uuid',
    name: 'Generate UUID',
    description: 'Generate and copy a UUID',
    icon: 'Fingerprint',
    category: 'utility',
    keywords: ['uuid', 'guid', 'unique', 'id', 'identifier'],
    action: { type: 'clipboard', handler: 'uuid' },
  },
  {
    id: 'copy-timestamp',
    name: 'Copy Timestamp',
    description: 'Copy current Unix timestamp',
    icon: 'Clock',
    category: 'utility',
    keywords: ['timestamp', 'unix', 'epoch', 'time', 'now'],
    action: { type: 'clipboard', handler: 'timestamp' },
  },
];

/**
 * Category display info
 */
export const CATEGORY_INFO: Record<ContourCategory, { label: string; icon: string }> = {
  calculator: { label: 'Calculator', icon: 'Calculator' },
  converter: { label: 'Converters', icon: 'ArrowLeftRight' },
  utility: { label: 'Utilities', icon: 'Wrench' },
  system: { label: 'System', icon: 'Monitor' },
  search: { label: 'Search', icon: 'Search' },
  developer: { label: 'Developer', icon: 'Code' },
  productivity: { label: 'Productivity', icon: 'Zap' },
  recents: { label: 'Recent', icon: 'Clock' },
};

/**
 * Group commands by category, preserving insertion order.
 * Used by both ContourPanel (render) and useContour (selection).
 */
export function groupByCategory(commands: ContourCommand[]): { category: ContourCategory; commands: ContourCommand[] }[] {
  const grouped = new Map<ContourCategory, ContourCommand[]>();
  for (const cmd of commands) {
    const list = grouped.get(cmd.category) || [];
    list.push(cmd);
    grouped.set(cmd.category, list);
  }
  return Array.from(grouped.entries()).map(([category, commands]) => ({ category, commands }));
}

// ─── Fuzzy scoring ─────────────────────────────────────────────

function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (q.length === 0) return 0;

  let qi = 0;
  let score = 0;
  let consecutive = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    const isBoundary = ti === 0 || /[\s\-_]/.test(t[ti - 1]);
    if (t[ti] === q[qi]) {
      score += 1 + consecutive;
      if (isBoundary) score += 5; // word boundary bonus
      if (ti === 0) score += 3;   // start of string bonus
      consecutive++;
      qi++;
    } else {
      consecutive = 0;
    }
  }

  return qi === q.length ? score : 0; // 0 if not all chars matched
}

/**
 * Search/filter commands by query string.
 * Uses fuzzy matching against name, description, keywords, and ID.
 */
export function searchCommands(query: string): ContourCommand[] {
  if (!query) {
    // Show recent commands at the top, then all commands
    const recentIds = getRecentCommands();
    if (recentIds.length === 0) return CONTOUR_COMMANDS;

    const recentCmds = recentIds
      .map(id => CONTOUR_COMMANDS.find(c => c.id === id))
      .filter((c): c is ContourCommand => c != null)
      .map(c => ({ ...c, category: 'recents' as ContourCategory }));

    return [...recentCmds, ...CONTOUR_COMMANDS];
  }

  const lower = query.toLowerCase();

  return CONTOUR_COMMANDS
    .map(cmd => {
      let score = 0;
      const nameLower = cmd.name.toLowerCase();
      const descLower = cmd.description.toLowerCase();

      // Exact name match
      if (nameLower === lower) score += 100;
      // Name starts with query
      else if (nameLower.startsWith(lower)) score += 80;
      // Name contains query
      else if (nameLower.includes(lower)) score += 60;
      // Fuzzy name match
      else score += fuzzyScore(lower, nameLower) * 2;

      // Description contains query
      if (descLower.includes(lower)) score += 30;
      else score += fuzzyScore(lower, descLower);

      // Keyword match
      for (const kw of cmd.keywords) {
        if (kw.startsWith(lower)) { score += 50; break; }
        else if (kw.includes(lower)) { score += 20; break; }
        else {
          const fs = fuzzyScore(lower, kw);
          if (fs > 0) { score += fs; break; }
        }
      }
      // ID match
      if (cmd.id.includes(lower)) score += 40;
      else score += fuzzyScore(lower, cmd.id);

      return { cmd, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ cmd }) => cmd);
}

// ─── Recent commands ───────────────────────────────────────────

const RECENT_KEY = 'contour-recent-commands';
const MAX_RECENTS = 5;

export function getRecentCommands(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

export function recordCommandUsage(commandId: string): void {
  try {
    const recents = getRecentCommands().filter(id => id !== commandId);
    recents.unshift(commandId);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)));
  } catch {
    // localStorage might be unavailable
  }
}
