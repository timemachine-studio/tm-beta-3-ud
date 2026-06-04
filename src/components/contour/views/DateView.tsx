import React, { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { ModuleData } from '../moduleRegistry';
import {
  DATE_OPERATIONS, DATE_QUICK_PICKS, computeDateDirect, parseDate,
  DateResult, DateOperation,
} from '../modules/dateCalculator';
import { AccentTheme, IconBadge, FooterHint } from './shared';

function DateView({ module, accent, onCopyValue }: { module: ModuleData; accent: AccentTheme; onCopyValue?: (value: string) => void }) {
  const date = module.date;

  if (!module.focused) {
    if (!date) return null;
    return (
      <div className="p-4">
        <div className="flex items-center gap-3">
          <IconBadge icon={Calendar} accent={accent} />
          <div className="flex-1 min-w-0">
            <div className={`text-xl font-semibold tracking-tight ${date.isPartial ? 'text-white/50' : 'text-white'}`}>
              {date.display}
            </div>
            {date.subtitle && (
              <div className="text-white/30 text-xs mt-1">{date.subtitle}</div>
            )}
          </div>
        </div>
        {!date.isPartial && <FooterHint text="Press Enter to copy result" />}
      </div>
    );
  }

  return <DateInteractive date={date} accent={accent} onCopyValue={onCopyValue} />;
}

function DateInteractive({ date, accent, onCopyValue }: { date?: DateResult; accent: AccentTheme; onCopyValue?: (value: string) => void }) {
  const [operation, setOperation] = useState<DateOperation>('until');
  const [dateInput1, setDateInput1] = useState('');
  const [dateInput2, setDateInput2] = useState('');
  const [numDays, setNumDays] = useState('30');
  const [result, setResult] = useState<DateResult | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Compute result whenever inputs change
  useEffect(() => {
    if (operation === 'until' || operation === 'since') {
      const parsed = dateInput1 ? parseDate(dateInput1) : null;
      if (!parsed) { setResult(null); return; }
      setResult(computeDateDirect(operation, parsed));
    } else if (operation === 'from_now' || operation === 'ago') {
      const n = parseInt(numDays);
      if (isNaN(n) || numDays === '') { setResult(null); return; }
      setResult(computeDateDirect(operation, null, null, n));
    } else if (operation === 'between') {
      const d1 = dateInput1 ? parseDate(dateInput1) : null;
      const d2 = dateInput2 ? parseDate(dateInput2) : null;
      if (!d1 || !d2) { setResult(null); return; }
      setResult(computeDateDirect(operation, d1, d2));
    }
  }, [operation, dateInput1, dateInput2, numDays]);

  // Sync from textbox detection
  useEffect(() => {
    if (hasInteracted || !date || date.isPartial) return;
    setOperation(date.type);
  }, [date?.type, date?.isPartial, hasInteracted]);

  const handleQuickPick = (value: string) => {
    setHasInteracted(true);
    setDateInput1(value);
    if (operation !== 'until' && operation !== 'since') {
      setOperation('until');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && result && onCopyValue) {
      e.preventDefault();
      onCopyValue(result.display);
    }
  };

  const needsDateInput = operation === 'until' || operation === 'since';
  const needsNumInput = operation === 'from_now' || operation === 'ago';
  const needsTwoDates = operation === 'between';

  return (
    <div className="p-4 space-y-3" onKeyDown={handleKeyDown}>
      {/* Operation pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden">
        {DATE_OPERATIONS.map(op => (
          <button
            key={op.id}
            onClick={() => { setHasInteracted(true); setOperation(op.id); }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
              operation === op.id ? 'text-white' : 'text-white/40 hover:text-white/60'
            }`}
            style={operation === op.id ? {
              background: accent.bg,
              border: `1px solid ${accent.border}`,
              boxShadow: `0 0 8px ${accent.border.replace('0.25', '0.08')}`,
            } : {
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {op.label}
          </button>
        ))}
      </div>

      {/* Quick picks (for until/since) */}
      {needsDateInput && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/20 font-medium uppercase tracking-wider mr-1">Quick</span>
          <div className="flex gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {DATE_QUICK_PICKS.map(qp => (
              <button
                key={qp.value}
                onClick={() => handleQuickPick(qp.value)}
                className="px-2 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap transition-all text-white/35 hover:text-white/55"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                {qp.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-center gap-2">
        {needsDateInput && (
          <input
            type="text"
            value={dateInput1}
            onChange={e => { setHasInteracted(true); setDateInput1(e.target.value); }}
            className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-2 text-white text-sm focus:outline-none focus:border-white/25 transition-colors"
            placeholder="e.g. Dec 25, March 15 2026"
          />
        )}
        {needsNumInput && (
          <>
            <input
              type="number"
              value={numDays}
              onChange={e => { setHasInteracted(true); setNumDays(e.target.value); }}
              className="w-[80px] bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-2 text-white text-sm font-mono text-center focus:outline-none focus:border-white/25 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="30"
            />
            <span className="text-white/30 text-sm">days {operation === 'from_now' ? 'from now' : 'ago'}</span>
          </>
        )}
        {needsTwoDates && (
          <>
            <input
              type="text"
              value={dateInput1}
              onChange={e => { setHasInteracted(true); setDateInput1(e.target.value); }}
              className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-2 text-white text-sm focus:outline-none focus:border-white/25 transition-colors"
              placeholder="Start date"
            />
            <span className="text-white/25 text-xs">to</span>
            <input
              type="text"
              value={dateInput2}
              onChange={e => { setHasInteracted(true); setDateInput2(e.target.value); }}
              className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-2 text-white text-sm focus:outline-none focus:border-white/25 transition-colors"
              placeholder="End date"
            />
          </>
        )}
      </div>

      {/* Result */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-3 pt-1"
        >
          <IconBadge icon={Calendar} accent={accent} />
          <div className="flex-1 min-w-0">
            <div className="text-xl font-semibold tracking-tight text-white">
              {result.display}
            </div>
            {result.subtitle && (
              <div className="text-white/30 text-xs mt-1">{result.subtitle}</div>
            )}
          </div>
        </motion.div>
      )}

      {result && <FooterHint text="Press Enter to copy result" />}
    </div>
  );
}

export { DateView };
