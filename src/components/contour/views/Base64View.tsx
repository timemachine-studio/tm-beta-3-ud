import React, { useState } from 'react';
import { Lock, Copy, Check } from 'lucide-react';
import { ModuleData, MODULE_META } from '../moduleRegistry';
import { Base64Result, processBase64 } from '../modules/base64Codec';
import { AccentTheme, IconBadge } from './shared';

function Base64View({ module, accent, onCopyValue }: { module: ModuleData; accent: AccentTheme; onCopyValue?: (value: string) => void }) {
  const b64 = module.base64;
  const [mode, setMode] = useState<'encode' | 'decode'>(b64?.mode || 'encode');
  const [inputText, setInputText] = useState('');
  const [copied, setCopied] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const activeMode = hasInteracted ? mode : b64?.mode ?? mode;
  const result: Base64Result | null = hasInteracted
    ? (inputText.trim() ? processBase64(inputText, activeMode) : null)
    : (b64 && !b64.isPartial ? b64 : null);

  const output = result ? (activeMode === 'encode' ? result.encoded : result.decoded) : '';

  const handleCopy = () => {
    if (output) {
      onCopyValue?.(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  if (!result && module.focused) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <IconBadge icon={Lock} accent={accent} />
          <div className="text-white/30 text-sm">{MODULE_META.base64.placeholder}</div>
        </div>
        <div className="flex gap-1.5 mb-3">
          <button onClick={() => { setHasInteracted(true); setMode('encode'); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${activeMode === 'encode' ? 'text-white' : 'text-white/40'}`}
            style={activeMode === 'encode' ? { background: accent.bg, border: `1px solid ${accent.border}` } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >Encode</button>
          <button onClick={() => { setHasInteracted(true); setMode('decode'); }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${activeMode === 'decode' ? 'text-white' : 'text-white/40'}`}
            style={activeMode === 'decode' ? { background: accent.bg, border: `1px solid ${accent.border}` } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >Decode</button>
        </div>
        <input
          type="text"
          value={inputText}
          onChange={e => { setHasInteracted(true); setInputText(e.target.value); }}
          placeholder={activeMode === 'encode' ? 'Type text to encode...' : 'Paste Base64 to decode...'}
          className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder:text-white/20 focus:outline-hidden focus:border-white/25 transition-colors"
        />
      </div>
    );
  }

  return (
    <div className="p-4">
      {module.focused && (
        <>
          <div className="flex gap-1.5 mb-3">
            <button onClick={() => { setHasInteracted(true); setMode('encode'); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${activeMode === 'encode' ? 'text-white' : 'text-white/40'}`}
              style={activeMode === 'encode' ? { background: accent.bg, border: `1px solid ${accent.border}` } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >Encode</button>
            <button onClick={() => { setHasInteracted(true); setMode('decode'); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${activeMode === 'decode' ? 'text-white' : 'text-white/40'}`}
              style={activeMode === 'decode' ? { background: accent.bg, border: `1px solid ${accent.border}` } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >Decode</button>
          </div>
          <input
            type="text"
            value={inputText}
            onChange={e => { setHasInteracted(true); setInputText(e.target.value); }}
            placeholder={activeMode === 'encode' ? 'Type text to encode...' : 'Paste Base64 to decode...'}
            className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder:text-white/20 focus:outline-hidden focus:border-white/25 transition-colors mb-3"
          />
        </>
      )}
      <div className="flex items-center gap-3">
        <IconBadge icon={Lock} accent={accent} />
        <div className="flex-1 min-w-0">
          <div className="text-white/40 text-xs mb-1">{activeMode === 'encode' ? 'Encoded' : 'Decoded'}</div>
          <div className="text-sm font-mono text-white break-all">{output}</div>
          {result?.error && <div className="text-red-400/60 text-xs mt-1">{result.error}</div>}
        </div>
      </div>
      <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={handleCopy}
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

export { Base64View };
