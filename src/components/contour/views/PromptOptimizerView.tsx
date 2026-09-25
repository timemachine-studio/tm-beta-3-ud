import { useEffect, useRef, useState } from 'react';
import { Check, Copy, CornerDownLeft, Loader2, WandSparkles, X } from 'lucide-react';
import {
  MAX_PROMPT_LENGTH,
  optimizePrompt,
  type PromptOptimizerModel,
} from '../../../services/ai/promptOptimizer';

const MODELS: { key: PromptOptimizerModel; label: string; hue: string }[] = [
  { key: 'default', label: 'Air', hue: '168 85 247' },
  { key: 'girlie', label: 'Girlie', hue: '236 72 153' },
  { key: 'pro', label: 'PRO', hue: '34 211 238' },
];

interface PromptOptimizerViewProps {
  initialPersona: string;
  onUsePrompt?: (value: string) => void;
}

export function PromptOptimizerView({ initialPersona, onUsePrompt }: PromptOptimizerViewProps) {
  const [model, setModel] = useState<PromptOptimizerModel>(() =>
    initialPersona === 'girlie' || initialPersona === 'pro' ? initialPersona : 'default',
  );
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const viewRef = useRef<HTMLDivElement | null>(null);
  const scrollToResultRef = useRef(false);
  const requestRef = useRef(0);
  const modelHue = MODELS.find((option) => option.key === model)?.hue ?? MODELS[0].hue;

  useEffect(() => () => {
    requestRef.current += 1;
    abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!result || !scrollToResultRef.current) return;
    scrollToResultRef.current = false;
    const scrollContainer = viewRef.current?.parentElement;
    if (scrollContainer) scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
  }, [result]);

  const invalidateResult = () => {
    requestRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setResult('');
    setError('');
    setCopied(false);
  };

  const handleOptimize = async () => {
    if (!prompt.trim() || loading) return;
    const requestId = ++requestRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');
    setCopied(false);

    try {
      const improved = await optimizePrompt(prompt, model, controller.signal);
      if (requestId === requestRef.current && !controller.signal.aborted) {
        scrollToResultRef.current = true;
        setResult(improved);
      }
    } catch (cause) {
      if (requestId === requestRef.current && !controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Could not optimize the prompt. Try again.');
      }
    } finally {
      if (requestId === requestRef.current) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.trim());
      setCopied(true);
      setError('');
    } catch {
      setError('Could not copy the prompt. Select and copy the text above.');
    }
  };

  return (
    <div ref={viewRef} className="space-y-4 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border" style={{ color: `rgb(${modelHue})`, borderColor: `rgb(${modelHue} / 0.36)`, background: `rgb(${modelHue} / 0.12)` }}>
          <WandSparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">Make your prompt clearer</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">Keep your intent, sharpen the ask. Review the result before sending.</p>
        </div>
      </div>

      <div role="group" aria-label="Choose an optimization model" className="grid grid-cols-3 gap-1.5">
        {MODELS.map((option) => {
          const selected = option.key === model;
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={selected}
              onClick={() => { if (option.key !== model) { invalidateResult(); setModel(option.key); } }}
              className="flex min-h-10 items-center justify-center gap-2 rounded-xl border px-2 text-sm font-medium transition-colors"
              style={{
                borderColor: selected ? `rgb(${option.hue} / 0.48)` : 'rgb(var(--tm-ink-rgb) / 0.12)',
                background: selected ? `rgb(${option.hue} / 0.16)` : 'rgb(var(--tm-ink-rgb) / 0.035)',
                color: selected ? `rgb(${option.hue})` : 'rgb(var(--tm-ink-rgb) / 0.72)',
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: `rgb(${option.hue})` }} aria-hidden="true" />
              {option.label}
            </button>
          );
        })}
      </div>

      <div>
        <label htmlFor="contour-prompt-original" className="mb-1.5 block text-xs font-medium text-ink-muted">Your prompt</label>
        <textarea
          id="contour-prompt-original"
          value={prompt}
          onChange={(event) => { invalidateResult(); setPrompt(event.target.value); }}
          placeholder="What would you like the AI to do?"
          maxLength={MAX_PROMPT_LENGTH + 1}
          rows={3}
          className="w-full resize-y rounded-xl border p-3 text-ink outline-none placeholder:text-ink-muted focus-visible:ring-2"
          style={{ background: 'rgb(var(--tm-paper-rgb) / 0.48)', borderColor: 'rgb(var(--tm-ink-rgb) / 0.16)', caretColor: `rgb(${modelHue})` }}
        />
        {prompt.length > MAX_PROMPT_LENGTH && <p role="alert" className="mt-1 text-xs text-red-400">Keep the prompt under {MAX_PROMPT_LENGTH.toLocaleString()} characters.</p>}
      </div>

      {loading ? (
        <button type="button" onClick={invalidateResult} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border text-sm font-medium text-ink" style={{ borderColor: 'rgb(var(--tm-ink-rgb) / 0.2)' }}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Optimizing · Stop
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : (
        <button type="button" onClick={() => { void handleOptimize(); }} disabled={!prompt.trim() || prompt.trim().length > MAX_PROMPT_LENGTH} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40" style={{ background: `rgb(${modelHue})`, color: '#0a0810' }}>
          <WandSparkles className="h-4 w-4" aria-hidden="true" />
          Optimize prompt
        </button>
      )}

      {error && <p role="alert" className="text-xs leading-relaxed text-red-400">{error}</p>}

      {result && (
        <div className="space-y-2 border-t pt-4" style={{ borderColor: 'rgb(var(--tm-ink-rgb) / 0.1)' }}>
          <label htmlFor="contour-prompt-result" className="block text-xs font-medium text-ink-muted">Optimized prompt · editable</label>
          <textarea
            id="contour-prompt-result"
            value={result}
            onChange={(event) => { setResult(event.target.value); setCopied(false); }}
            rows={5}
            className="w-full resize-y rounded-xl border p-3 text-ink outline-none focus-visible:ring-2"
            style={{ background: `rgb(${modelHue} / 0.07)`, borderColor: `rgb(${modelHue} / 0.27)` }}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { void handleCopy(); }} disabled={!result.trim()} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium text-ink disabled:opacity-40" style={{ borderColor: 'rgb(var(--tm-ink-rgb) / 0.18)' }}>
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" onClick={() => onUsePrompt?.(result.trim())} disabled={!result.trim() || !onUsePrompt} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-40" style={{ background: `rgb(${modelHue})`, color: '#0a0810' }}>
              <CornerDownLeft className="h-4 w-4" aria-hidden="true" />
              Use in chat
            </button>
          </div>
          {copied && <span role="status" className="sr-only">Optimized prompt copied</span>}
        </div>
      )}
    </div>
  );
}
