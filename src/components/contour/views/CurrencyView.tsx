import React, { useEffect, useRef, useState } from 'react';
import { DollarSign, Shuffle } from 'lucide-react';
import { motion } from 'framer-motion';
import { ModuleData } from '../moduleRegistry';
import {
  getCurrencyList, POPULAR_CURRENCIES, resolveCurrency, formatCurrency,
  CurrencyResult,
} from '../modules/currencyConverter';
import { AccentTheme, IconBadge, FooterHint, SELECT_ARROW } from './shared';

const CURRENCY_LIST = getCurrencyList();

export function CurrencyView({ module, accent, onCopyValue }: { module: ModuleData; accent: AccentTheme; onCopyValue?: (value: string) => void }) {
  const curr = module.currency;

  // Non-focused: simple display (unchanged behavior)
  if (!module.focused) {
    if (!curr) return null;
    return (
      <div className="p-4">
        <div className="flex items-center gap-3">
          <IconBadge icon={DollarSign} accent={accent} />
          <div className="flex-1 min-w-0">
            <div className={`text-xl font-semibold tracking-tight ${curr.isPartial || curr.isLoading ? 'text-white/50' : 'text-white'}`}>
              {curr.display}
            </div>
            {curr.rate && !curr.isPartial && (
              <div className="text-white/30 text-xs mt-1">
                1 {curr.fromCurrency} = {curr.rate.toFixed(4)} {curr.toCurrency}
              </div>
            )}
            {curr.error && (
              <div className="text-red-400/60 text-xs mt-1">{curr.error}</div>
            )}
          </div>
          {curr.isLoading && (
            <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          )}
        </div>
        {!curr.isPartial && !curr.isLoading && curr.toValue !== null && (
          <FooterHint text="Press Enter to copy result" />
        )}
      </div>
    );
  }

  // Focused mode: interactive UI
  return <CurrencyInteractive curr={curr} accent={accent} onCopyValue={onCopyValue} />;
}

function CurrencyInteractive({ curr, accent, onCopyValue }: { curr?: CurrencyResult; accent: AccentTheme; onCopyValue?: (value: string) => void }) {
  const [localFromCode, setFromCode] = useState('USD');
  const [localToCode, setToCode] = useState('EUR');
  const [localAmount, setAmount] = useState('1');
  const [resolvedResult, setResolvedResult] = useState<CurrencyResult | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const genRef = useRef(0);

  const useDetection = !hasInteracted && curr && !curr.isPartial;
  const fromCode = useDetection ? curr.fromCurrency : localFromCode;
  const toCode = useDetection && curr.toCurrency ? curr.toCurrency : localToCode;
  const amount = useDetection ? String(curr.fromValue) : localAmount;
  const numericAmount = parseFloat(amount);
  const hasValidAmount = amount !== '' && !isNaN(numericAmount);

  // Resolve conversion whenever inputs change
  useEffect(() => {
    if (!hasValidAmount || fromCode === toCode || useDetection) return;

    const gen = ++genRef.current;
    resolveCurrency({
      fromValue: numericAmount, fromCurrency: fromCode, toCurrency: toCode,
      toValue: null, rate: null, display: '', isPartial: false, isLoading: true,
    }).then(resolved => {
      if (genRef.current !== gen) return;
      setResolvedResult(resolved);
    });
  }, [fromCode, hasValidAmount, numericAmount, toCode, useDetection]);

  const result = !hasValidAmount
    ? null
    : fromCode === toCode
      ? {
          fromValue: numericAmount, fromCurrency: fromCode, toCurrency: toCode,
          toValue: numericAmount, rate: 1,
          display: `${formatCurrency(numericAmount, fromCode)} = ${formatCurrency(numericAmount, toCode)}`,
          isPartial: false, isLoading: false,
        } satisfies CurrencyResult
      : useDetection
        ? curr
        : resolvedResult?.fromValue === numericAmount &&
            resolvedResult.fromCurrency === fromCode && resolvedResult.toCurrency === toCode
          ? resolvedResult
          : null;
  const isLoading = hasValidAmount && fromCode !== toCode && (!result || result.isLoading);

  const handleSwap = () => {
    setHasInteracted(true);
    setFromCode(toCode);
    setToCode(fromCode);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && result && !isLoading && result.toValue !== null && onCopyValue) {
      e.preventDefault();
      onCopyValue(result.display);
    }
  };

  const popularFrom = POPULAR_CURRENCIES.filter(c => c !== toCode).slice(0, 6);
  const popularTo = POPULAR_CURRENCIES.filter(c => c !== fromCode).slice(0, 6);

  const selectStyle = {
    backgroundImage: SELECT_ARROW,
    backgroundRepeat: 'no-repeat' as const,
    backgroundPosition: 'right 8px center',
  };

  const optionStyle = { background: '#1a1a1a', color: 'white' };

  return (
    <div className="p-4 space-y-3" onKeyDown={handleKeyDown}>
      {/* Quick pick pills for "From" */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-white/20 font-medium uppercase tracking-wider mr-1">From</span>
        <div className="flex gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {popularFrom.map(code => (
            <button
              key={code}
              onClick={() => { setHasInteracted(true); setFromCode(code); }}
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-medium whitespace-nowrap transition-all ${
                fromCode === code ? 'text-white' : 'text-white/35 hover:text-white/55'
              }`}
              style={fromCode === code ? {
                background: accent.bg,
                border: `1px solid ${accent.border}`,
              } : {
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {code}
            </button>
          ))}
        </div>
      </div>

      {/* Conversion row */}
      <div className="flex items-center gap-2">
        {/* Amount input */}
        <input
          type="number"
          value={amount}
          onChange={e => { setHasInteracted(true); setAmount(e.target.value); }}
          className="w-[80px] bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-2 text-white text-sm font-mono text-center focus:outline-hidden focus:border-white/25 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          placeholder="0"
        />

        {/* From currency */}
        <select
          value={fromCode}
          onChange={e => { setHasInteracted(true); setFromCode(e.target.value); }}
          className="flex-1 min-w-0 bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-2 text-white text-sm focus:outline-hidden focus:border-white/25 transition-colors appearance-none cursor-pointer pr-7"
          style={selectStyle}
        >
          <optgroup label="Popular" style={optionStyle}>
            {POPULAR_CURRENCIES.map(code => {
              const c = CURRENCY_LIST.find(x => x.code === code);
              return <option key={code} value={code} style={optionStyle}>{c?.symbol} {code}</option>;
            })}
          </optgroup>
          <optgroup label="All" style={optionStyle}>
            {CURRENCY_LIST.filter(c => !POPULAR_CURRENCIES.includes(c.code)).map(c => (
              <option key={c.code} value={c.code} style={optionStyle}>{c.code} - {c.name}</option>
            ))}
          </optgroup>
        </select>

        {/* Swap */}
        <button
          onClick={handleSwap}
          className="p-2 rounded-lg text-white/40 hover:text-white/70 transition-colors shrink-0"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Shuffle className="w-3.5 h-3.5" />
        </button>

        {/* To currency */}
        <select
          value={toCode}
          onChange={e => { setHasInteracted(true); setToCode(e.target.value); }}
          className="flex-1 min-w-0 bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-2 text-white text-sm focus:outline-hidden focus:border-white/25 transition-colors appearance-none cursor-pointer pr-7"
          style={selectStyle}
        >
          <optgroup label="Popular" style={optionStyle}>
            {POPULAR_CURRENCIES.map(code => {
              const c = CURRENCY_LIST.find(x => x.code === code);
              return <option key={code} value={code} style={optionStyle}>{c?.symbol} {code}</option>;
            })}
          </optgroup>
          <optgroup label="All" style={optionStyle}>
            {CURRENCY_LIST.filter(c => !POPULAR_CURRENCIES.includes(c.code)).map(c => (
              <option key={c.code} value={c.code} style={optionStyle}>{c.code} - {c.name}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Quick pick pills for "To" */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-white/20 font-medium uppercase tracking-wider mr-1.5">To</span>
        <div className="flex gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {popularTo.map(code => (
            <button
              key={code}
              onClick={() => { setHasInteracted(true); setToCode(code); }}
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-medium whitespace-nowrap transition-all ${
                toCode === code ? 'text-white' : 'text-white/35 hover:text-white/55'
              }`}
              style={toCode === code ? {
                background: accent.bg,
                border: `1px solid ${accent.border}`,
              } : {
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {code}
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      {(result || isLoading) && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-3 pt-1"
        >
          <IconBadge icon={DollarSign} accent={accent} />
          <div className="flex-1 min-w-0">
            <div className={`text-xl font-semibold tracking-tight ${isLoading ? 'text-white/50' : 'text-white'}`}>
              {isLoading ? `${formatCurrency(parseFloat(amount) || 0, fromCode)} = ...` : result?.display}
            </div>
            {result?.rate && !isLoading && (
              <div className="text-white/30 text-xs mt-1">
                1 {result.fromCurrency} = {result.rate.toFixed(4)} {result.toCurrency}
              </div>
            )}
            {result?.error && (
              <div className="text-red-400/60 text-xs mt-1">{result.error}</div>
            )}
          </div>
          {isLoading && (
            <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin shrink-0" />
          )}
        </motion.div>
      )}

      {result && !isLoading && result.toValue !== null && (
        <FooterHint text="Press Enter to copy result" />
      )}
    </div>
  );
}
