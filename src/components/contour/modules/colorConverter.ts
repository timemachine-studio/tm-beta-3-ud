/**
 * TimeMachine Contour - Color Converter Module
 *
 * Detects color values: #hex, rgb(), hsl(), and named CSS colors.
 * Converts between HEX, RGB, HSL, and shows a color swatch.
 */

export interface ColorResult {
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  display: string;
  input: string;
  cssColor: string; // valid CSS color string for preview swatch
}

// Common CSS named colors (subset)
const NAMED_COLORS: Record<string, string> = {
  red: '#ff0000', blue: '#0000ff', green: '#008000', yellow: '#ffff00',
  orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', white: '#ffffff',
  black: '#000000', gray: '#808080', grey: '#808080', cyan: '#00ffff',
  magenta: '#ff00ff', lime: '#00ff00', maroon: '#800000', navy: '#000080',
  olive: '#808000', teal: '#008080', aqua: '#00ffff', coral: '#ff7f50',
  crimson: '#dc143c', gold: '#ffd700', indigo: '#4b0082', ivory: '#fffff0',
  khaki: '#f0e68c', lavender: '#e6e6fa', salmon: '#fa8072', silver: '#c0c0c0',
  skyblue: '#87ceeb', tomato: '#ff6347', turquoise: '#40e0d0', violet: '#ee82ee',
  wheat: '#f5deb3', chocolate: '#d2691e', firebrick: '#b22222', orchid: '#da70d6',
  plum: '#dda0dd', sienna: '#a0522d', tan: '#d2b48c', thistle: '#d8bfd8',
};

// HEX pattern: #RGB, #RRGGBB, #RRGGBBAA
const HEX_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

// RGB pattern: rgb(R, G, B) or rgba(R, G, B, A)
const RGB_PATTERN = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/i;

// HSL pattern: hsl(H, S%, L%) or hsla(H, S%, L%, A)
const HSL_PATTERN = /^hsla?\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*(?:,\s*[\d.]+\s*)?\)$/i;

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (h.length === 8) {
    h = h.slice(0, 6); // drop alpha
  }
  if (h.length !== 6) return null;

  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360; s /= 100; l /= 100;

  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

// ─── Interactive Mode Helpers ──────────────────────────────────

export { hexToRgb, rgbToHex, rgbToHsl, hslToRgb };

export const COLOR_PRESETS = [
  { name: 'Red', hex: '#FF0000' }, { name: 'Coral', hex: '#FF7F50' },
  { name: 'Orange', hex: '#FFA500' }, { name: 'Gold', hex: '#FFD700' },
  { name: 'Green', hex: '#008000' }, { name: 'Cyan', hex: '#00FFFF' },
  { name: 'Blue', hex: '#0000FF' }, { name: 'Purple', hex: '#800080' },
  { name: 'Pink', hex: '#FFC0CB' }, { name: 'Crimson', hex: '#DC143C' },
];

export function colorFromRgb(r: number, g: number, b: number): ColorResult {
  const hex = rgbToHex(r, g, b).toUpperCase();
  const hsl = rgbToHsl(r, g, b);
  return {
    hex, rgb: { r, g, b }, hsl,
    display: `${hex} · rgb(${r}, ${g}, ${b}) · hsl(${hsl.h}°, ${hsl.s}%, ${hsl.l}%)`,
    input: hex, cssColor: hex,
  };
}

export function detectColor(input: string): ColorResult | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let rgb: { r: number; g: number; b: number } | null = null;

  // Check HEX
  if (HEX_PATTERN.test(trimmed)) {
    rgb = hexToRgb(trimmed);
  }

  // Check RGB
  if (!rgb) {
    const rgbMatch = trimmed.match(RGB_PATTERN);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]);
      const g = parseInt(rgbMatch[2]);
      const b = parseInt(rgbMatch[3]);
      if (r <= 255 && g <= 255 && b <= 255) {
        rgb = { r, g, b };
      }
    }
  }

  // Check HSL
  if (!rgb) {
    const hslMatch = trimmed.match(HSL_PATTERN);
    if (hslMatch) {
      const h = parseInt(hslMatch[1]);
      const s = parseInt(hslMatch[2]);
      const l = parseInt(hslMatch[3]);
      if (h <= 360 && s <= 100 && l <= 100) {
        rgb = hslToRgb(h, s, l);
      }
    }
  }

  // Check named colors
  if (!rgb) {
    const lower = trimmed.toLowerCase();
    if (NAMED_COLORS[lower]) {
      rgb = hexToRgb(NAMED_COLORS[lower]);
    }
  }

  if (!rgb) return null;

  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  return {
    hex: hex.toUpperCase(),
    rgb,
    hsl,
    display: `${hex.toUpperCase()} · rgb(${rgb.r}, ${rgb.g}, ${rgb.b}) · hsl(${hsl.h}°, ${hsl.s}%, ${hsl.l}%)`,
    input: trimmed,
    cssColor: hex,
  };
}
