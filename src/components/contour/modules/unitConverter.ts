/**
 * TimeMachine Contour - Unit Converter Module
 *
 * Detects and converts unit expressions like "5km to miles", "100f to c", "2kg to lb".
 * Pure math, no API calls.
 */

export interface UnitResult {
  fromValue: number;
  fromUnit: string;
  fromLabel: string;
  toValue: number;
  toUnit: string;
  toLabel: string;
  display: string;
  isPartial: boolean;
}

interface UnitDef {
  names: string[];
  label: string;
  category: string;
  toBase: (v: number) => number;
  fromBase: (v: number) => number;
}

// All units organized by category, normalized to a base unit
const UNITS: UnitDef[] = [
  // Length - base: meters
  { names: ['km', 'kilometer', 'kilometers', 'kilometre', 'kilometres'], label: 'km', category: 'length', toBase: v => v * 1000, fromBase: v => v / 1000 },
  { names: ['m', 'meter', 'meters', 'metre', 'metres'], label: 'm', category: 'length', toBase: v => v, fromBase: v => v },
  { names: ['cm', 'centimeter', 'centimeters', 'centimetre', 'centimetres'], label: 'cm', category: 'length', toBase: v => v / 100, fromBase: v => v * 100 },
  { names: ['mm', 'millimeter', 'millimeters', 'millimetre', 'millimetres'], label: 'mm', category: 'length', toBase: v => v / 1000, fromBase: v => v * 1000 },
  { names: ['mi', 'mile', 'miles'], label: 'miles', category: 'length', toBase: v => v * 1609.344, fromBase: v => v / 1609.344 },
  { names: ['yd', 'yard', 'yards'], label: 'yards', category: 'length', toBase: v => v * 0.9144, fromBase: v => v / 0.9144 },
  { names: ['ft', 'foot', 'feet'], label: 'ft', category: 'length', toBase: v => v * 0.3048, fromBase: v => v / 0.3048 },
  { names: ['in', 'inch', 'inches'], label: 'in', category: 'length', toBase: v => v * 0.0254, fromBase: v => v / 0.0254 },
  { names: ['nm', 'nautical mile', 'nautical miles', 'nmi'], label: 'nmi', category: 'length', toBase: v => v * 1852, fromBase: v => v / 1852 },

  // Weight - base: grams
  { names: ['kg', 'kilogram', 'kilograms', 'kilo', 'kilos'], label: 'kg', category: 'weight', toBase: v => v * 1000, fromBase: v => v / 1000 },
  { names: ['g', 'gram', 'grams'], label: 'g', category: 'weight', toBase: v => v, fromBase: v => v },
  { names: ['mg', 'milligram', 'milligrams'], label: 'mg', category: 'weight', toBase: v => v / 1000, fromBase: v => v * 1000 },
  { names: ['lb', 'lbs', 'pound', 'pounds'], label: 'lbs', category: 'weight', toBase: v => v * 453.592, fromBase: v => v / 453.592 },
  { names: ['oz', 'ounce', 'ounces'], label: 'oz', category: 'weight', toBase: v => v * 28.3495, fromBase: v => v / 28.3495 },
  { names: ['st', 'stone', 'stones'], label: 'stone', category: 'weight', toBase: v => v * 6350.29, fromBase: v => v / 6350.29 },
  { names: ['t', 'ton', 'tons', 'tonne', 'tonnes'], label: 'tonnes', category: 'weight', toBase: v => v * 1e6, fromBase: v => v / 1e6 },

  // Volume - base: liters
  { names: ['l', 'liter', 'liters', 'litre', 'litres'], label: 'L', category: 'volume', toBase: v => v, fromBase: v => v },
  { names: ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'], label: 'mL', category: 'volume', toBase: v => v / 1000, fromBase: v => v * 1000 },
  { names: ['gal', 'gallon', 'gallons'], label: 'gal', category: 'volume', toBase: v => v * 3.78541, fromBase: v => v / 3.78541 },
  { names: ['qt', 'quart', 'quarts'], label: 'qt', category: 'volume', toBase: v => v * 0.946353, fromBase: v => v / 0.946353 },
  { names: ['pt', 'pint', 'pints'], label: 'pt', category: 'volume', toBase: v => v * 0.473176, fromBase: v => v / 0.473176 },
  { names: ['cup', 'cups'], label: 'cups', category: 'volume', toBase: v => v * 0.236588, fromBase: v => v / 0.236588 },
  { names: ['floz', 'fl oz', 'fluid ounce', 'fluid ounces'], label: 'fl oz', category: 'volume', toBase: v => v * 0.0295735, fromBase: v => v / 0.0295735 },
  { names: ['tbsp', 'tablespoon', 'tablespoons'], label: 'tbsp', category: 'volume', toBase: v => v * 0.0147868, fromBase: v => v / 0.0147868 },
  { names: ['tsp', 'teaspoon', 'teaspoons'], label: 'tsp', category: 'volume', toBase: v => v * 0.00492892, fromBase: v => v / 0.00492892 },

  // Speed - base: m/s
  { names: ['kmh', 'km/h', 'kph', 'kmph'], label: 'km/h', category: 'speed', toBase: v => v / 3.6, fromBase: v => v * 3.6 },
  { names: ['mph'], label: 'mph', category: 'speed', toBase: v => v * 0.44704, fromBase: v => v / 0.44704 },
  { names: ['m/s', 'ms'], label: 'm/s', category: 'speed', toBase: v => v, fromBase: v => v },
  { names: ['knot', 'knots', 'kn', 'kt'], label: 'knots', category: 'speed', toBase: v => v * 0.514444, fromBase: v => v / 0.514444 },

  // Area - base: sq meters
  { names: ['sqm', 'sq m', 'm2', 'm²', 'square meter', 'square meters', 'square metre'], label: 'm²', category: 'area', toBase: v => v, fromBase: v => v },
  { names: ['sqft', 'sq ft', 'ft2', 'ft²', 'square foot', 'square feet'], label: 'ft²', category: 'area', toBase: v => v * 0.092903, fromBase: v => v / 0.092903 },
  { names: ['sqkm', 'sq km', 'km2', 'km²', 'square kilometer', 'square kilometre'], label: 'km²', category: 'area', toBase: v => v * 1e6, fromBase: v => v / 1e6 },
  { names: ['sqmi', 'sq mi', 'mi2', 'mi²', 'square mile', 'square miles'], label: 'mi²', category: 'area', toBase: v => v * 2.59e6, fromBase: v => v / 2.59e6 },
  { names: ['acre', 'acres', 'ac'], label: 'acres', category: 'area', toBase: v => v * 4046.86, fromBase: v => v / 4046.86 },
  { names: ['hectare', 'hectares', 'ha'], label: 'ha', category: 'area', toBase: v => v * 10000, fromBase: v => v / 10000 },

  // Digital Storage - base: bytes
  { names: ['b', 'byte', 'bytes'], label: 'B', category: 'data', toBase: v => v, fromBase: v => v },
  { names: ['kb', 'kilobyte', 'kilobytes'], label: 'KB', category: 'data', toBase: v => v * 1024, fromBase: v => v / 1024 },
  { names: ['mb', 'megabyte', 'megabytes'], label: 'MB', category: 'data', toBase: v => v * 1048576, fromBase: v => v / 1048576 },
  { names: ['gb', 'gigabyte', 'gigabytes'], label: 'GB', category: 'data', toBase: v => v * 1073741824, fromBase: v => v / 1073741824 },
  { names: ['tb', 'terabyte', 'terabytes'], label: 'TB', category: 'data', toBase: v => v * 1099511627776, fromBase: v => v / 1099511627776 },
];

// Temperature is special (non-linear)
interface TempUnit {
  names: string[];
  label: string;
  toC: (v: number) => number;
  fromC: (v: number) => number;
}

const TEMP_UNITS: TempUnit[] = [
  { names: ['c', 'celsius', '°c', 'degc'], label: '°C', toC: v => v, fromC: v => v },
  { names: ['f', 'fahrenheit', '°f', 'degf'], label: '°F', toC: v => (v - 32) * 5 / 9, fromC: v => v * 9 / 5 + 32 },
  { names: ['k', 'kelvin', '°k'], label: 'K', toC: v => v - 273.15, fromC: v => v + 273.15 },
];

function findUnit(name: string): UnitDef | null {
  const lower = name.toLowerCase();
  return UNITS.find(u => u.names.includes(lower)) || null;
}

function findTempUnit(name: string): TempUnit | null {
  const lower = name.toLowerCase();
  return TEMP_UNITS.find(u => u.names.includes(lower)) || null;
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString();
  const rounded = parseFloat(n.toFixed(6));
  if (Number.isInteger(rounded)) return rounded.toLocaleString();
  return parseFloat(rounded.toFixed(4)).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

// Build a regex pattern for all unit names, sorted by length (longest first to match greedily)
const allUnitNames = [
  ...UNITS.flatMap(u => u.names),
  ...TEMP_UNITS.flatMap(u => u.names),
].sort((a, b) => b.length - a.length);

const unitPattern = allUnitNames.map(n => n.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')).join('|');

// Pattern: NUMBER UNIT (to|in|as|=) UNIT
const FULL_PATTERN = new RegExp(
  `^(-?[\\d.,]+)\\s*(${unitPattern})\\s+(?:to|in|as|=)\\s+(${unitPattern})\\s*$`,
  'i'
);

// Partial: NUMBER UNIT (to|in|as|=) ...
const PARTIAL_PATTERN = new RegExp(
  `^(-?[\\d.,]+)\\s*(${unitPattern})\\s+(?:to|in|as|=)\\s*$`,
  'i'
);

// Just typing: NUMBER UNIT to
const TYPING_PATTERN = new RegExp(
  `^(-?[\\d.,]+)\\s*(${unitPattern})\\s+(?:to|in)$`,
  'i'
);

export function detectUnits(input: string): UnitResult | null {
  const trimmed = input.trim();

  // Full conversion: "5km to miles"
  const fullMatch = trimmed.match(FULL_PATTERN);
  if (fullMatch) {
    const value = parseFloat(fullMatch[1].replace(/,/g, ''));
    if (isNaN(value)) return null;
    const fromName = fullMatch[2];
    const toName = fullMatch[3];

    // Try temperature first
    const fromTemp = findTempUnit(fromName);
    const toTemp = findTempUnit(toName);
    if (fromTemp && toTemp) {
      const inC = fromTemp.toC(value);
      const result = toTemp.fromC(inC);
      return {
        fromValue: value,
        fromUnit: fromName,
        fromLabel: fromTemp.label,
        toValue: result,
        toUnit: toName,
        toLabel: toTemp.label,
        display: `${formatNum(value)} ${fromTemp.label} = ${formatNum(result)} ${toTemp.label}`,
        isPartial: false,
      };
    }

    // Regular units
    const fromUnit = findUnit(fromName);
    const toUnit = findUnit(toName);
    if (fromUnit && toUnit && fromUnit.category === toUnit.category) {
      const baseValue = fromUnit.toBase(value);
      const result = toUnit.fromBase(baseValue);
      return {
        fromValue: value,
        fromUnit: fromName,
        fromLabel: fromUnit.label,
        toValue: result,
        toUnit: toName,
        toLabel: toUnit.label,
        display: `${formatNum(value)} ${fromUnit.label} = ${formatNum(result)} ${toUnit.label}`,
        isPartial: false,
      };
    }
  }

  // Partial: "5km to" or "5km to "
  const partialMatch = trimmed.match(PARTIAL_PATTERN) || trimmed.match(TYPING_PATTERN);
  if (partialMatch) {
    const value = parseFloat(partialMatch[1].replace(/,/g, ''));
    if (isNaN(value)) return null;
    const fromName = partialMatch[2];
    const fromTemp = findTempUnit(fromName);
    const fromUnit = findUnit(fromName);
    const label = fromTemp?.label || fromUnit?.label || fromName;

    return {
      fromValue: value,
      fromUnit: fromName,
      fromLabel: label,
      toValue: 0,
      toUnit: '',
      toLabel: '...',
      display: `${formatNum(value)} ${label} = ...`,
      isPartial: true,
    };
  }

  return null;
}

/**
 * Get common conversion suggestions for a unit category
 */
export function getSuggestions(unitName: string): string[] {
  const unit = findUnit(unitName) || null;
  const temp = findTempUnit(unitName) || null;

  if (temp) {
    return TEMP_UNITS.filter(t => t !== temp).map(t => t.label);
  }
  if (unit) {
    return UNITS.filter(u => u.category === unit.category && u !== unit).slice(0, 4).map(u => u.label);
  }
  return [];
}

// ─── Interactive Mode Helpers ──────────────────────────────────

export interface UnitOption {
  label: string;
  names: string[];
}

export interface UnitCategory {
  id: string;
  label: string;
  units: UnitOption[];
}

const CATEGORY_LABELS: Record<string, string> = {
  length: 'Length',
  weight: 'Weight',
  volume: 'Volume',
  speed: 'Speed',
  area: 'Area',
  data: 'Data',
  temperature: 'Temperature',
};

export function getUnitCategories(): UnitCategory[] {
  const categoryMap = new Map<string, UnitOption[]>();
  for (const unit of UNITS) {
    const list = categoryMap.get(unit.category) || [];
    list.push({ label: unit.label, names: unit.names });
    categoryMap.set(unit.category, list);
  }
  categoryMap.set('temperature', TEMP_UNITS.map(t => ({ label: t.label, names: t.names })));

  return Array.from(categoryMap.entries()).map(([id, units]) => ({
    id,
    label: CATEGORY_LABELS[id] || id,
    units,
  }));
}

/**
 * Direct conversion by unit labels (for interactive UI).
 * Unlike detectUnits() which parses text, this takes structured inputs.
 */
export function convertDirect(value: number, fromLabel: string, toLabel: string): UnitResult | null {
  const fromUnit = UNITS.find(u => u.label === fromLabel);
  const toUnit = UNITS.find(u => u.label === toLabel);

  if (fromUnit && toUnit && fromUnit.category === toUnit.category) {
    const baseValue = fromUnit.toBase(value);
    const result = toUnit.fromBase(baseValue);
    return {
      fromValue: value,
      fromUnit: fromUnit.names[0],
      fromLabel: fromUnit.label,
      toValue: result,
      toUnit: toUnit.names[0],
      toLabel: toUnit.label,
      display: `${formatNum(value)} ${fromUnit.label} = ${formatNum(result)} ${toUnit.label}`,
      isPartial: false,
    };
  }

  // Temperature
  const fromTemp = TEMP_UNITS.find(t => t.label === fromLabel);
  const toTemp = TEMP_UNITS.find(t => t.label === toLabel);
  if (fromTemp && toTemp) {
    const inC = fromTemp.toC(value);
    const result = toTemp.fromC(inC);
    return {
      fromValue: value,
      fromUnit: fromTemp.names[0],
      fromLabel: fromTemp.label,
      toValue: result,
      toUnit: toTemp.names[0],
      toLabel: toTemp.label,
      display: `${formatNum(value)} ${fromTemp.label} = ${formatNum(result)} ${toTemp.label}`,
      isPartial: false,
    };
  }

  return null;
}
