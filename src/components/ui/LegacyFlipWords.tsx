import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "../../lib/utils";
import { LEGACY_TEXT_TRANSITION } from "../../themes/legacyMotion";

export const FlipWords = ({
  words,
  duration = 3000,
  className,
}: {
  words: string[];
  duration?: number;
  className?: string;
}) => {
  const [index, setIndex] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion || words.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % words.length);
    }, duration);
    return () => window.clearInterval(timer);
  }, [duration, reducedMotion, words.length]);

  const currentWord = words[reducedMotion ? 0 : index % words.length] || "";

  return (
    <motion.span
      layout="size"
      transition={{ layout: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } }}
      style={{
        ...LEGACY_TEXT_TRANSITION,
      }}
      className={cn(
        "relative inline-grid px-2 text-left transition-colors ease-in-out",
        className
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={currentWord}
          className="col-start-1 row-start-1 inline-block whitespace-nowrap"
          initial={reducedMotion ? false : { opacity: 0, y: 7, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reducedMotion ? undefined : { opacity: 0, y: -7, filter: "blur(6px)" }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          aria-label={currentWord}
        >
          {currentWord.split("").map((letter, letterIndex) => (
          <motion.span
            key={`${currentWord}-${letterIndex}`}
            initial={reducedMotion ? false : { opacity: 0, y: 4, filter: "blur(3px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{
              delay: reducedMotion ? 0 : letterIndex * 0.03,
              duration: 0.48,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="inline-block"
            aria-hidden="true"
          >
            {letter === " " ? "\u00a0" : letter}
          </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
};
