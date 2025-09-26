import React from 'react';
import { motion } from 'framer-motion';

interface GlitchTextProps {
  text: string;
  delay?: number;
}

export function GlitchText({ text, delay = 0 }: GlitchTextProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
      className="relative"
    >
      <motion.span
        className="block text-purple-500"
        animate={{
          x: [-2, 2, -2, 0],
          filter: ['blur(0px)', 'blur(2px)', 'blur(0px)']
        }}
        transition={{
          duration: 0.2,
          repeat: Infinity,
          repeatType: "reverse"
        }}
      >
        {text}
      </motion.span>
      
      {/* Glitch layers */}
      <motion.span
        className="absolute top-0 left-0 text-red-500 opacity-50"
        animate={{
          x: [-3, 3, -3],
          opacity: [0.5, 0.8, 0.5]
        }}
        transition={{ duration: 0.15, repeat: Infinity }}
        style={{ clipPath: 'inset(45% 0 55% 0)' }}
      >
        {text}
      </motion.span>
      
      <motion.span
        className="absolute top-0 left-0 text-blue-500 opacity-50"
        animate={{
          x: [3, -3, 3],
          opacity: [0.5, 0.8, 0.5]
        }}
        transition={{ duration: 0.15, repeat: Infinity }}
        style={{ clipPath: 'inset(55% 0 45% 0)' }}
      >
        {text}
      </motion.span>
    </motion.div>
  );
}
