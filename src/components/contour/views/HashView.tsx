import React, { useEffect, useRef, useState } from 'react';
import { Hash, Copy, Check } from 'lucide-react';
import { ModuleData, MODULE_META } from '../moduleRegistry';
import { HashResult, resolveHash, createHashResult } from '../modules/hashGenerator';
import { AccentTheme, IconBadge, HintView, FooterHint } from './shared';

// ─── Hash Generator View ───────────────────────────────────────

export function HashView({ module, accent, onCopyValue }: { module: ModuleData; accent: AccentTheme; onCopyValue?: (value: string) => void }) {
  const h = module.hash;
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState<HashResult | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const genRef = useRef(0);

  useEffect(() => {
    if (!hasInteracted || !inputText.trim()) return;
    const gen = ++genRef.current;
    const initial = createHashResult(inputText);
    resolveHash(initial).then(resolved => {
      if (genRef.current !== gen) return;
      setResult(resolved);
    });
  }, [inputText, hasInteracted]);

  const displayResult = hasInteracted
    ? (inputText.trim()
      ? (result?.input === inputText ? result : createHashResult(inputText))
      : null)
    : (h && !h.isPartial ? h : null);

  const handleCopy = (value: string, field: string) => {
    onCopyValue?.(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  if (!displayResult && module.focused) {
    return <HintView icon={Hash} accent={accent} text={MODULE_META.hash.placeholder} />;
  }

  if (!displayResult) return null;

  const hashes = [
    { label: 'MD5', value: displayResult.md5 },
    { label: 'SHA-1', value: displayResult.sha1 },
    { label: 'SHA-256', value: displayResult.sha256 },
    { label: 'SHA-512', value: displayResult.sha512 },
  ].filter(h => h.value);

  return (
    <div className="p-4">
      {module.focused && (
        <input
          type="text"
          value={inputText}
          onChange={e => { setHasInteracted(true); setInputText(e.target.value); }}
          placeholder="Type text to hash..."
          className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-hidden focus:border-white/25 transition-colors mb-3"
        />
      )}
      <div className="flex items-center gap-3 mb-3">
        <IconBadge icon={Hash} accent={accent} />
        <div className="flex-1 min-w-0">
          <div className="text-white/40 text-xs">Hash of &ldquo;{displayResult.input.length > 30 ? displayResult.input.slice(0, 30) + '...' : displayResult.input}&rdquo;</div>
        </div>
        {displayResult.isLoading && (
          <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin shrink-0" />
        )}
      </div>
      <div className="space-y-2">
        {hashes.map(({ label, value }) => (
          <div key={label} className="flex items-start gap-2 group">
            <span className="text-[10px] font-mono text-white/25 w-12 shrink-0 pt-0.5">{label}</span>
            <div className="flex-1 min-w-0 text-xs font-mono text-white/60 break-all leading-relaxed">{value}</div>
            <button
              onClick={() => handleCopy(value!, label)}
              className="p-1 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-white/[0.06] transition-all shrink-0"
            >
              {copiedField === label ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-white/30" />}
            </button>
          </div>
        ))}
      </div>
      {displayResult.error && <div className="text-red-400/60 text-xs mt-2">{displayResult.error}</div>}
      <FooterHint text="Hover over a hash to copy it" />
    </div>
  );
}
