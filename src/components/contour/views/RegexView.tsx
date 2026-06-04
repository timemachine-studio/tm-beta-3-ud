import React, { useEffect, useState } from 'react';
import { FileSearch, Copy, Check } from 'lucide-react';
import { ModuleData, MODULE_META } from '../moduleRegistry';
import { RegexResult, testRegex, REGEX_FLAGS, REGEX_PRESETS } from '../modules/regexTester';
import { AccentTheme, IconBadge } from './shared';

// ─── Regex Tester View ─────────────────────────────────────────

function RegexView({ module, accent, onCopyValue }: { module: ModuleData; accent: AccentTheme; onCopyValue?: (value: string) => void }) {
  const rx = module.regex;
  const [pattern, setPattern] = useState('');
  const [testStr, setTestStr] = useState('');
  const [flags, setFlags] = useState('gi');
  const [result, setResult] = useState<RegexResult | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!hasInteracted && rx && !rx.isPartial) {
      setResult(rx);
      setPattern(rx.pattern);
      setTestStr(rx.testString);
      setFlags(rx.flags);
    }
  }, [rx, hasInteracted]);

  useEffect(() => {
    if (!hasInteracted) return;
    if (!pattern.trim()) { setResult(null); return; }
    setResult(testRegex(pattern, testStr, flags));
  }, [pattern, testStr, flags, hasInteracted]);

  const toggleFlag = (flag: string) => {
    setHasInteracted(true);
    setFlags(prev => prev.includes(flag) ? prev.replace(flag, '') : prev + flag);
  };

  const handlePreset = (preset: typeof REGEX_PRESETS[number]) => {
    setHasInteracted(true);
    setPattern(preset.pattern);
    setTestStr(preset.test);
  };

  const handleCopy = () => {
    if (result) {
      onCopyValue?.(`/${result.pattern}/${result.flags}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  if (!result && module.focused) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <IconBadge icon={FileSearch} accent={accent} />
          <div className="text-white/30 text-sm">{MODULE_META.regex.placeholder}</div>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {REGEX_PRESETS.map(p => (
            <button
              key={p.name}
              onClick={() => handlePreset(p)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-white/40 hover:text-white/60 transition-all"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {p.name}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={pattern}
          onChange={e => { setHasInteracted(true); setPattern(e.target.value); }}
          placeholder="Enter regex pattern..."
          className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-colors"
        />
      </div>
    );
  }

  return (
    <div className="p-4">
      {module.focused && (
        <>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {REGEX_PRESETS.map(p => (
              <button
                key={p.name}
                onClick={() => handlePreset(p)}
                className="px-2 py-0.5 rounded-md text-[10px] font-medium text-white/35 hover:text-white/55 transition-all"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                {p.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-white/20 text-xs font-mono">/</span>
            <input
              type="text"
              value={pattern}
              onChange={e => { setHasInteracted(true); setPattern(e.target.value); }}
              placeholder="pattern"
              className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs font-mono placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-colors"
            />
            <span className="text-white/20 text-xs font-mono">/</span>
            <div className="flex gap-0.5">
              {REGEX_FLAGS.map(f => (
                <button
                  key={f.flag}
                  onClick={() => toggleFlag(f.flag)}
                  className={`w-6 h-6 rounded text-[11px] font-mono font-medium transition-all ${flags.includes(f.flag) ? 'text-white' : 'text-white/25'}`}
                  style={flags.includes(f.flag) ? { background: accent.bg, border: `1px solid ${accent.border}` } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  title={f.description}
                >
                  {f.flag}
                </button>
              ))}
            </div>
          </div>
          <input
            type="text"
            value={testStr}
            onChange={e => { setHasInteracted(true); setTestStr(e.target.value); }}
            placeholder="Test string..."
            className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-colors mb-3"
          />
        </>
      )}

      <div className="flex items-center gap-3 mb-2">
        <IconBadge icon={FileSearch} accent={accent} />
        <div className="flex-1 min-w-0">
          {result?.isValid === false ? (
            <div className="text-red-400/80 text-sm">{result.error}</div>
          ) : (
            <div className="text-white text-sm font-medium">
              {result?.matchCount ?? 0} match{(result?.matchCount ?? 0) !== 1 ? 'es' : ''}
            </div>
          )}
          {result?.isValid && result.pattern && (
            <div className="text-white/30 text-xs font-mono">/{result.pattern}/{result.flags}</div>
          )}
        </div>
      </div>

      {result?.isValid && result.matches.length > 0 && (
        <div className="space-y-1 max-h-[80px] overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10">
          {result.matches.slice(0, 10).map((m, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="text-white/20 font-mono w-4 text-right">{i + 1}</span>
              <span className={`font-mono px-1.5 py-0.5 rounded ${accent.text}`}
                style={{ background: accent.bg, border: `1px solid ${accent.border}` }}
              >
                {m.match}
              </span>
              <span className="text-white/20 font-mono">@{m.index}</span>
            </div>
          ))}
          {result.matches.length > 10 && (
            <div className="text-white/20 text-[10px] pl-6">...and {result.matches.length - 10} more</div>
          )}
        </div>
      )}

      <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy regex'}
        </button>
        <span className="text-[10px] text-white/20">Press Enter to copy</span>
      </div>
    </div>
  );
}

export { RegexView };
