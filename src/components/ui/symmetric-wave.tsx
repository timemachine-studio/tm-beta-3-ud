import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';
import './symmetric-wave.css';

const SYMMETRIC_WAVE_PHASES = [1, 2, 3, 4, 5, 5, 4, 3, 2, 1] as const;

type SymmetricWaveProps = ComponentProps<'span'> & {
  block?: string;
  track?: string;
  paused?: boolean;
};

function SymmetricWave({
  className,
  block = '█',
  track = '░',
  paused = false,
  ...props
}: SymmetricWaveProps) {
  return (
    <>
      <span
        role="status"
        className={cn(
          'relative inline-flex h-[1em] w-[10ch] overflow-hidden font-mono text-xl leading-none text-current select-none',
          className,
        )}
        {...props}
      >
        {SYMMETRIC_WAVE_PHASES.map((phase, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="relative flex h-full w-[1ch] items-center justify-center"
          >
            <span className="opacity-30">{track}</span>
            <span
              className="loading-ui-symmetric-wave-block absolute inset-0 flex items-center justify-center"
              style={{
                animation: `loading-ui-symmetric-wave-${phase} var(--duration, 2s) linear infinite`,
                animationPlayState: paused ? 'paused' : undefined,
              }}
            >
              {block}
            </span>
          </span>
        ))}
        <span className="sr-only">Loading</span>
      </span>
    </>
  );
}

export { SymmetricWave };
export default SymmetricWave;
