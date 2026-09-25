import { useReducedMotion } from 'framer-motion';
import { ThinkingOrb } from 'thinking-orbs';
import { thinkingVisualAt, type ThinkingAnimationChoice } from '../../config/thinkingAnimation';
import { SymmetricWave } from '../ui/symmetric-wave';
import { constellationFrame, stillConstellationFrame } from './constellationFrame';

interface ThinkingAnimationVisualProps {
  choice: ThinkingAnimationChoice;
  step: number;
  color: string;
  theme: 'dark' | 'light';
  paused?: boolean;
  preview?: boolean;
}

export function ThinkingAnimationVisual({ choice, step, color, theme, paused = false, preview = false }: ThinkingAnimationVisualProps) {
  const reducedMotion = useReducedMotion();
  const visual = thinkingVisualAt(choice, reducedMotion ? 0 : step);
  const displaySize = visual.kind === 'orb' && visual.size === 20
    ? (preview ? 32 : 30)
    : (preview ? 64 : 46);

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden leading-none ${preview ? 'h-16 w-20' : 'h-12 w-[62px]'}`}
      style={{ color }}
    >
      {visual.kind === 'cubes' ? (
        <SymmetricWave paused={paused || !!reducedMotion} className="!h-3 !w-auto !text-[11px]" />
      ) : (
        <ThinkingOrb
          key={visual.kind === 'constellation' ? 'constellation' : `${visual.state}-${visual.size}`}
          state={visual.kind === 'constellation' ? 'connecting' : visual.state}
          size={visual.kind === 'constellation' ? 64 : visual.size}
          theme={theme}
          color={color}
          paused={paused || !!reducedMotion}
          dotSize={visual.kind === 'orb' ? (visual.size === 20 ? 1.15 : 1.35) : 1}
          frame={visual.kind === 'constellation' ? (paused || reducedMotion ? stillConstellationFrame : constellationFrame) : undefined}
          style={{
            width: displaySize,
            height: displaySize,
            filter: visual.kind === 'orb' && theme === 'dark'
              ? visual.size === 64
                ? 'brightness(1.65) drop-shadow(0 0 4px currentColor)'
                : 'brightness(1.35) drop-shadow(0 0 0 currentColor)'
              : undefined,
          }}
        />
      )}
    </span>
  );
}
