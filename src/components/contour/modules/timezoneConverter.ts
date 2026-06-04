/**
 * TimeMachine Contour - Timezone Converter Module
 *
 * Detects expressions like "3pm EST in IST", "now in Tokyo", "10:30 UTC to PST".
 * Uses Intl.DateTimeFormat for timezone conversion (no API needed).
 */

export interface TimezoneResult {
  fromTime: string;
  fromZone: string;
  fromLabel: string;
  toTime: string;
  toZone: string;
  toLabel: string;
  display: string;
  isPartial: boolean;
  isNow: boolean;
}

interface TzDef {
  names: string[];
  label: string;
  iana: string;
}

const TIMEZONES: TzDef[] = [
  // Americas
  { names: ['est', 'eastern', 'et'], label: 'EST', iana: 'America/New_York' },
  { names: ['cst', 'central', 'ct'], label: 'CST', iana: 'America/Chicago' },
  { names: ['mst', 'mountain', 'mt'], label: 'MST', iana: 'America/Denver' },
  { names: ['pst', 'pacific', 'pt'], label: 'PST', iana: 'America/Los_Angeles' },
  { names: ['ast'], label: 'AST', iana: 'America/Halifax' },
  { names: ['brt', 'brazil', 'brasilia'], label: 'BRT', iana: 'America/Sao_Paulo' },
  { names: ['art', 'argentina', 'buenos aires'], label: 'ART', iana: 'America/Argentina/Buenos_Aires' },

  // Europe
  { names: ['utc', 'gmt', 'greenwich'], label: 'UTC', iana: 'UTC' },
  { names: ['gmt+0', 'gmt-0'], label: 'GMT', iana: 'UTC' },
  { names: ['bst', 'british summer'], label: 'BST', iana: 'Europe/London' },
  { names: ['cet', 'central european'], label: 'CET', iana: 'Europe/Paris' },
  { names: ['eet', 'eastern european'], label: 'EET', iana: 'Europe/Bucharest' },
  { names: ['msk', 'moscow'], label: 'MSK', iana: 'Europe/Moscow' },
  { names: ['london'], label: 'London', iana: 'Europe/London' },
  { names: ['paris'], label: 'Paris', iana: 'Europe/Paris' },
  { names: ['berlin'], label: 'Berlin', iana: 'Europe/Berlin' },

  // Asia
  { names: ['ist', 'india', 'indian'], label: 'IST', iana: 'Asia/Kolkata' },
  { names: ['jst', 'japan', 'tokyo'], label: 'JST', iana: 'Asia/Tokyo' },
  { names: ['cst china', 'cst+8', 'china', 'beijing', 'shanghai'], label: 'CST (China)', iana: 'Asia/Shanghai' },
  { names: ['kst', 'korea', 'seoul'], label: 'KST', iana: 'Asia/Seoul' },
  { names: ['sgt', 'singapore'], label: 'SGT', iana: 'Asia/Singapore' },
  { names: ['hkt', 'hong kong'], label: 'HKT', iana: 'Asia/Hong_Kong' },
  { names: ['pht', 'philippines', 'manila'], label: 'PHT', iana: 'Asia/Manila' },
  { names: ['ict', 'indochina', 'bangkok'], label: 'ICT', iana: 'Asia/Bangkok' },
  { names: ['wib', 'jakarta'], label: 'WIB', iana: 'Asia/Jakarta' },
  { names: ['gst', 'gulf', 'dubai', 'uae'], label: 'GST', iana: 'Asia/Dubai' },
  { names: ['pkt', 'pakistan', 'karachi'], label: 'PKT', iana: 'Asia/Karachi' },
  { names: ['bst bangladesh', 'bangladesh', 'dhaka'], label: 'BST (BD)', iana: 'Asia/Dhaka' },

  // Oceania
  { names: ['aest', 'aedt', 'australia', 'sydney'], label: 'AEST', iana: 'Australia/Sydney' },
  { names: ['acst', 'adelaide'], label: 'ACST', iana: 'Australia/Adelaide' },
  { names: ['awst', 'perth'], label: 'AWST', iana: 'Australia/Perth' },
  { names: ['nzst', 'nzdt', 'new zealand', 'auckland'], label: 'NZST', iana: 'Pacific/Auckland' },

  // Africa / Middle East
  { names: ['cat', 'central africa'], label: 'CAT', iana: 'Africa/Johannesburg' },
  { names: ['eat', 'east africa', 'nairobi'], label: 'EAT', iana: 'Africa/Nairobi' },
  { names: ['wat', 'west africa', 'lagos'], label: 'WAT', iana: 'Africa/Lagos' },
  { names: ['ast arabia', 'riyadh', 'saudi'], label: 'AST (Arabia)', iana: 'Asia/Riyadh' },
];

function findTimezone(name: string): TzDef | null {
  const lower = name.toLowerCase().trim();
  return TIMEZONES.find(tz => tz.names.includes(lower)) || null;
}

function formatTimeInZone(date: Date, iana: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: iana,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      weekday: 'short',
    }).format(date);
  } catch {
    return 'Invalid timezone';
  }
}

function parseTime(timeStr: string): { hours: number; minutes: number } | null {
  // "3pm", "3:30pm", "15:00", "3 pm"
  const match12 = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (match12) {
    let hours = parseInt(match12[1]);
    const minutes = match12[2] ? parseInt(match12[2]) : 0;
    const period = match12[3].toLowerCase();
    if (hours < 1 || hours > 12 || minutes > 59) return null;
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    return { hours, minutes };
  }

  const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1]);
    const minutes = parseInt(match24[2]);
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes };
  }

  return null;
}

// Build timezone name pattern
const tzNames = TIMEZONES.flatMap(tz => tz.names).sort((a, b) => b.length - a.length);
const tzPattern = tzNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

// Full: "3pm EST in IST" or "15:00 UTC to PST"
const FULL_PATTERN = new RegExp(
  `^(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?)\\s+(${tzPattern})\\s+(?:in|to)\\s+(${tzPattern})\\s*$`,
  'i'
);

// "now in Tokyo"
const NOW_PATTERN = new RegExp(
  `^now\\s+(?:in|at)\\s+(${tzPattern})\\s*$`,
  'i'
);

// Partial: "3pm EST in"
const PARTIAL_PATTERN = new RegExp(
  `^(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?)\\s+(${tzPattern})\\s+(?:in|to)\\s*$`,
  'i'
);

export function detectTimezone(input: string): TimezoneResult | null {
  const trimmed = input.trim();

  // "now in Tokyo"
  const nowMatch = trimmed.match(NOW_PATTERN);
  if (nowMatch) {
    const toTz = findTimezone(nowMatch[1]);
    if (!toTz) return null;

    const now = new Date();
    const localLabel = Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop() || 'Local';
    const localTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const remoteTime = formatTimeInZone(now, toTz.iana);

    return {
      fromTime: localTime,
      fromZone: 'local',
      fromLabel: localLabel,
      toTime: remoteTime,
      toZone: toTz.names[0],
      toLabel: toTz.label,
      display: `Now in ${toTz.label}: ${remoteTime}`,
      isPartial: false,
      isNow: true,
    };
  }

  // Full: "3pm EST in IST"
  const fullMatch = trimmed.match(FULL_PATTERN);
  if (fullMatch) {
    const timeStr = fullMatch[1];
    const fromTz = findTimezone(fullMatch[2]);
    const toTz = findTimezone(fullMatch[3]);

    if (!fromTz || !toTz) return null;

    const parsed = parseTime(timeStr);
    if (!parsed) return null;

    // Create a date in the from timezone
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

    // Create date string and use Intl to convert
    const sourceDate = new Date(`${dateStr}T${String(parsed.hours).padStart(2, '0')}:${String(parsed.minutes).padStart(2, '0')}:00`);

    // Get the offset difference by formatting in both zones
    const fromFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: fromTz.iana,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    const toFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: toTz.iana,
      hour: 'numeric', minute: '2-digit', hour12: true,
      weekday: 'short',
    });

    // Find a UTC time that corresponds to the given local time in fromTz
    // We do this by checking what time it is "now" in fromTz and adjusting
    const fromParts = fromFormatter.formatToParts(sourceDate);
    const fromHour = parseInt(fromParts.find(p => p.type === 'hour')?.value || '0');
    const fromMin = parseInt(fromParts.find(p => p.type === 'minute')?.value || '0');

    const hourDiff = parsed.hours - fromHour;
    const minDiff = parsed.minutes - fromMin;
    const adjustedDate = new Date(sourceDate.getTime() + (hourDiff * 60 + minDiff) * 60 * 1000);

    const convertedTime = toFormatter.format(adjustedDate);
    const fromTimeDisplay = `${parsed.hours % 12 || 12}:${String(parsed.minutes).padStart(2, '0')} ${parsed.hours >= 12 ? 'PM' : 'AM'}`;

    return {
      fromTime: fromTimeDisplay,
      fromZone: fromTz.names[0],
      fromLabel: fromTz.label,
      toTime: convertedTime,
      toZone: toTz.names[0],
      toLabel: toTz.label,
      display: `${fromTimeDisplay} ${fromTz.label} = ${convertedTime} ${toTz.label}`,
      isPartial: false,
      isNow: false,
    };
  }

  // Partial: "3pm EST in"
  const partialMatch = trimmed.match(PARTIAL_PATTERN);
  if (partialMatch) {
    const timeStr = partialMatch[1];
    const fromTz = findTimezone(partialMatch[2]);
    if (!fromTz) return null;

    const parsed = parseTime(timeStr);
    if (!parsed) return null;

    const fromTimeDisplay = `${parsed.hours % 12 || 12}:${String(parsed.minutes).padStart(2, '0')} ${parsed.hours >= 12 ? 'PM' : 'AM'}`;

    return {
      fromTime: fromTimeDisplay,
      fromZone: fromTz.names[0],
      fromLabel: fromTz.label,
      toTime: '...',
      toZone: '',
      toLabel: '...',
      display: `${fromTimeDisplay} ${fromTz.label} = ...`,
      isPartial: true,
      isNow: false,
    };
  }

  return null;
}

// ─── Interactive Mode Helpers ──────────────────────────────────

export interface TimezoneOption {
  label: string;
  iana: string;
  region: string;
}

export const POPULAR_TIMEZONES = ['EST', 'PST', 'UTC', 'IST', 'JST', 'CET', 'AEST', 'SGT'];

function ianaToRegion(iana: string): string {
  if (iana === 'UTC') return 'Global';
  const prefix = iana.split('/')[0];
  const map: Record<string, string> = {
    America: 'Americas', Europe: 'Europe', Asia: 'Asia',
    Australia: 'Oceania', Pacific: 'Oceania', Africa: 'Africa',
  };
  return map[prefix] || 'Other';
}

export function getTimezoneList(): TimezoneOption[] {
  const seen = new Set<string>();
  return TIMEZONES.filter(tz => {
    if (seen.has(tz.label)) return false;
    seen.add(tz.label);
    return true;
  }).map(tz => ({
    label: tz.label,
    iana: tz.iana,
    region: ianaToRegion(tz.iana),
  }));
}

export function findTimezoneByLabel(label: string): { label: string; iana: string } | null {
  return TIMEZONES.find(tz => tz.label === label) || null;
}

export function convertTimezoneDirect(
  hours: number, minutes: number, fromIana: string, toIana: string
): TimezoneResult | null {
  try {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const sourceDate = new Date(
      `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
    );

    const fromFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: fromIana,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    const toFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: toIana,
      hour: 'numeric', minute: '2-digit', hour12: true, weekday: 'short',
    });

    const fromParts = fromFormatter.formatToParts(sourceDate);
    const fromHour = parseInt(fromParts.find(p => p.type === 'hour')?.value || '0');
    const fromMin = parseInt(fromParts.find(p => p.type === 'minute')?.value || '0');

    const hourDiff = hours - fromHour;
    const minDiff = minutes - fromMin;
    const adjustedDate = new Date(sourceDate.getTime() + (hourDiff * 60 + minDiff) * 60 * 1000);

    const convertedTime = toFormatter.format(adjustedDate);
    const fromTimeDisplay = `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;

    const fromTz = TIMEZONES.find(tz => tz.iana === fromIana);
    const toTz = TIMEZONES.find(tz => tz.iana === toIana);
    const fromLabel = fromTz?.label || fromIana.split('/').pop() || fromIana;
    const toLabel = toTz?.label || toIana.split('/').pop() || toIana;

    return {
      fromTime: fromTimeDisplay, fromZone: fromIana, fromLabel,
      toTime: convertedTime, toZone: toIana, toLabel,
      display: `${fromTimeDisplay} ${fromLabel} = ${convertedTime} ${toLabel}`,
      isPartial: false, isNow: false,
    };
  } catch {
    return null;
  }
}
