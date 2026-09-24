import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { LoadingPhase } from '../../types/chat';
import { AnimatedShinyText } from '../ui/AnimatedShinyText';
import { SymmetricWave } from '../ui/symmetric-wave';
import { TextShimmer } from '../ui/TextShimmer';
import { loadingLabel } from './loadingLabel';

const INITIAL_LOADING_PHASE = 'Understanding your request';

const PLAYFUL_WORDS = [
  'Cooking',
  'Manifesting',
  'Manipulating',
  'Ragebaiting',
  'Tweaking',
  'Overtweaking',
  'Cringing',
  'Looksmaxxing',
  'Moonwalking',
  'Levitating',
  'Singing',
  'Dancing',
  'Gooning',
  'Overdosing',
  'Sleeping',
  'Procrastinating',
  'Catfishing',
  'Catastrophizing',
] as const;

function shuffledWords(): string[] {
  const words = [...PLAYFUL_WORDS];
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  return words;
}

interface LoadingPhaseIndicatorProps {
  phase: LoadingPhase | undefined;
  baseColor: string;
  shimmerColor: string;
  compact?: boolean;
}

function PlayfulLoadingStatus({ baseColor, shimmerColor, compact }: Omit<LoadingPhaseIndicatorProps, 'phase'>) {
  const [words] = useState(shuffledWords);
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    // Once the shuffled list is exhausted, keep its last word. A request
    // never repeats a word, even if it remains loading unusually long.
    if (wordIndex === words.length - 1) return;
    const timer = window.setTimeout(() => {
      setWordIndex(index => index + 1);
    }, 2500 + Math.random() * 1500);
    return () => window.clearTimeout(timer);
  }, [wordIndex, words]);

  return (
    <div
      role="status"
      aria-label="Generating a response"
      className={`flex items-center justify-center gap-2 ${compact ? 'py-0.5' : 'py-1'}`}
      style={{ fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif', fontSize: compact ? 14 : 16 }}
    >
      <SymmetricWave aria-hidden="true" className={compact ? 'text-sm' : 'text-base'} style={{ color: baseColor }} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={words[wordIndex]}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.28, ease: 'easeInOut' }}
          className="inline-flex"
        >
          <TextShimmer className="font-medium" duration={3.2} baseColor={baseColor} shimmerColor={shimmerColor}>
            {words[wordIndex]}
          </TextShimmer>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function LoadingPhaseIndicator({ phase, baseColor, shimmerColor, compact = false }: LoadingPhaseIndicatorProps) {
  if (phase === INITIAL_LOADING_PHASE) {
    return <PlayfulLoadingStatus baseColor={baseColor} shimmerColor={shimmerColor} compact={compact} />;
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
