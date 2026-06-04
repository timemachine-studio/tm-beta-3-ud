import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Play, Copy, Check } from 'lucide-react';
import { ModuleData } from '../moduleRegistry';
import { DictionaryResult, resolveDictionary, lookupWord } from '../modules/dictionary';
import { AccentTheme, IconBadge, FooterHint } from './shared';

// ─── Dictionary View ───────────────────────────────────────────

function DictionaryView({ module, accent, onCopyValue }: { module: ModuleData; accent: AccentTheme; onCopyValue?: (value: string) => void }) {
  const dict = module.dictionary;

  if (!module.focused) {
    // Auto-detect mode: simple display
    if (!dict) return null;
    return (
      <div className="p-4">
        <div className="flex items-center gap-3">
          <IconBadge icon={BookOpen} accent={accent} />
          <div className="flex-1 min-w-0">
            {dict.isLoading ? (
              <div className="flex items-center gap-2">
                <div className="text-white/50 text-lg">Looking up &ldquo;{dict.word}&rdquo;...</div>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              </div>
            ) : dict.error ? (
              <div className="text-red-400/60 text-sm">{dict.error}</div>
            ) : (
              <>
                <DictHeader dict={dict} accent={accent} />
                <DictMeanings dict={dict} accent={accent} compact />
              </>
            )}
          </div>
        </div>
        {!dict.isLoading && dict.meanings.length > 0 && (
          <FooterHint text="Press Enter to copy definition" />
        )}
      </div>
    );
  }

  // Focused mode: interactive lookup
  return <DictionaryInteractive dict={dict} accent={accent} onCopyValue={onCopyValue} />;
}

function DictHeader({ dict, accent }: { dict: DictionaryResult; accent: AccentTheme }) {
  const handlePlayAudio = () => {
    if (dict.phoneticAudio) {
      const audio = new Audio(dict.phoneticAudio);
      audio.play().catch(() => {});
    }
  };

  return (
    <div className="flex items-baseline gap-2 mb-1">
      <span className="text-white text-lg font-semibold capitalize">{dict.word}</span>
      {dict.phonetic && (
        <span className="text-white/30 text-xs font-mono">{dict.phonetic}</span>
      )}
      {dict.phoneticAudio && (
        <button
          onClick={handlePlayAudio}
          className="p-0.5 hover:bg-white/10 rounded transition-colors"
          title="Play pronunciation"
        >
          <Play className={`w-3.5 h-3.5 ${accent.text}`} />
        </button>
      )}
    </div>
  );
}

function DictMeanings({ dict, accent, compact }: { dict: DictionaryResult; accent: AccentTheme; compact?: boolean }) {
  const maxMeanings = compact ? 2 : dict.meanings.length;
  const maxDefs = compact ? 1 : 3;

  return (
    <div className="space-y-2">
      {dict.meanings.slice(0, maxMeanings).map((meaning, i) => (
        <div key={i}>
          <span
            className="text-[10px] font-medium tracking-wider uppercase px-1.5 py-0.5 rounded"
            style={{ background: accent.bg, color: accent.solid }}
          >
            {meaning.partOfSpeech}
          </span>
          <div className="mt-1 space-y-1">
            {meaning.definitions.slice(0, maxDefs).map((def, j) => (
              <div key={j}>
                <div className="text-white/80 text-sm">{def.definition}</div>
                {def.example && !compact && (
                  <div className="text-white/30 text-xs italic ml-3 mt-0.5">&ldquo;{def.example}&rdquo;</div>
                )}
              </div>
            ))}
          </div>
          {!compact && meaning.synonyms.length > 0 && (
            <div className="mt-1 flex items-center gap-1 flex-wrap">
              <span className="text-white/25 text-[10px]">Synonyms:</span>
              {meaning.synonyms.map((s, k) => (
                <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/40">{s}</span>
              ))}
            </div>
          )}
          {!compact && meaning.antonyms.length > 0 && (
            <div className="mt-1 flex items-center gap-1 flex-wrap">
              <span className="text-white/25 text-[10px]">Antonyms:</span>
              {meaning.antonyms.map((s, k) => (
                <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/40">{s}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DictionaryInteractive({ dict, accent, onCopyValue }: { dict?: DictionaryResult; accent: AccentTheme; onCopyValue?: (value: string) => void }) {
  const [inputWord, setInputWord] = useState('');
  const [result, setResult] = useState<DictionaryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const genRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from auto-detect
  useEffect(() => {
    if (hasInteracted || !dict) return;
    if (!dict.isLoading && dict.meanings.length > 0) {
      setResult(dict);
      setInputWord(dict.word);
    }
  }, [dict, hasInteracted]);

  // Debounced lookup
  useEffect(() => {
    if (!hasInteracted) return;
    const word = inputWord.trim();
    if (!word || word.length < 2) { setResult(null); setIsLoading(false); return; }

    setIsLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const gen = ++genRef.current;
      const req = lookupWord(word);
      resolveDictionary(req).then(resolved => {
        if (genRef.current !== gen) return;
        setResult(resolved);
        setIsLoading(false);
      });
    }, 600);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [inputWord, hasInteracted]);

  const handleCopy = () => {
    if (result && result.meanings.length > 0) {
      const text = result.meanings.map(m =>
        `${m.partOfSpeech}: ${m.definitions.map(d => d.definition).join('; ')}`
      ).join('\n');
      onCopyValue?.(`${result.word} — ${text}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="p-4">
      {/* Word input */}
      <div className="flex items-center gap-2 mb-3">
        <IconBadge icon={BookOpen} accent={accent} />
        <input
          ref={inputRef}
          type="text"
          value={inputWord}
          onChange={e => { setHasInteracted(true); setInputWord(e.target.value); }}
          placeholder="Type a word to look up..."
          className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-colors"
        />
      </div>

      {/* Result */}
      {isLoading ? (
        <div className="flex items-center gap-2 py-3">
          <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          <span className="text-white/40 text-sm">Looking up...</span>
        </div>
      ) : result ? (
        result.error ? (
          <div className="text-red-400/60 text-sm py-2">{result.error}</div>
        ) : result.meanings.length > 0 ? (
          <div>
            <DictHeader dict={result} accent={accent} />
            <DictMeanings dict={result} accent={accent} />
            <div className="mt-3 pt-2 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy definition'}
              </button>
            </div>
          </div>
        ) : null
      ) : !inputWord.trim() ? (
        <div className="text-white/20 text-xs py-2">Type a word above to see its definition</div>
      ) : null}

      <FooterHint text="Type a word to see definitions, pronunciation, synonyms & antonyms" />
    </div>
  );
}

export { DictionaryView };
