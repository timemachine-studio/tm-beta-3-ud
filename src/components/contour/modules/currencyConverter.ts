/**
 * TimeMachine Contour - Currency Converter Module
 *
 * Detects expressions like "50 usd to eur", "$100 in gbp".
 * Uses exchangerate.host free API with localStorage caching (1 hour TTL).
 */

export interface CurrencyResult {
  fromValue: number;
  fromCurrency: string;
  toCurrency: string;
  toValue: number | null;
  rate: number | null;
  display: string;
  isPartial: boolean;
  isLoading: boolean;
  error?: string;
}

const CURRENCIES: Record<string, { symbol: string; name: string }> = {
  USD: { symbol: '$', name: 'US Dollar' },
  EUR: { symbol: '€', name: 'Euro' },
  GBP: { symbol: '£', name: 'British Pound' },
  JPY: { symbol: '¥', name: 'Japanese Yen' },
  CNY: { symbol: '¥', name: 'Chinese Yuan' },
  INR: { symbol: '₹', name: 'Indian Rupee' },
  AUD: { symbol: 'A$', name: 'Australian Dollar' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar' },
  CHF: { symbol: 'CHF', name: 'Swiss Franc' },
  KRW: { symbol: '₩', name: 'South Korean Won' },
  SGD: { symbol: 'S$', name: 'Singapore Dollar' },
  HKD: { symbol: 'HK$', name: 'Hong Kong Dollar' },
  SEK: { symbol: 'kr', name: 'Swedish Krona' },
  NOK: { symbol: 'kr', name: 'Norwegian Krone' },
  DKK: { symbol: 'kr', name: 'Danish Krone' },
  NZD: { symbol: 'NZ$', name: 'New Zealand Dollar' },
  MXN: { symbol: 'Mex$', name: 'Mexican Peso' },
  BRL: { symbol: 'R$', name: 'Brazilian Real' },
  ZAR: { symbol: 'R', name: 'South African Rand' },
  TRY: { symbol: '₺', name: 'Turkish Lira' },
  RUB: { symbol: '₽', name: 'Russian Ruble' },
  THB: { symbol: '฿', name: 'Thai Baht' },
  PHP: { symbol: '₱', name: 'Philippine Peso' },
  PLN: { symbol: 'zł', name: 'Polish Zloty' },
  TWD: { symbol: 'NT$', name: 'Taiwan Dollar' },
  MYR: { symbol: 'RM', name: 'Malaysian Ringgit' },
  IDR: { symbol: 'Rp', name: 'Indonesian Rupiah' },
  AED: { symbol: 'د.إ', name: 'UAE Dirham' },
  SAR: { symbol: '﷼', name: 'Saudi Riyal' },
  ARS: { symbol: 'AR$', name: 'Argentine Peso' },
  CLP: { symbol: 'CLP$', name: 'Chilean Peso' },
  COP: { symbol: 'COL$', name: 'Colombian Peso' },
  EGP: { symbol: 'E£', name: 'Egyptian Pound' },
  NGN: { symbol: '₦', name: 'Nigerian Naira' },
  PKR: { symbol: 'Rs', name: 'Pakistani Rupee' },
  BDT: { symbol: '৳', name: 'Bangladeshi Taka' },
  VND: { symbol: '₫', name: 'Vietnamese Dong' },
  CZK: { symbol: 'Kč', name: 'Czech Koruna' },
  HUF: { symbol: 'Ft', name: 'Hungarian Forint' },
  ILS: { symbol: '₪', name: 'Israeli Shekel' },
  RON: { symbol: 'lei', name: 'Romanian Leu' },
  BGN: { symbol: 'лв', name: 'Bulgarian Lev' },
  HRK: { symbol: 'kn', name: 'Croatian Kuna' },
  ISK: { symbol: 'kr', name: 'Icelandic Krona' },
  UAH: { symbol: '₴', name: 'Ukrainian Hryvnia' },
  KES: { symbol: 'KSh', name: 'Kenyan Shilling' },
  GHS: { symbol: 'GH₵', name: 'Ghanaian Cedi' },
  LKR: { symbol: 'Rs', name: 'Sri Lankan Rupee' },
  BTC: { symbol: '₿', name: 'Bitcoin' },
};

// Symbol to currency code mapping
const SYMBOL_MAP: Record<string, string> = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₹': 'INR',
  '₩': 'KRW',
  '₿': 'BTC',
};

const currencyCodes = Object.keys(CURRENCIES).join('|');

// Pattern: NUMBER CURRENCY to CURRENCY
const FULL_PATTERN = new RegExp(
  `^([\\$€£¥₹₩₿]?)\\s*(-?[\\d.,]+)\\s*(${currencyCodes})\\s+(?:to|in|=)\\s+(${currencyCodes})\\s*$`,
  'i'
);

// Partial: NUMBER CURRENCY to
const PARTIAL_PATTERN = new RegExp(
  `^([\\$€£¥₹₩₿]?)\\s*(-?[\\d.,]+)\\s*(${currencyCodes})\\s+(?:to|in|=)\\s*$`,
  'i'
);

// Cache key & TTL
const CACHE_KEY = 'contour_exchange_rates';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface CachedRates {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

let ratesCache: CachedRates | null = null;
let fetchPromise: Promise<CachedRates | null> | null = null;

function loadCacheFromStorage(): CachedRates | null {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as CachedRates;
    if (Date.now() - parsed.timestamp > CACHE_TTL) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function fetchRates(): Promise<CachedRates | null> {
  // Check memory cache
  if (ratesCache && Date.now() - ratesCache.timestamp < CACHE_TTL) {
    return ratesCache;
  }

  // Check localStorage cache
  const stored = loadCacheFromStorage();
  if (stored) {
    ratesCache = stored;
    return stored;
  }

  // Deduplicate concurrent fetches
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      // Using exchangerate-api free endpoint (no key required)
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      if (!response.ok) return null;
      const data = await response.json();

      const cached: CachedRates = {
        base: 'USD',
        rates: data.rates,
        timestamp: Date.now(),
      };

      ratesCache = cached;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
      } catch { /* quota exceeded, ignore */ }

      return cached;
    } catch {
      return null;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

function formatCurrency(value: number, code: string): string {
  const info = CURRENCIES[code.toUpperCase()];
  if (!info) return `${value.toFixed(2)} ${code.toUpperCase()}`;

  // Use locale formatting
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code.toUpperCase(),
      maximumFractionDigits: code.toUpperCase() === 'BTC' ? 8 : 2,
    }).format(value);
  } catch {
    return `${info.symbol}${value.toFixed(2)}`;
  }
}

export function detectCurrency(input: string): CurrencyResult | null {
  const trimmed = input.trim();

  // Full: "50 usd to eur"
  const fullMatch = trimmed.match(FULL_PATTERN);
  if (fullMatch) {
    const symbol = fullMatch[1];
    const value = parseFloat(fullMatch[2].replace(/,/g, ''));
    if (isNaN(value)) return null;
    let fromCode = fullMatch[3].toUpperCase();
    const toCode = fullMatch[4].toUpperCase();

    // If symbol was used, override fromCode
    if (symbol && SYMBOL_MAP[symbol]) {
      fromCode = SYMBOL_MAP[symbol];
    }

    if (!CURRENCIES[fromCode] || !CURRENCIES[toCode]) return null;

    return {
      fromValue: value,
      fromCurrency: fromCode,
      toCurrency: toCode,
      toValue: null,
      rate: null,
      display: `${formatCurrency(value, fromCode)} = ...`,
      isPartial: false,
      isLoading: true,
    };
  }

  // Partial: "50 usd to"
  const partialMatch = trimmed.match(PARTIAL_PATTERN);
  if (partialMatch) {
    const symbol = partialMatch[1];
    const value = parseFloat(partialMatch[2].replace(/,/g, ''));
    if (isNaN(value)) return null;
    let fromCode = partialMatch[3].toUpperCase();

    if (symbol && SYMBOL_MAP[symbol]) {
      fromCode = SYMBOL_MAP[symbol];
    }

    if (!CURRENCIES[fromCode]) return null;

    return {
      fromValue: value,
      fromCurrency: fromCode,
      toCurrency: '',
      toValue: null,
      rate: null,
      display: `${formatCurrency(value, fromCode)} = ...`,
      isPartial: true,
      isLoading: false,
    };
  }

  return null;
}

/**
 * Resolve a currency conversion result by fetching exchange rates.
 * Returns updated result with actual values.
 */
export async function resolveCurrency(result: CurrencyResult): Promise<CurrencyResult> {
  if (result.isPartial || !result.toCurrency) return result;

  const rates = await fetchRates();
  if (!rates) {
    return { ...result, isLoading: false, error: 'Unable to fetch rates', display: `${formatCurrency(result.fromValue, result.fromCurrency)} = (offline)` };
  }

  const fromRate = rates.rates[result.fromCurrency];
  const toRate = rates.rates[result.toCurrency];

  if (!fromRate || !toRate) {
    return { ...result, isLoading: false, error: 'Currency not supported' };
  }

  // Convert via USD base
  const inUSD = result.fromValue / fromRate;
  const converted = inUSD * toRate;
  const rate = toRate / fromRate;

  return {
    ...result,
    toValue: converted,
    rate,
    isLoading: false,
    display: `${formatCurrency(result.fromValue, result.fromCurrency)} = ${formatCurrency(converted, result.toCurrency)}`,
  };
}

export function getCurrencyInfo(code: string): { symbol: string; name: string } | null {
  return CURRENCIES[code.toUpperCase()] || null;
}

export function getAllCurrencyCodes(): string[] {
  return Object.keys(CURRENCIES);
}

// ─── Interactive Mode Helpers ──────────────────────────────────

export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

export const POPULAR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'CNY', 'AUD', 'CAD', 'CHF', 'BTC'];

export function getCurrencyList(): CurrencyOption[] {
  return Object.entries(CURRENCIES).map(([code, info]) => ({
    code,
    symbol: info.symbol,
    name: info.name,
  }));
}

export { formatCurrency };
