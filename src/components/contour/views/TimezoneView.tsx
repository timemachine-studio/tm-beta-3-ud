import React, { useEffect, useState } from 'react';
import { Globe, Shuffle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { ModuleData } from '../moduleRegistry';
import {
  getTimezoneList, POPULAR_TIMEZONES, convertTimezoneDirect,
  TimezoneResult, TimezoneOption,
} from '../modules/timezoneConverter';
import { AccentTheme, IconBadge, FooterHint, SELECT_ARROW } from './shared';

const TZ_LIST = getTimezoneList();
const TZ_REGIONS = (() => {
  const grouped = new Map<string, TimezoneOption[]>();
  for (const tz of TZ_LIST) {
    const list = grouped.get(tz.region) || [];
    list.push(tz);
    grouped.set(tz.region, list);
  }
  return Array.from(grouped.entries());
})();

function TimezoneView({ module, accent, onCopyValue }: { module: ModuleData; accent: AccentTheme; onCopyValue?: (value: string) => void }) {
  const tz = module.timezone;

  if (!module.focused) {
    if (!tz) return null;
    return (
      <div className="p-4">
        <div className="flex items-center gap-3">
          <IconBadge icon={Globe} accent={accent} />
          <div className="flex-1 min-w-0">
            <div className={`text-xl font-semibold tracking-tight ${tz.isPartial ? 'text-white/50' : 'text-white'}`}>
              {tz.display}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <TimezoneInteractive tz={tz} accent={accent} onCopyValue={onCopyValue} />;
}

function TimezoneInteractive({ tz, accent, onCopyValue }: { tz?: TimezoneResult; accent: AccentTheme; onCopyValue?: (value: string) => void }) {
  const now = new Date();
  const initH = now.getHours();
  const [hours, setHours] = useState(initH > 12 ? initH - 12 : initH === 0 ? 12 : initH);
  const [minutes, setMinutes] = useState(now.getMinutes());
  const [isPm, setIsPm] = useState(initH >= 12);
  const [fromIana, setFromIana] = useState('America/New_York');
  const [toIana, setToIana] = useState('Asia/Kolkata');
  const [result, setResult] = useState<TimezoneResult | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Compute result
  useEffect(() => {
    let h24 = hours;
    if (isPm && hours !== 12) h24 += 12;
    if (!isPm && hours === 12) h24 = 0;
    setResult(convertTimezoneDirect(h24, minutes, fromIana, toIana));
  }, [hours, minutes, isPm, fromIana, toIana]);

  // Sync from textbox
  useEffect(() => {
    if (hasInteracted || !tz || tz.isPartial) return;
    const fromEntry = TZ_LIST.find(t => t.label === tz.fromLabel);
    const toEntry = TZ_LIST.find(t => t.label === tz.toLabel);
    if (fromEntry) setFromIana(fromEntry.iana);
    if (toEntry) setToIana(toEntry.iana);
  }, [tz?.fromLabel, tz?.toLabel, hasInteracted]);

  const handleNow = () => {
    setHasInteracted(true);
    const n = new Date();
    const h = n.getHours();
    setIsPm(h >= 12);
    setHours(h > 12 ? h - 12 : h === 0 ? 12 : h);
    setMinutes(n.getMinutes());
  };

  const handleSwap = () => {
    setHasInteracted(true);
    setFromIana(toIana);
    setToIana(fromIana);
  };

  const handleHourChange = (val: string) => {
    setHasInteracted(true);
    const n = parseInt(val);
    if (!isNaN(n) && n >= 1 && n <= 12) setHours(n);
  };

  const handleMinuteChange = (val: string) => {
    setHasInteracted(true);
    const n = parseInt(val);
    if (!isNaN(n) && n >= 0 && n <= 59) setMinutes(n);
    else if (val === '') setMinutes(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && result && onCopyValue) {
      e.preventDefault();
      onCopyValue(result.display);
    }
  };

  const selectStyle = {
    backgroundImage: SELECT_ARROW,
    backgroundRepeat: 'no-repeat' as const,
    backgroundPosition: 'right 8px center',
  };
  const optionStyle = { background: '#1a1a1a', color: 'white' };

  return (
    <div className="p-4 space-y-3" onKeyDown={handleKeyDown}>
      {/* Popular timezone pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden">
        {POPULAR_TIMEZONES.map(label => {
          const entry = TZ_LIST.find(t => t.label === label);
          if (!entry) return null;
          const isActive = toIana === entry.iana;
          return (
            <button
              key={label}
              onClick={() => { setHasInteracted(true); setToIana(entry.iana); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                isActive ? 'text-white' : 'text-white/40 hover:text-white/60'
              }`}
              style={isActive ? {
                background: accent.bg,
                border: `1px solid ${accent.border}`,
              } : {
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Time input row */}
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={hours}
          min={1} max={12}
          onChange={e => handleHourChange(e.target.value)}
          className="w-[44px] bg-white/[0.06] border border-white/10 rounded-lg px-1.5 py-2 text-white text-sm font-mono text-center focus:outline-none focus:border-white/25 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-white/30 font-mono text-sm">:</span>
        <input
          type="text"
          value={String(minutes).padStart(2, '0')}
          onChange={e => handleMinuteChange(e.target.value)}
          maxLength={2}
          className="w-[44px] bg-white/[0.06] border border-white/10 rounded-lg px-1.5 py-2 text-white text-sm font-mono text-center focus:outline-none focus:border-white/25 transition-colors"
        />
        {/* AM/PM toggle */}
        <div className="flex rounded-lg overflow-hidden border border-white/10 flex-shrink-0">
          <button
            onClick={() => { setHasInteracted(true); setIsPm(false); }}
            className={`px-2 py-2 text-[11px] font-medium transition-colors ${!isPm ? 'text-white' : 'text-white/30'}`}
            style={!isPm ? { background: accent.bg } : { background: 'rgba(255,255,255,0.03)' }}
          >AM</button>
          <button
            onClick={() => { setHasInteracted(true); setIsPm(true); }}
            className={`px-2 py-2 text-[11px] font-medium transition-colors ${isPm ? 'text-white' : 'text-white/30'}`}
            style={isPm ? { background: accent.bg } : { background: 'rgba(255,255,255,0.03)' }}
          >PM</button>
        </div>
        {/* Now button */}
        <button
          onClick={handleNow}
          className="px-2.5 py-2 rounded-lg text-[11px] font-medium text-white/50 hover:text-white/80 transition-colors flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Clock className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* From / To timezone row */}
      <div className="flex items-center gap-2">
        <select
          value={fromIana}
          onChange={e => { setHasInteracted(true); setFromIana(e.target.value); }}
          className="flex-1 min-w-0 bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-2 text-white text-sm focus:outline-none focus:border-white/25 transition-colors appearance-none cursor-pointer pr-7"
          style={selectStyle}
        >
          {TZ_REGIONS.map(([region, zones]) => (
            <optgroup key={region} label={region} style={optionStyle}>
              {zones.map(z => (
                <option key={z.label} value={z.iana} style={optionStyle}>{z.label}</option>
              ))}
            </optgroup>
          ))}
        </select>

        <button
          onClick={handleSwap}
          className="p-2 rounded-lg text-white/40 hover:text-white/70 transition-colors flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Shuffle className="w-3.5 h-3.5" />
        </button>

        <select
          value={toIana}
          onChange={e => { setHasInteracted(true); setToIana(e.target.value); }}
          className="flex-1 min-w-0 bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-2 text-white text-sm focus:outline-none focus:border-white/25 transition-colors appearance-none cursor-pointer pr-7"
          style={selectStyle}
        >
          {TZ_REGIONS.map(([region, zones]) => (
            <optgroup key={region} label={region} style={optionStyle}>
              {zones.map(z => (
                <option key={z.label} value={z.iana} style={optionStyle}>{z.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Result */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-3 pt-1"
        >
          <IconBadge icon={Globe} accent={accent} />
          <div className="flex-1 min-w-0">
            <div className="text-xl font-semibold tracking-tight text-white">
              {result.display}
            </div>
          </div>
        </motion.div>
      )}

      {result && <FooterHint text="Press Enter to copy result" />}
    </div>
  );
}

export { TimezoneView };
