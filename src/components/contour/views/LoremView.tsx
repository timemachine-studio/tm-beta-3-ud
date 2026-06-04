import React, { useEffect, useState } from 'react';
import { FileText, Copy, Check } from 'lucide-react';
import { ModuleData, MODULE_META } from '../moduleRegistry';
import { LoremResult, generateLorem } from '../modules/loremIpsum';
import { AccentTheme, IconBadge } from './shared';

// ─── Lorem Ipsum View ──────────────────────────────────────────

const LOREM_PRESETS = [
  { label: '1 paragraph', type: 'paragraphs' as const, count: 1 },
  { label: '3 paragraphs', type: 'paragraphs' as const, count: 3 },
  { label: '5 paragraphs', type: 'paragraphs' as const, count: 5 },
  { label: '5 sentences', type: 'sentences' as const, count: 5 },
  { label: '10 sentences', type: 'sentences' as const, count: 10 },
  { label: '50 words', type: 'words' as const, count: 50 },
  { label: '100 words', type: 'words' as const, count: 100 },
];

export function LoremView({ module, accent, onCopyValue }: { module: ModuleData; accent: AccentTheme; onCopyValue?: (value: string) => void }) {
  const lorem = module.lorem;
  const [current, setCurrent] = useState<LoremResult | null>(lorem && !lorem.isPartial ? lorem : null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (lorem && !lorem.isPartial) setCurrent(lorem);
  }, [lorem]);

  const handlePreset = (type: 'paragraphs' | 'sentences' | 'words', count: number) => {
    setCurrent(generateLorem(type, count));
    setCopied(false);
  };

  const handleCopy = () => {
    if (current) {
      onCopyValue?.(current.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  if (!current && module.focused) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <IconBadge icon={FileText} accent={accent} />
          <div className="text-white/30 text-sm">{MODULE_META.lorem.placeholder}</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LOREM_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => handlePreset(p.type, p.count)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-white/40 hover:text-white/60 transition-all"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <IconBadge icon={FileText} accent={accent} />
        <div className="flex-1 min-w-0">
          <div className="text-white/40 text-xs mb-1">{current.wordCount} words, {current.paragraphCount} paragraph{current.paragraphCount !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <div className="max-h-[140px] overflow-y-auto rounded-lg p-3 text-white/70 text-xs leading-relaxed font-mono [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        {current.text.split('\n\n').map((p, i) => (
          <p key={i} className={i > 0 ? 'mt-2' : ''}>{p}</p>
        ))}
      </div>
      {module.focused && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {LOREM_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => handlePreset(p.type, p.count)}
              className="px-2 py-0.5 rounded-md text-[10px] font-medium text-white/35 hover:text-white/55 transition-all"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <span className="text-[10px] text-white/20">Press Enter to copy</span>
      </div>
    </div>
  );
}
