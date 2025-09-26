import React from 'react';
import { motion } from 'framer-motion';

export function CentreStageText() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-4xl font-bold text-white relative"
    >
      <motion.span
        className="relative z-10"
        animate={{
          x: [-1, 1, -1, 1, 0],
          filter: ['blur(0px)', 'blur(2px)', 'blur(0px)']
        }}
        transition={{
          duration: 0.2,
          repeat: Infinity,
          repeatType: "reverse"
        }}
        style={{
          textShadow: `
            0 0 20px rgba(255,255,255,0.7),
            0 0 40px rgba(255,255,255,0.4),
            0 0 60px rgba(255,255,255,0.2)
          `
        }}
      >
        TimeMachine
      </motion.span>

      {/* Glitch Effect Layers */}
      <motion.span
        className="absolute inset-0 text-white opacity-50"
        animate={{
          x: [-2, 2, -2],
          opacity: [0.5, 0.8, 0.5]
        }}
        transition={{
          duration: 0.15,
          repeat: Infinity
        }}
        style={{
          clipPath: 'inset(45% 0 55% 0)',
          transform: 'translateX(-2px)'
        }}
      >
        TimeMachine
      </motion.span>
      
      <motion.span
        className="absolute inset-0 text-white opacity-50"
        animate={{
          x: [2, -2, 2],
          opacity: [0.5, 0.8, 0.5]
        }}
        transition={{
          duration: 0.15,
          repeat: Infinity
        }}
        style={{
          clipPath: 'inset(55% 0 45% 0)',
          transform: 'translateX(2px)'
        }}
      >
        TimeMachine
      </motion.span>
    </motion.div>
  );
}
