import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Shuffle } from 'lucide-react';
import { motion } from 'framer-motion';
import { ModuleData } from '../moduleRegistry';
import { getUnitCategories, convertDirect, UnitResult } from '../modules/unitConverter';
import { AccentTheme, IconBadge, FooterHint, SELECT_ARROW } from './shared';

const UNIT_CATEGORIES = getUnitCategories();

export function UnitsView({ module, accent, onCopyValue }: { module: ModuleData; accent: AccentTheme; onCopyValue?: (value: string) => void }) {
  const units = module.units;

  if (!module.focused) {
    if (!units) return null;
    return (
      <div className="p-4">
        <div className="flex items-center gap-3">
          <IconBadge icon={ArrowLeftRight} accent={accent} />
          <div className="flex-1 min-w-0">
            <div className={`text-xl font-semibold tracking-tight ${units.isPartial ? 'text-white/50' : 'text-white'}`}>
              {units.display}
            </div>
          </div>
        </div>
        {!units.isPartial && <FooterHint text="Press Enter to copy result" />}
      </div>
    );
  }

  return <UnitsInteractive units={units} accent={accent} onCopyValue={onCopyValue} />;
}

function UnitsInteractive({ units, accent, onCopyValue }: { units?: UnitResult; accent: AccentTheme; onCopyValue?: (value: string) => void }) {
  const [categoryId, setCategoryId] = useState(UNIT_CATEGORIES[0].id);
  const [fromUnitLabel, setFromUnitLabel] = useState(UNIT_CATEGORIES[0].units[0].label);
  const [toUnitLabel, setToUnitLabel] = useState(UNIT_CATEGORIES[0].units[1]?.label || UNIT_CATEGORIES[0].units[0].label);
  const [inputValue, setInputValue] = useState('1');
  const [result, setResult] = useState<UnitResult | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentCategory = UNIT_CATEGORIES.find(c => c.id === categoryId) || UNIT_CATEGORIES[0];

  useEffect(() => {
    const num = parseFloat(inputValue);
    if (isNaN(num) || inputValue === '') {
      setResult(null);
      return;
    }
    setResult(convertDirect(num, fromUnitLabel, toUnitLabel));
  }, [inputValue, fromUnitLabel, toUnitLabel]);

  useEffect(() => {
    if (hasInteracted || !units || units.isPartial) return;
    for (const cat of UNIT_CATEGORIES) {
      const from = cat.units.find(u => u.label === units.fromLabel);
      const to = cat.units.find(u => u.label === units.toLabel);
      if (from && to) {
        setCategoryId(cat.id);
        setFromUnitLabel(from.label);
        setToUnitLabel(to.label);
        setInputValue(String(units.fromValue));
        break;
      }
    }
  }, [units?.fromLabel, units?.toLabel, units?.fromValue, units?.isPartial, hasInteracted]);

  const handleCategoryChange = (catId: string) => {
    setHasInteracted(true);
    setCategoryId(catId);
    const cat = UNIT_CATEGORIES.find(c => c.id === catId);
    if (cat && cat.units.length >= 2) {
      setFromUnitLabel(cat.units[0].label);
      setToUnitLabel(cat.units[1].label);
    } else if (cat) {
      setFromUnitLabel(cat.units[0].label);
      setToUnitLabel(cat.units[0].label);
    }
  };

  const handleSwap = () => {
    setHasInteracted(true);
    setFromUnitLabel(toUnitLabel);
    setToUnitLabel(fromUnitLabel);
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

  return (
    <div className="p-4 space-y-3" onKeyDown={handleKeyDown}>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden">
        {UNIT_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => handleCategoryChange(cat.id)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
              categoryId === cat.id ? 'text-white' : 'text-white/40 hover:text-white/60'
            }`}
            style={categoryId === cat.id ? {
              background: accent.bg,
              border: `1px solid ${accent.border}`,
              boxShadow: `0 0 8px ${accent.border.replace('0.25', '0.08')}`,
            } : {
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="number"
          value={inputValue}
          onChange={e => { setHasInteracted(true); setInputValue(e.target.value); }}
          className="w-[72px] bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-2 text-white text-sm font-mono text-center focus:outline-none focus:border-white/25 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          placeholder="0"
        />
        <select
          value={fromUnitLabel}
          onChange={e => { setHasInteracted(true); setFromUnitLabel(e.target.value); }}
          className="flex-1 min-w-0 bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-2 text-white text-sm focus:outline-none focus:border-white/25 transition-colors appearance-none cursor-pointer pr-7"
          style={selectStyle}
        >
          {currentCategory.units.map(u => (
            <option key={u.label} value={u.label} style={{ background: '#1a1a1a', color: 'white' }}>{u.label}</option>
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
          value={toUnitLabel}
          onChange={e => { setHasInteracted(true); setToUnitLabel(e.target.value); }}
          className="flex-1 min-w-0 bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-2 text-white text-sm focus:outline-none focus:border-white/25 transition-colors appearance-none cursor-pointer pr-7"
          style={selectStyle}
        >
          {currentCategory.units.map(u => (
            <option key={u.label} value={u.label} style={{ background: '#1a1a1a', color: 'white' }}>{u.label}</option>
          ))}
        </select>
      </div>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-3 pt-1"
        >
          <IconBadge icon={ArrowLeftRight} accent={accent} />
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
