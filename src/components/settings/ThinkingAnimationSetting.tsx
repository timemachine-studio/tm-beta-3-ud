import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { THINKING_ANIMATION_OPTIONS, type ThinkingAnimationChoice } from '../../config/thinkingAnimation';
import { useTheme } from '../../context/ThemeContext';
import { ThinkingAnimationVisual } from '../chat/ThinkingAnimationVisual';
import { paletteColor } from '../../themes/seasonPalette';

const OPTION_SECTIONS = [
  { label: 'Cycles', options: THINKING_ANIMATION_OPTIONS.filter(option => option.group === 'Cycles') },
  { label: 'Individual animations', options: THINKING_ANIMATION_OPTIONS.filter(option => option.group !== 'Cycles') },
] as const;

export function ThinkingAnimationSetting() {
  const { mode, accentSeason, thinkingAnimation, setThinkingAnimation } = useTheme();
  const reducedMotion = useReducedMotion();
  const [activePreview, setActivePreview] = useState<ThinkingAnimationChoice>(thinkingAnimation);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setInterval(() => setStep(current => current + 1), 1300);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  const preview = (choice: ThinkingAnimationChoice) => {
    setActivePreview(choice);
    setStep(0);
  };
  const color = document.documentElement.dataset.healthcare === 'true'
    ? (mode === 'light' ? '#047857' : '#6ee7b7')
    : paletteColor(accentSeason, mode);

  return (
    <fieldset className="min-w-0">
      <legend className="tm-display mb-1 text-[1.625rem] italic leading-tight text-ink" style={{ fontWeight: 300 }}>Thinking animation</legend>
      <p className="mb-4 text-xs text-ink-muted">Hover, focus, or select a style to see it move.</p>
      <div className="space-y-5">
        {OPTION_SECTIONS.map(({ label, options }) => (
          <div key={label ?? 'styles'}>
            {label && <p className="mb-2 text-xs font-medium text-ink-muted">{label}</p>}
            <div className="grid grid-cols-2 gap-2.5">
              {options.map(option => {
                const selected = thinkingAnimation === option.value;
                const active = activePreview === option.value;
                const id = `thinking-animation-${option.value.replace(/:/g, '-')}`;
                return (
                  <div key={option.value} className="relative min-w-0" onMouseEnter={() => preview(option.value)} onMouseLeave={() => preview(thinkingAnimation)}>
                    <input
                      id={id}
                      type="radio"
                      name="thinking-animation"
                      value={option.value}
                      checked={selected}
                      onChange={() => { setThinkingAnimation(option.value); preview(option.value); }}
                      onFocus={() => preview(option.value)}
                      onBlur={(event) => {
                        if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node)) preview(thinkingAnimation);
                      }}
                      className="peer sr-only"
                    />
                    <label
                      htmlFor={id}
                      className="relative block min-h-[132px] cursor-pointer rounded-2xl border px-3 py-3 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
                      style={{
                        background: selected ? 'rgb(var(--tm-season-rgb) / 0.14)' : 'rgb(var(--tm-ink-rgb) / 0.035)',
                        borderColor: selected ? 'rgb(var(--tm-season-rgb) / 0.6)' : 'rgb(var(--tm-ink-rgb) / 0.12)',
                      }}
                    >
                      <span className="flex h-[76px] items-center justify-center">
                        <ThinkingAnimationVisual choice={option.value} step={active ? step : 0} color={color} theme={mode} paused={!active} preview />
                      </span>
                      <span className="mt-1 block truncate text-center text-sm font-medium text-ink">
                        {option.label}
                      </span>
                      {selected && <Check aria-hidden="true" className="absolute right-3 top-3 h-3.5 w-3.5" style={{ color }} />}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
