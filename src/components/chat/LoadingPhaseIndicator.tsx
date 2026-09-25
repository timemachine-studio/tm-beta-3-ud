import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { LoadingPhase } from '../../types/chat';
import { AI_PERSONAS } from '../../config/constants';
import { useTheme } from '../../context/ThemeContext';
import { AnimatedShinyText } from '../ui/AnimatedShinyText';
import { loadingLabel } from './loadingLabel';
import { ThinkingAnimationVisual } from './ThinkingAnimationVisual';
import { paletteColor } from '../../themes/seasonPalette';

const INITIAL_LOADING_PHASE = 'Understanding your request';
const REASONING_WORDS = [
  'Balling', 'Mogging', 'Slaying', 'Flexing', 'Catfishing', 'Skibidying',
  'Larping', 'Streaming', 'Ragebaiting', 'Trolling', 'Glazing', 'Capping',
  'Yapping', 'Gaslighting', 'Gatekeeping', 'Bitching', 'Spilling (the tea)',
  'Cancelling', 'Exposing', 'Snitching', 'Manifesting', 'Crashing out',
  'Deluluing', 'Cringing', 'Tweaking', 'Geeking', 'Seething', 'Tripping',
  'Wilding', 'Simping', 'Ghosting', 'Shipping', 'Cooking', 'Clutching',
  'Aura Farming', 'Side-eying', 'Clocking it', 'Coping', 'Down-badding',
  'Locking in', 'Peak-fictioing', 'Looksmaxxing', 'Brainrotting', 'Stalking',
  'Uncing', 'Face-palming', 'Larping',
] as const;
const STEP_MS = 3000;
interface LoadingPhaseIndicatorProps {
  phase: LoadingPhase | undefined;
  persona: keyof typeof AI_PERSONAS;
  baseColor: string;
  shimmerColor: string;
  compact?: boolean;
  healthcare?: boolean;
}

function ReasoningOrbStatus({ compact, phase, healthcare }: Pick<LoadingPhaseIndicatorProps, 'compact' | 'phase' | 'healthcare'>) {
  const [step, setStep] = useState(0);
  const { mode, accentSeason, thinkingAnimation } = useTheme();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const timer = window.setInterval(() => setStep(index => index + 1), STEP_MS);
    return () => window.clearInterval(timer);
  }, []);

  const isReasoning = !phase || phase === 'thinking' || phase === INITIAL_LOADING_PHASE;
  const word = isReasoning ? REASONING_WORDS[step % REASONING_WORDS.length] : loadingLabel(phase);
  const color = paletteColor(accentSeason, mode, healthcare);

  return (
    <div
      role="status"
      aria-label={isReasoning ? 'Generating a response' : word}
      className={`inline-flex min-w-0 items-center ${compact ? 'justify-start gap-2 py-0.5' : 'justify-center gap-2 py-1'}`}
      style={{ fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif', fontSize: compact ? 15 : 16 }}
    >
      <ThinkingAnimationVisual choice={thinkingAnimation} step={step} color={color} theme={mode} />
      <span aria-hidden="true" className={`${compact ? 'min-w-0 truncate' : 'min-w-[19ch]'} whitespace-nowrap text-left font-medium`} style={{ color, opacity: compact ? 0.85 : 1 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={word}
            initial={reducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: reducedMotion ? 0 : 0.24, ease: 'easeInOut' }}
            className="inline-block"
          >
            {word}
          </motion.span>
        </AnimatePresence>
      </span>
    </div>
  );
}

export function LoadingPhaseIndicator({ phase, baseColor, shimmerColor, compact = false, healthcare = false }: LoadingPhaseIndicatorProps) {
  if (compact || !phase || phase === 'thinking' || phase === INITIAL_LOADING_PHASE) {
    return <ReasoningOrbStatus compact={compact} phase={phase} healthcare={healthcare} />;
  }

  return (
    <AnimatedShinyText
      text={loadingLabel(phase)}
      useShimmer={true}
      baseColor={baseColor}
      shimmerColor={shimmerColor}
      gradientAnimationDuration={2}
      textClassName={compact ? 'text-sm' : 'text-base'}
      className={compact ? 'py-0.5' : 'py-1'}
      style={{
        fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: compact ? '14px' : '16px',
      }}
    />
  );
}
