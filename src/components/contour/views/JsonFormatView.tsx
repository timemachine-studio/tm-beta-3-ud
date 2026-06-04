import React, { useEffect, useState } from 'react';
import { Braces, Copy, Check } from 'lucide-react';
import { ModuleData, MODULE_META } from '../moduleRegistry';
import { JsonFormatResult, formatJson } from '../modules/jsonFormatter';
import { AccentTheme, IconBadge, HintView } from './shared';

// ─── JSON Formatter View ───────────────────────────────────────

export function JsonFormatView({ module, accent, onCopyValue }: { module: ModuleData; accent: AccentTheme; onCopyValue?: (value: string) => void }) {
  const json = module.jsonFormat;
  const [showMinified, setShowMinified] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState<JsonFormatResult | null>(json && !json.isPartial ? json : null);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    if (!hasInteracted && json && !json.isPartial) setResult(json);
  }, [json, hasInteracted]);

  useEffect(() => {
    if (!hasInteracted || !inputText.trim()) { if (hasInteracted) setResult(null); return; }
    setResult(formatJson(inputText));
  }, [inputText, hasInteracted]);

  const handleCopy = () => {
    if (result && result.isValid) {
      onCopyValue?.(showMinified ? result.minified : result.formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  if (!result && module.focused) {
    return <HintView icon={Braces} accent={accent} text={MODULE_META['json-format'].placeholder} />;
  }

  const displayResult = result || json;
  if (!displayResult || displayResult.isPartial) return null;

  const output = showMinified ? displayResult.minified : displayResult.formatted;

  return (
    <div className="p-4">
      {module.focused && (
        <textarea
          value={inputText}
          onChange={e => { setHasInteracted(true); setInputText(e.target.value); }}
          placeholder="Paste JSON here..."
          className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-colors mb-3 resize-none"
          rows={3}
        />
      )}
      <div className="flex items-center gap-2 mb-2">
        <IconBadge icon={Braces} accent={accent} />
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${displayResult.isValid ? 'text-green-400/80' : 'text-red-400/80'}`}>
            {displayResult.isValid ? 'Valid JSON' : 'Invalid JSON'}
          </div>
          {displayResult.isValid && (
            <div className="text-white/30 text-xs">{displayResult.keyCount} keys, depth {displayResult.depth}</div>
          )}
          {displayResult.error && (
            <div className="text-red-400/60 text-xs">{displayResult.error}</div>
          )}
        </div>
      </div>
      {displayResult.isValid && (
        <>
          <div className="flex gap-1.5 mb-2">
            <button
              onClick={() => setShowMinified(false)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${!showMinified ? 'text-white' : 'text-white/35'}`}
              style={!showMinified ? { background: accent.bg, border: `1px solid ${accent.border}` } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              Formatted
            </button>
            <button
              onClick={() => setShowMinified(true)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${showMinified ? 'text-white' : 'text-white/35'}`}
              style={showMinified ? { background: accent.bg, border: `1px solid ${accent.border}` } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              Minified
            </button>
          </div>
          <div className="max-h-[140px] overflow-y-auto rounded-lg p-3 text-white/70 text-xs font-mono leading-relaxed [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 whitespace-pre-wrap break-all"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {output}
          </div>
        </>
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
