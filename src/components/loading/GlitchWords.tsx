import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LOADING_WORDS } from '../../utils/constants';

export function GlitchWords() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % LOADING_WORDS.length);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const word = LOADING_WORDS[currentIndex];

  // Enhanced glow colors for each word
  const getGlowStyle = (color: string) => ({
    textShadow: `
      0 0 20px ${color},
      0 0 40px ${color},
      0 0 60px ${color},
      0 0 80px ${color}
    `,
    WebkitTextStroke: '1px rgba(255,255,255,0.1)',
    fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif'
  });

  const glowColors = {
    'text-yellow-400': 'rgba(250, 204, 21, 0.7)',
    'text-purple-400': 'rgba(192, 132, 252, 0.7)',
    'text-green-400': 'rgba(74, 222, 128, 0.7)',
    'text-cyan-400': 'rgba(34, 211, 238, 0.7)'
  };

  return (
    <div className="relative">
      {/* Enhanced background glow effect */}
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "linear"
        }}
        className={`absolute inset-0 ${word.color} blur-3xl opacity-30`}
        style={{ transform: 'scale(2)' }}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={word.text}
          initial={{ opacity: 0, y: 20 }}
          animate={[
            { opacity: 1, y: 0 },
            { x: [-2, 2, -2, 2, 0], transition: { duration: 0.2 } }
          ]}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.15 }}
          className={`text-6xl font-bold ${word.color} relative`}
          style={getGlowStyle(glowColors[word.color as keyof typeof glowColors])}
        >
          {/* Main text */}
          <span className="relative z-10">{word.text}</span>

          {/* Enhanced glitch layers */}
          <motion.span
            className="absolute inset-0 z-0"
            animate={{
              x: [-2, 2, -2],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 0.15,
              repeat: 2,
              ease: "linear"
            }}
            style={{ 
              ...getGlowStyle(glowColors[word.color as keyof typeof glowColors]),
              clipPath: 'inset(10% 0 90% 0)'
            }}
          >
            {word.text}
          </motion.span>

          <motion.span
            className="absolute inset-0 z-0"
            animate={{
              x: [2, -2, 2],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 0.15,
              repeat: 2,
              ease: "linear"
            }}
            style={{ 
              ...getGlowStyle(glowColors[word.color as keyof typeof glowColors]),
              clipPath: 'inset(85% 0 15% 0)'
            }}
          >
            {word.text}
          </motion.span>
        </motion.div>
      </AnimatePresence>

      {/* Enhanced scanning line */}
      <motion.div
        animate={{
          y: [-20, 20],
          opacity: [0.2, 0.5, 0.2],
        }}
        transition={{
          duration: 0.5,
          repeat: Infinity,
          repeatType: "reverse",
        }}
        className={`absolute w-full h-0.5 ${word.color}`}
        style={{ 
          filter: 'blur(2px)',
          boxShadow: `0 0 20px ${glowColors[word.color as keyof typeof glowColors]}`
        }}
      />
    </div>
  );
}