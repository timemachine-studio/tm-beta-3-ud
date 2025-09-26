import React from 'react';
import { motion } from 'framer-motion';

export function GlitchOverlay() {
  return (
    <motion.div 
      className="absolute inset-0 pointer-events-none overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Random glitch blocks */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute bg-purple-500/30 mix-blend-screen"
          initial={{ 
            width: Math.random() * 100,
            height: Math.random() * 20,
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            opacity: 0 
          }}
          animate={{
            opacity: [0, 0.8, 0],
            x: (Math.random() - 0.5) * 50,
            y: (Math.random() - 0.5) * 50,
          }}
          transition={{
            duration: 0.2,
            repeat: Infinity,
            repeatType: "mirror",
            delay: i * 0.1,
            ease: "linear"
          }}
        />
      ))}

      {/* Vertical glitch lines */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={`line-${i}`}
          className="absolute top-0 bottom-0 w-[1px] bg-purple-400/30"
          initial={{ x: Math.random() * window.innerWidth }}
          animate={{
            opacity: [0, 1, 0],
            x: [null, (Math.random() - 0.5) * 100],
          }}
          transition={{
            duration: 0.1,
            repeat: Infinity,
            delay: i * 0.3,
            ease: "easeInOut"
          }}
        />
      ))}
    </motion.div>
  );
}
