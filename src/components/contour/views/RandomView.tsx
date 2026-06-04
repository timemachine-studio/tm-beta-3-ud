import React, { useEffect, useState } from 'react';
import { Shuffle, RefreshCw, Copy, Check } from 'lucide-react';
import { ModuleData, MODULE_META } from '../moduleRegistry';
import { RandomResult, regenerate as regenerateRandom, QUICK_ACTIONS } from '../modules/randomGenerator';
import { AccentTheme, IconBadge, ICON_MAP } from './shared';

// ─── Random Generator View ─────────────────────────────────────

export function RandomView({ module, accent, onCopyValue }: { module: ModuleData; accent: AccentTheme; onCopyValue?: (value: string) => void }) {
  const random = module.random;
  const [current, setCurrent] = useState<RandomResult | null>(random || null);
  const [copied, setCopied] = useState(false);

  // Sync from textbox detection
  useEffect(() => {
    if (random) setCurrent(random);
  }, [random]);

  const handleRegenerate = () => {
    if (current) {
      setCurrent(regenerateRandom(current));
      setCopied(false);
    }
  };

  const handleCopy = () => {
    if (current) {
      onCopyValue?.(current.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // Focused mode with no input: show quick actions
  if (!current && module.focused) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <IconBadge icon={Shuffle} accent={accent} />
          <div className="text-white/30 text-sm">{MODULE_META.random.placeholder}</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {QUICK_ACTIONS.map(action => {
            const ActionIcon = ICON_MAP[action.icon] || Shuffle;
            return (
              <button
                key={action.id}
                onClick={() => { setCurrent(action.generate()); setCopied(false); }}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-white/[0.06] transition-colors border border-transparent hover:border-white/10"
              >
                <ActionIcon className={`w-4 h-4 ${accent.text}`} />
                <span className="text-xs text-white/50">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (!current) return null;

  // Color swatch for hex type
  const isHex = current.type === 'hex';

  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <IconBadge icon={Shuffle} accent={accent} />
        <div className="flex-1 min-w-0">
          <div className="text-white/40 text-xs font-mono mb-1">{current.label}</div>
          <div className="flex items-center gap-2">
            {isHex && (
              <div className="w-6 h-6 rounded-md flex-shrink-0 border border-white/10" style={{ background: current.value }} />
            )}
            <div className={`text-xl font-semibold tracking-tight text-white ${current.type === 'password' ? 'font-mono text-base break-all' : ''}`}>
              {current.value}
            </div>
          </div>
          {current.detail && (
            <div className="text-white/25 text-xs mt-1 font-mono">{current.detail}</div>
          )}
        </div>
      </div>

      <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRegenerate}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Regenerate
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <span className="text-[10px] text-white/20">Press Enter to copy</span>
      </div>
    </div>
  );
}
