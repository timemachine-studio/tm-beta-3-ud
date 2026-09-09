import React, { useEffect, useRef, useState } from 'react';
import { Globe, ArrowLeftRight, Copy, Check } from 'lucide-react';
import { ModuleData } from '../moduleRegistry';
import {
  resolveTranslation, translateDirect,
  getLanguageList, POPULAR_LANGUAGES, getLanguageName,
  TranslationResult,
} from '../modules/translator';
import { AccentTheme, IconBadge, FooterHint, SELECT_ARROW } from './shared';

const ALL_LANGUAGES = getLanguageList();

function TranslatorInteractive({ trans, accent, onCopyValue }: { trans?: TranslationResult; accent: AccentTheme; onCopyValue?: (value: string) => void }) {
  const [localFromCode, setFromCode] = useState('en');
  const [localToCode, setToCode] = useState('bn');
  const [localInputText, setInputText] = useState('');
  const [resolvedResult, setResolvedResult] = useState<TranslationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const genRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const useDetection = !hasInteracted && trans && !trans.isPartial && trans.translatedText;
  const fromCode = useDetection && trans.sourceLangCode !== 'auto' ? trans.sourceLangCode : localFromCode;
  const toCode = useDetection ? trans.targetLangCode : localToCode;
  const inputText = useDetection ? trans.sourceText : localInputText;

  // Debounced translation when inputs change
  useEffect(() => {
    if (!hasInteracted || !inputText.trim()) return;
    const timer = setTimeout(() => {
      const gen = ++genRef.current;
      const req = translateDirect(inputText.trim(), fromCode, toCode);
      resolveTranslation(req).then(resolved => {
        if (genRef.current !== gen) return;
        setResolvedResult(resolved);
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [inputText, fromCode, toCode, hasInteracted]);

  const result = useDetection
    ? trans
    : resolvedResult?.sourceText === inputText.trim() &&
        resolvedResult.sourceLangCode === fromCode && resolvedResult.targetLangCode === toCode
      ? resolvedResult
      : null;
  const isLoading = hasInteracted && Boolean(inputText.trim()) && !result;

  const handleSwap = () => {
    setHasInteracted(true);
    const tmp = fromCode;
    setFromCode(toCode);
    setToCode(tmp);
    if (result?.translatedText) {
      setInputText(result.translatedText);
    }
  };

  const handleCopy = () => {
    if (result?.translatedText) {
      onCopyValue?.(result.translatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const selectStyle = {
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundImage: SELECT_ARROW,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    backgroundSize: '10px',
  };

  return (
    <div className="p-4">
      {/* Language selectors */}
      <div className="flex items-center gap-2 mb-3">
        <select
          value={fromCode}
          onChange={e => { setHasInteracted(true); setFromCode(e.target.value); }}
          className="flex-1 rounded-lg px-3 py-2 text-white text-xs appearance-none focus:outline-hidden focus:border-white/25 transition-colors pr-6"
          style={selectStyle}
        >
          {POPULAR_LANGUAGES.map(code => (
            <option key={code} value={code}>{getLanguageName(code)}</option>
          ))}
          <option disabled>───</option>
          {ALL_LANGUAGES.filter(l => !POPULAR_LANGUAGES.includes(l.code)).map(l => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </select>

        <button
          onClick={handleSwap}
          className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors shrink-0"
          title="Swap languages"
        >
          <ArrowLeftRight className={`w-4 h-4 ${accent.text}`} />
        </button>

        <select
          value={toCode}
          onChange={e => { setHasInteracted(true); setToCode(e.target.value); }}
          className="flex-1 rounded-lg px-3 py-2 text-white text-xs appearance-none focus:outline-hidden focus:border-white/25 transition-colors pr-6"
          style={selectStyle}
        >
          {POPULAR_LANGUAGES.map(code => (
            <option key={code} value={code}>{getLanguageName(code)}</option>
          ))}
          <option disabled>───</option>
          {ALL_LANGUAGES.filter(l => !POPULAR_LANGUAGES.includes(l.code)).map(l => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </select>
      </div>

      {/* Text input */}
      <input
        ref={inputRef}
        type="text"
        value={inputText}
        onChange={e => { setHasInteracted(true); setInputText(e.target.value); }}
        placeholder="Type text to translate..."
        className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-hidden focus:border-white/25 transition-colors mb-3"
      />

      {/* Result */}
      {isLoading ? (
        <div className="flex items-center gap-2 py-2">
          <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          <span className="text-white/40 text-sm">Translating...</span>
        </div>
      ) : result?.translatedText ? (
        <div className="py-2">
          <div className="text-lg font-semibold text-white">{result.translatedText}</div>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      ) : result?.error ? (
        <div className="text-red-400/60 text-sm py-2">{result.error}</div>
      ) : !inputText.trim() ? (
        <div className="text-white/20 text-xs py-2">Type text above to translate</div>
      ) : null}

      <FooterHint text="Type or paste text, pick languages, get instant translation" />
    </div>
  );
}

export function TranslatorView({ module, accent, onCopyValue }: { module: ModuleData; accent: AccentTheme; onCopyValue?: (value: string) => void }) {
  const trans = module.translator;

  if (!module.focused) {
    // Auto-detect mode: simple display
    if (!trans) return null;
    return (
      <div className="p-4">
        <div className="flex items-center gap-3">
          <IconBadge icon={Globe} accent={accent} />
          <div className="flex-1 min-w-0">
            <div className="text-white/40 text-xs mb-1">
              {trans.sourceLang !== 'Auto' ? trans.sourceLang : 'English'} → {trans.targetLang}
            </div>
            {trans.isLoading ? (
              <div className="flex items-center gap-2">
                <div className="text-white/50 text-lg">Translating...</div>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              </div>
            ) : trans.error ? (
              <div className="text-red-400/60 text-sm">{trans.error}</div>
            ) : (
              <div className="text-xl font-semibold tracking-tight text-white">
                {trans.translatedText}
              </div>
            )}
            <div className="text-white/25 text-xs mt-1">&ldquo;{trans.sourceText}&rdquo;</div>
          </div>
        </div>
        {!trans.isLoading && trans.translatedText && (
          <FooterHint text="Press Enter to copy translation" />
        )}
      </div>
    );
  }

  // Focused mode: interactive UI
  return <TranslatorInteractive trans={trans} accent={accent} onCopyValue={onCopyValue} />;
}
