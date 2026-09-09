import React, { useState } from 'react';
import { motion } from 'framer-motion';

export function GlitchOverlay() {
  const [blocks] = useState(() => Array.from({ length: 5 }, (_, index) => ({
    index,
    width: Math.random() * 100,
    height: Math.random() * 20,
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    offsetX: (Math.random() - 0.5) * 50,
    offsetY: (Math.random() - 0.5) * 50,
  })));
  const [lines] = useState(() => Array.from({ length: 3 }, (_, index) => ({
    index,
    x: Math.random() * window.innerWidth,
    offsetX: (Math.random() - 0.5) * 100,
  })));
  return (
    <motion.div 
      className="absolute inset-0 pointer-events-none overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Random glitch blocks */}
      {blocks.map(block => (
        <motion.div
          key={block.index}
          className="absolute bg-purple-500/30 mix-blend-screen"
          initial={{ 
            width: block.width,
            height: block.height,
            x: block.x,
            y: block.y,
            opacity: 0 
          }}
          animate={{
            opacity: [0, 0.8, 0],
            x: block.offsetX,
            y: block.offsetY,
          }}
          transition={{
            duration: 0.2,
            repeat: Infinity,
            repeatType: "mirror",
            delay: block.index * 0.1,
            ease: "linear"
          }}
        />
      ))}

      {/* Vertical glitch lines */}
      {lines.map(line => (
        <motion.div
          key={`line-${line.index}`}
          className="absolute top-0 bottom-0 w-[1px] bg-purple-400/30"
          initial={{ x: line.x }}
          animate={{
            opacity: [0, 1, 0],
            x: [null, line.offsetX],
          }}
          transition={{
            duration: 0.1,
            repeat: Infinity,
            delay: line.index * 0.3,
            ease: "easeInOut"
          }}
        />
      ))}
    </motion.div>
  );
}
