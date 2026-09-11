import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ModuleData } from '../moduleRegistry';
import {
  hexToRgb, rgbToHex, rgbToHsl, COLOR_PRESETS,
  ColorResult,
} from '../modules/colorConverter';
import { AccentTheme, FooterHint } from './shared';

function ColorInteractive({ color, accent: _accent, onCopyValue }: { color?: ColorResult; accent: AccentTheme; onCopyValue?: (value: string) => void }) {
  const [rgb, setRgb] = useState({ r: 255, g: 87, b: 51 });
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const activeRgb = !hasInteracted && color?.rgb ? color.rgb : rgb;
  const { r, g, b } = activeRgb;

  // Derived values
  const hex = rgbToHex(r, g, b).toUpperCase();
  const hsl = rgbToHsl(r, g, b);
  const cssColor = rgbToHex(r, g, b);

  const hexInput = hexDraft ?? hex;

  const handleRgb = (which: 'r' | 'g' | 'b', val: string) => {
    setHasInteracted(true);
    setHexDraft(null);
    const n = parseInt(val);
    if (isNaN(n)) return;
    const clamped = Math.max(0, Math.min(255, n));
    setRgb({ ...activeRgb, [which]: clamped });
  };

  const handleHexChange = (val: string) => {
    setHasInteracted(true);
    setHexDraft(val);
    const parsed = hexToRgb(val);
    if (parsed) {
      setRgb(parsed);
    }
  };

  const handlePickerChange = (val: string) => {
    setHasInteracted(true);
    setHexDraft(null);
    const parsed = hexToRgb(val);
    if (parsed) {
      setRgb(parsed);
    }
  };

  const handlePreset = (presetHex: string) => {
    setHasInteracted(true);
    setHexDraft(null);
    const parsed = hexToRgb(presetHex);
    if (parsed) {
      setRgb(parsed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onCopyValue) {
      e.preventDefault();
      onCopyValue(hex);
    }
  };

  return (
    <div className="p-4 space-y-3" onKeyDown={handleKeyDown}>
      {/* Preset color swatches */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden">
        {COLOR_PRESETS.map(p => (
          <button
            key={p.name}
            onClick={() => handlePreset(p.hex)}
            className="w-6 h-6 rounded-lg shrink-0 border transition-all hover:scale-110"
            style={{
              background: p.hex,
              borderColor: hex === p.hex.toUpperCase() ? 'rgb(var(--tm-ink-rgb) / 0.6)' : 'rgb(var(--tm-ink-rgb) / 0.15)',
              boxShadow: hex === p.hex.toUpperCase() ? `0 0 8px ${p.hex}40` : 'none',
            }}
            title={p.name}
          />
        ))}
      </div>

      {/* Picker + HEX input row */}
      <div className="flex items-center gap-2.5">
        {/* Native color picker */}
        <div className="relative shrink-0">
          <input
            type="color"
            value={cssColor}
            onChange={e => handlePickerChange(e.target.value)}
            className="w-10 h-10 rounded-xl border border-white/20 cursor-pointer p-0 [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-none"
            style={{ background: 'rgb(var(--tm-ink-rgb) / 0.06)' }}
          />
        </div>

        {/* HEX input */}
        <input
          type="text"
          value={hexInput}
          onChange={e => handleHexChange(e.target.value)}
          maxLength={9}
          className="w-[100px] bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-2 text-white text-sm font-mono focus:outline-hidden focus:border-white/25 transition-colors"
          placeholder="#000000"
        />

        {/* Large swatch preview */}
        <div
          className="flex-1 h-10 rounded-xl border border-white/15"
          style={{ background: cssColor, boxShadow: `0 0 20px ${cssColor}30` }}
        />
      </div>

      {/* RGB inputs */}
      <div className="flex items-center gap-2">
        {(['r', 'g', 'b'] as const).map(ch => (
          <div key={ch} className="flex items-center gap-1.5 flex-1">
            <span className="text-[11px] font-mono font-medium text-white/30 uppercase w-3">{ch}</span>
            <input
              type="number"
              min={0} max={255}
              value={ch === 'r' ? r : ch === 'g' ? g : b}
              onChange={e => handleRgb(ch, e.target.value)}
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs font-mono text-center focus:outline-hidden focus:border-white/25 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        ))}
        {/* HSL display */}
        <div className="shrink-0 text-[10px] text-white/25 font-mono">
          hsl({hsl.h},{hsl.s}%,{hsl.l}%)
        </div>
      </div>

      {/* All formats display */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="flex items-center gap-3 pt-1"
      >
        <div
          className="w-10 h-10 rounded-xl border border-white/20 shrink-0"
          style={{ background: cssColor }}
        />
        <div className="flex-1 min-w-0">
          <span className="text-white font-semibold text-lg font-mono">{hex}</span>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            <span className="text-white/40 text-xs font-mono">rgb({r}, {g}, {b})</span>
            <span className="text-white/40 text-xs font-mono">hsl({hsl.h}, {hsl.s}%, {hsl.l}%)</span>
          </div>
        </div>
      </motion.div>

      <FooterHint text="Press Enter to copy HEX value" />
    </div>
  );
}

export function ColorView({ module, accent, onCopyValue }: { module: ModuleData; accent: AccentTheme; onCopyValue?: (value: string) => void }) {
  const color = module.color;

  if (!module.focused) {
    if (!color) return null;
    return (
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl border border-white/20 shrink-0" style={{ background: color.cssColor }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white font-semibold text-lg font-mono">{color.hex}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              <span className="text-white/40 text-xs font-mono">rgb({color.rgb.r}, {color.rgb.g}, {color.rgb.b})</span>
              <span className="text-white/40 text-xs font-mono">hsl({color.hsl.h}, {color.hsl.s}%, {color.hsl.l}%)</span>
            </div>
          </div>
        </div>
        <FooterHint text="Press Enter to copy HEX value" />
      </div>
    );
  }

  return <ColorInteractive color={color} accent={accent} onCopyValue={onCopyValue} />;
}
