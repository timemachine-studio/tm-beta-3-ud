/**
 * TimeMachine Contour - Random Generator Module
 *
 * Generates random numbers, UUIDs, passwords, dice rolls, and coin flips.
 * Detects inputs like "random number", "uuid", "roll 2d6", "flip coin", "password 16".
 * Pure client-side, no API calls.
 */

export type RandomType = 'number' | 'uuid' | 'password' | 'dice' | 'coin' | 'pick' | 'hex';

export interface RandomResult {
  type: RandomType;
  value: string;
  label: string;
  detail?: string;
  isPartial: boolean;
}

// ─── UUID v4 (crypto-safe) ────────────────────────────────────

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Password Generator ───────────────────────────────────────

const CHAR_SETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*_-+=?',
};

function generatePassword(length: number): string {
  const len = Math.max(4, Math.min(128, length));
  const all = CHAR_SETS.upper + CHAR_SETS.lower + CHAR_SETS.digits + CHAR_SETS.symbols;
  const arr = new Uint32Array(len);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < len; i++) arr[i] = Math.floor(Math.random() * all.length);
  }
  // Ensure at least one from each set
  const parts = [
    CHAR_SETS.upper[arr[0] % CHAR_SETS.upper.length],
    CHAR_SETS.lower[arr[1] % CHAR_SETS.lower.length],
    CHAR_SETS.digits[arr[2] % CHAR_SETS.digits.length],
    CHAR_SETS.symbols[arr[3] % CHAR_SETS.symbols.length],
  ];
  for (let i = 4; i < len; i++) {
    parts.push(all[arr[i] % all.length]);
  }
  // Shuffle
  for (let i = parts.length - 1; i > 0; i--) {
    const j = arr[i] ? arr[i] % (i + 1) : Math.floor(Math.random() * (i + 1));
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }
  return parts.join('');
}

// ─── Dice Roller ──────────────────────────────────────────────

interface DiceRoll {
  count: number;
  sides: number;
  modifier: number;
  rolls: number[];
  total: number;
}

function rollDice(count: number, sides: number, modifier: number = 0): DiceRoll {
  const c = Math.max(1, Math.min(100, count));
  const s = Math.max(2, Math.min(1000, sides));
  const rolls: number[] = [];
  for (let i = 0; i < c; i++) {
    rolls.push(Math.floor(Math.random() * s) + 1);
  }
  const sum = rolls.reduce((a, b) => a + b, 0);
  return { count: c, sides: s, modifier, rolls, total: sum + modifier };
}

// ─── Random Number ────────────────────────────────────────────

function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Random Hex Color ─────────────────────────────────────────

function randomHex(): string {
  const hex = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  return `#${hex}`;
}

// ─── Detection Patterns ───────────────────────────────────────

// "uuid", "guid", "generate uuid"
const UUID_PATTERN = /^(?:generate\s+)?(?:uuid|guid)$/i;

// "password", "password 16", "pass 24", "generate password"
const PASSWORD_PATTERN = /^(?:generate\s+)?(?:password|pass|pw)(?:\s+(\d+))?$/i;

// "roll 2d6", "2d20", "d6", "3d8+5", "roll dice"
const DICE_PATTERN = /^(?:roll\s+)?(\d{0,3})d(\d{1,4})(?:\s*([+-]\s*\d+))?$/i;
const DICE_SIMPLE = /^(?:roll\s+)?dice$/i;

// "flip coin", "coin flip", "heads or tails"
const COIN_PATTERN = /^(?:flip\s+(?:a\s+)?coin|coin\s*flip|heads\s+or\s+tails|toss\s+(?:a\s+)?coin)$/i;

// "random", "random number", "random 1-100", "random 50 100", "rand"
const RANDOM_NUM_PATTERN = /^(?:random|rand)(?:\s+(?:number|num|int|integer))?(?:\s+(\d+)[\s-]+(\d+))?$/i;

// "random hex", "random color"
const RANDOM_HEX_PATTERN = /^(?:random\s+(?:hex|color|colour))$/i;

// "pick from a,b,c" or "choose from x y z"
const PICK_PATTERN = /^(?:pick|choose|select)(?:\s+from)?\s+(.+)$/i;

export function detectRandom(input: string): RandomResult | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // UUID
  if (UUID_PATTERN.test(trimmed)) {
    const uuid = generateUUID();
    return { type: 'uuid', value: uuid, label: 'UUID v4', isPartial: false };
  }

  // Password
  const pwMatch = trimmed.match(PASSWORD_PATTERN);
  if (pwMatch) {
    const len = pwMatch[1] ? parseInt(pwMatch[1], 10) : 16;
    const pw = generatePassword(len);
    return { type: 'password', value: pw, label: `Password (${len} chars)`, detail: `${len} characters with upper, lower, digits & symbols`, isPartial: false };
  }

  // Dice
  if (DICE_SIMPLE.test(trimmed)) {
    const result = rollDice(1, 6);
    return { type: 'dice', value: String(result.total), label: '1d6', detail: `Roll: [${result.rolls.join(', ')}]`, isPartial: false };
  }
  const diceMatch = trimmed.match(DICE_PATTERN);
  if (diceMatch) {
    const count = diceMatch[1] ? parseInt(diceMatch[1], 10) || 1 : 1;
    const sides = parseInt(diceMatch[2], 10);
    const modifier = diceMatch[3] ? parseInt(diceMatch[3].replace(/\s/g, ''), 10) : 0;
    const result = rollDice(count, sides, modifier);
    const notation = `${result.count}d${result.sides}${modifier > 0 ? `+${modifier}` : modifier < 0 ? String(modifier) : ''}`;
    const detail = result.count <= 20 ? `Rolls: [${result.rolls.join(', ')}]${modifier !== 0 ? ` ${modifier > 0 ? '+' : ''}${modifier}` : ''}` : `Sum of ${result.count} rolls${modifier !== 0 ? ` ${modifier > 0 ? '+' : ''}${modifier}` : ''}`;
    return { type: 'dice', value: String(result.total), label: notation, detail, isPartial: false };
  }

  // Coin flip
  if (COIN_PATTERN.test(trimmed)) {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    return { type: 'coin', value: result, label: 'Coin Flip', isPartial: false };
  }

  // Random hex color
  if (RANDOM_HEX_PATTERN.test(trimmed)) {
    const hex = randomHex();
    return { type: 'hex', value: hex, label: 'Random Color', isPartial: false };
  }

  // Random number
  const numMatch = trimmed.match(RANDOM_NUM_PATTERN);
  if (numMatch) {
    const min = numMatch[1] ? parseInt(numMatch[1], 10) : 1;
    const max = numMatch[2] ? parseInt(numMatch[2], 10) : 100;
    const result = randomNumber(Math.min(min, max), Math.max(min, max));
    return { type: 'number', value: String(result), label: `Random (${min}-${max})`, isPartial: false };
  }

  // Pick from list
  const pickMatch = trimmed.match(PICK_PATTERN);
  if (pickMatch) {
    const items = pickMatch[1].split(/[,|]|\s+or\s+/).map(s => s.trim()).filter(Boolean);
    if (items.length >= 2) {
      const chosen = items[Math.floor(Math.random() * items.length)];
      return { type: 'pick', value: chosen, label: `Picked from ${items.length} options`, detail: items.join(', '), isPartial: false };
    }
  }

  return null;
}

// ─── Regenerate Helper ────────────────────────────────────────

export function regenerate(prev: RandomResult): RandomResult {
  switch (prev.type) {
    case 'uuid':
      return { ...prev, value: generateUUID() };
    case 'password': {
      const lenMatch = prev.label.match(/\((\d+)/);
      const len = lenMatch ? parseInt(lenMatch[1], 10) : 16;
      return { ...prev, value: generatePassword(len) };
    }
    case 'dice': {
      const notation = prev.label;
      const m = notation.match(/^(\d+)d(\d+)([+-]\d+)?$/);
      if (m) {
        const result = rollDice(parseInt(m[1], 10), parseInt(m[2], 10), m[3] ? parseInt(m[3], 10) : 0);
        const detail = result.count <= 20 ? `Rolls: [${result.rolls.join(', ')}]${result.modifier !== 0 ? ` ${result.modifier > 0 ? '+' : ''}${result.modifier}` : ''}` : `Sum of ${result.count} rolls`;
        return { ...prev, value: String(result.total), detail };
      }
      return prev;
    }
    case 'coin':
      return { ...prev, value: Math.random() < 0.5 ? 'Heads' : 'Tails' };
    case 'hex':
      return { ...prev, value: randomHex() };
    case 'number': {
      const rangeMatch = prev.label.match(/\((\d+)-(\d+)\)/);
      if (rangeMatch) {
        const min = parseInt(rangeMatch[1], 10);
        const max = parseInt(rangeMatch[2], 10);
        return { ...prev, value: String(randomNumber(min, max)) };
      }
      return { ...prev, value: String(randomNumber(1, 100)) };
    }
    case 'pick': {
      if (prev.detail) {
        const items = prev.detail.split(', ').filter(Boolean);
        if (items.length >= 2) {
          return { ...prev, value: items[Math.floor(Math.random() * items.length)] };
        }
      }
      return prev;
    }
    default:
      return prev;
  }
}

// ─── Quick Action Generators (for focused mode UI) ────────────

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  generate: () => RandomResult;
}

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'uuid',
    label: 'UUID',
    icon: 'Fingerprint',
    generate: () => ({ type: 'uuid', value: generateUUID(), label: 'UUID v4', isPartial: false }),
  },
  {
    id: 'password',
    label: 'Password',
    icon: 'Lock',
    generate: () => ({ type: 'password', value: generatePassword(16), label: 'Password (16 chars)', detail: '16 characters with upper, lower, digits & symbols', isPartial: false }),
  },
  {
    id: 'dice',
    label: 'Roll d6',
    icon: 'Dices',
    generate: () => {
      const result = rollDice(1, 6);
      return { type: 'dice', value: String(result.total), label: '1d6', detail: `Roll: [${result.rolls.join(', ')}]`, isPartial: false };
    },
  },
  {
    id: 'coin',
    label: 'Flip Coin',
    icon: 'Coins',
    generate: () => ({ type: 'coin', value: Math.random() < 0.5 ? 'Heads' : 'Tails', label: 'Coin Flip', isPartial: false }),
  },
  {
    id: 'number',
    label: '1-100',
    icon: 'Hash',
    generate: () => ({ type: 'number', value: String(randomNumber(1, 100)), label: 'Random (1-100)', isPartial: false }),
  },
  {
    id: 'hex',
    label: 'Color',
    icon: 'Palette',
    generate: () => ({ type: 'hex', value: randomHex(), label: 'Random Color', isPartial: false }),
  },
];
