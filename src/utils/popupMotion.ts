import type { TargetAndTransition } from 'framer-motion';

// A glass surface must fade away before it unmounts. Transform-only exits
// leave a fully painted panel on the final frame and then cut it off.
export const popupExit: TargetAndTransition = {
  opacity: 0,
  scale: 0.985,
  transition: { type: 'tween', duration: 0.2, ease: [0.4, 0, 0.2, 1] },
};

export const scrimExit: TargetAndTransition = {
  opacity: 0,
  transition: { type: 'tween', duration: 0.2, ease: [0.4, 0, 0.2, 1] },
};
