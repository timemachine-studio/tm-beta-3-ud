import React, { useState } from 'react';
import { motion } from 'framer-motion';

const characters = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function DigitalRain() {
  const [columns] = useState(() => Array.from({ length: 30 }, (_, i) => ({
    x: Math.random() * window.innerWidth,
    duration: Math.random() * 12 + 8,
    delay: Math.random() * 4,
    characters: Array.from({ length: 35 }, () => characters[Math.floor(Math.random() * characters.length)]),
    index: i,
  })));
  return (
    <div className="absolute inset-0 overflow-hidden">
      {columns.map(column => (
        <motion.div
          key={column.index}
          className="absolute top-0 text-purple-400/60 text-lg font-mono"
          initial={{ x: column.x, y: -100 }}
          animate={{ y: window.innerHeight + 100 }}
          transition={{
            duration: column.duration,
            repeat: Infinity,
            ease: "linear",
            delay: column.delay,
          }}
          style={{ 
            left: `${(column.index * 3.33)}%`,
            textShadow: '0 0 12px rgba(168, 85, 247, 0.8)',
            filter: 'brightness(1.2)',
          }}
        >
          {column.characters.map((character, j) => (
            <motion.div
              key={j}
              animate={{
                opacity: [0.2, 0.8, 0.2],
                color: ['#A855F7', '#ffffff', '#A855F7'],
              }}
              transition={{
                duration: 3, // Increased duration for smoother color transitions
                repeat: Infinity,
                delay: j * 0.15, // Increased delay between characters
              }}
              className="my-1.5" // Increased vertical spacing
            >
              {character}
            </motion.div>
          ))}
        </motion.div>
      ))}
    </div>
  );
}
