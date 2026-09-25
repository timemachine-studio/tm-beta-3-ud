import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils';

export const FlipWords = ({ words, duration = 3000, className, style }: {
  words: string[];
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}) => {
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced || words.length < 2) return;
    const timer = setInterval(() => setIndex(value => (value + 1) % words.length), duration);
    return () => clearInterval(timer);
  }, [duration, reduced, words.length]);
  const word = words[reduced ? 0 : index % words.length] || '';
  return (
    <span className={cn('relative inline-grid text-left', className)} style={style}>
      <AnimatePresence initial={false}>
        <motion.span
          key={word}
          className="col-start-1 row-start-1 whitespace-nowrap"
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -6, position: 'absolute' }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {word}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};
