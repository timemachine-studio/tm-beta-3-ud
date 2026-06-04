/**
 * TimeMachine Contour - Date Calculator Module
 *
 * Detects natural date expressions:
 *   - "days until Dec 25"
 *   - "30 days from now"
 *   - "days since Jan 1"
 *   - "90 days ago"
 *   - "days between Jan 1 and Dec 31"
 */

export interface DateResult {
  display: string;
  subtitle: string;
  days: number;
  targetDate?: Date;
  isPartial: boolean;
  type: 'until' | 'since' | 'from_now' | 'ago' | 'between';
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8, sept: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Build month pattern
const monthNames = Object.keys(MONTHS).join('|');

/**
 * Parse a date string like "Dec 25", "December 25", "Dec 25 2025", "25 Dec", "2025-12-25"
 */
function parseDate(str: string): Date | null {
  const trimmed = str.trim();
  const now = new Date();

  // "today"
  if (/^today$/i.test(trimmed)) return now;

  // "tomorrow"
  if (/^tomorrow$/i.test(trimmed)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d;
  }

  // "yesterday"
  if (/^yesterday$/i.test(trimmed)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d;
  }

  // "new year" / "new years" / "new year's"
  if (/^new\s+year'?s?$/i.test(trimmed)) {
    return new Date(now.getFullYear() + 1, 0, 1);
  }

  // "christmas" / "xmas"
  if (/^(?:christmas|xmas)$/i.test(trimmed)) {
    const christmas = new Date(now.getFullYear(), 11, 25);
    if (christmas < now) christmas.setFullYear(christmas.getFullYear() + 1);
    return christmas;
  }

  // "valentines" / "valentine's day"
  if (/^valentine'?s?(?:\s+day)?$/i.test(trimmed)) {
    const vday = new Date(now.getFullYear(), 1, 14);
    if (vday < now) vday.setFullYear(vday.getFullYear() + 1);
    return vday;
  }

  // "halloween"
  if (/^halloween$/i.test(trimmed)) {
    const hw = new Date(now.getFullYear(), 9, 31);
    if (hw < now) hw.setFullYear(hw.getFullYear() + 1);
    return hw;
  }

  // ISO date: 2025-12-25
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  }

  // "Month Day" or "Month Day Year"
  const mdPattern = new RegExp(`^(${monthNames})\\s+(\\d{1,2})(?:\\s*,?\\s*(\\d{4}))?$`, 'i');
  const mdMatch = trimmed.match(mdPattern);
  if (mdMatch) {
    const month = MONTHS[mdMatch[1].toLowerCase()];
    const day = parseInt(mdMatch[2]);
    const year = mdMatch[3] ? parseInt(mdMatch[3]) : now.getFullYear();
    if (month !== undefined && day >= 1 && day <= 31) {
      const date = new Date(year, month, day);
      // If no year specified and date is in the past, use next year
      if (!mdMatch[3] && date < now) {
        date.setFullYear(date.getFullYear() + 1);
      }
      return date;
    }
  }

  // "Day Month" or "Day Month Year"
  const dmPattern = new RegExp(`^(\\d{1,2})\\s+(${monthNames})(?:\\s*,?\\s*(\\d{4}))?$`, 'i');
  const dmMatch = trimmed.match(dmPattern);
  if (dmMatch) {
    const day = parseInt(dmMatch[1]);
    const month = MONTHS[dmMatch[2].toLowerCase()];
    const year = dmMatch[3] ? parseInt(dmMatch[3]) : now.getFullYear();
    if (month !== undefined && day >= 1 && day <= 31) {
      const date = new Date(year, month, day);
      if (!dmMatch[3] && date < now) {
        date.setFullYear(date.getFullYear() + 1);
      }
      return date;
    }
  }

  // MM/DD or MM/DD/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1]) - 1;
    const day = parseInt(slashMatch[2]);
    let year = slashMatch[3] ? parseInt(slashMatch[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return new Date(year, month, day);
    }
  }

  return null;
}

function formatDate(date: Date): string {
  return `${DAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86400000;
  const aStart = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bStart = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bStart.getTime() - aStart.getTime()) / msPerDay);
}

function pluralize(n: number, word: string): string {
  const abs = Math.abs(n);
  return `${abs.toLocaleString()} ${word}${abs === 1 ? '' : 's'}`;
}

export function detectDate(input: string): DateResult | null {
  const trimmed = input.trim().toLowerCase();
  const now = new Date();

  // "days until Dec 25" / "days to christmas"
  const untilMatch = trimmed.match(new RegExp(`^(?:days?|how many days?)\\s+(?:until|to|till|before)\\s+(.+)$`, 'i'));
  if (untilMatch) {
    const target = parseDate(untilMatch[1]);
    if (target) {
      const days = daysBetween(now, target);
      return {
        display: days >= 0 ? pluralize(days, 'day') : `${pluralize(-days, 'day')} ago`,
        subtitle: `until ${formatDate(target)}`,
        days,
        targetDate: target,
        isPartial: false,
        type: 'until',
      };
    }
    return {
      display: 'days until ...',
      subtitle: 'Type a date (e.g., Dec 25, christmas)',
      days: 0,
      isPartial: true,
      type: 'until',
    };
  }

  // "days since Jan 1"
  const sinceMatch = trimmed.match(new RegExp(`^(?:days?|how many days?)\\s+since\\s+(.+)$`, 'i'));
  if (sinceMatch) {
    const target = parseDate(sinceMatch[1]);
    if (target) {
      const days = daysBetween(target, now);
      return {
        display: pluralize(days, 'day'),
        subtitle: `since ${formatDate(target)}`,
        days,
        targetDate: target,
        isPartial: false,
        type: 'since',
      };
    }
  }

  // "30 days from now" / "30 days from today"
  const fromNowMatch = trimmed.match(/^(\d+)\s+days?\s+from\s+(?:now|today)$/i);
  if (fromNowMatch) {
    const numDays = parseInt(fromNowMatch[1]);
    const target = new Date(now);
    target.setDate(target.getDate() + numDays);
    return {
      display: formatDate(target),
      subtitle: `${pluralize(numDays, 'day')} from now`,
      days: numDays,
      targetDate: target,
      isPartial: false,
      type: 'from_now',
    };
  }

  // "90 days ago"
  const agoMatch = trimmed.match(/^(\d+)\s+days?\s+ago$/i);
  if (agoMatch) {
    const numDays = parseInt(agoMatch[1]);
    const target = new Date(now);
    target.setDate(target.getDate() - numDays);
    return {
      display: formatDate(target),
      subtitle: `${pluralize(numDays, 'day')} ago`,
      days: numDays,
      targetDate: target,
      isPartial: false,
      type: 'ago',
    };
  }

  // "days between Jan 1 and Dec 31"
  const betweenMatch = trimmed.match(new RegExp(`^(?:days?|how many days?)\\s+between\\s+(.+?)\\s+and\\s+(.+)$`, 'i'));
  if (betweenMatch) {
    const date1 = parseDate(betweenMatch[1]);
    const date2 = parseDate(betweenMatch[2]);
    if (date1 && date2) {
      const days = Math.abs(daysBetween(date1, date2));
      return {
        display: pluralize(days, 'day'),
        subtitle: `between ${formatDate(date1)} and ${formatDate(date2)}`,
        days,
        isPartial: false,
        type: 'between',
      };
    }
  }

  // "days until" (partial, no date yet)
  if (/^(?:days?|how many days?)\s+(?:until|to|till|before|since|between)\s*$/i.test(trimmed)) {
    return {
      display: 'Type a date...',
      subtitle: 'e.g., Dec 25, christmas, 2025-12-31',
      days: 0,
      isPartial: true,
      type: 'until',
    };
  }

  return null;
}

// ─── Interactive Mode Helpers ──────────────────────────────────

export type DateOperation = DateResult['type'];

export const DATE_OPERATIONS: { id: DateOperation; label: string }[] = [
  { id: 'until', label: 'Days until' },
  { id: 'since', label: 'Days since' },
  { id: 'from_now', label: 'From now' },
  { id: 'ago', label: 'Ago' },
  { id: 'between', label: 'Between' },
];

export const DATE_QUICK_PICKS = [
  { name: 'Christmas', value: 'christmas' },
  { name: 'New Year', value: 'new years' },
  { name: 'Halloween', value: 'halloween' },
  { name: "Valentine's", value: "valentine's" },
];

export { parseDate, formatDate };

export function computeDateDirect(
  operation: DateOperation,
  date1?: Date | null,
  date2?: Date | null,
  numDays?: number,
): DateResult | null {
  const now = new Date();
  switch (operation) {
    case 'until': {
      if (!date1) return null;
      const days = daysBetween(now, date1);
      return {
        display: days >= 0 ? pluralize(days, 'day') : `${pluralize(-days, 'day')} ago`,
        subtitle: `until ${formatDate(date1)}`,
        days, targetDate: date1, isPartial: false, type: 'until',
      };
    }
    case 'since': {
      if (!date1) return null;
      const days = daysBetween(date1, now);
      return {
        display: pluralize(days, 'day'),
        subtitle: `since ${formatDate(date1)}`,
        days, targetDate: date1, isPartial: false, type: 'since',
      };
    }
    case 'from_now': {
      if (numDays === undefined || numDays < 0) return null;
      const target = new Date(now);
      target.setDate(target.getDate() + numDays);
      return {
        display: formatDate(target),
        subtitle: `${pluralize(numDays, 'day')} from now`,
        days: numDays, targetDate: target, isPartial: false, type: 'from_now',
      };
    }
    case 'ago': {
      if (numDays === undefined || numDays < 0) return null;
      const target = new Date(now);
      target.setDate(target.getDate() - numDays);
      return {
        display: formatDate(target),
        subtitle: `${pluralize(numDays, 'day')} ago`,
        days: numDays, targetDate: target, isPartial: false, type: 'ago',
      };
    }
    case 'between': {
      if (!date1 || !date2) return null;
      const days = Math.abs(daysBetween(date1, date2));
      return {
        display: pluralize(days, 'day'),
        subtitle: `between ${formatDate(date1)} and ${formatDate(date2)}`,
        days, isPartial: false, type: 'between',
      };
    }
  }
}
