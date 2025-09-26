import React from 'react';
import { motion } from 'framer-motion';

export function Title() {
  return (
    <motion.h1
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-purple-200"
      style={{
        fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
        textShadow: `
          0 0 40px rgba(168, 85, 247, 0.5),
          0 0 80px rgba(168, 85, 247, 0.3),
          0 0 120px rgba(168, 85, 247, 0.2)
        `,
        WebkitTextStroke: '1px rgba(255, 255, 255, 0.2)'
      }}
    >
      TimeMachine
    </motion.h1>
  );
}