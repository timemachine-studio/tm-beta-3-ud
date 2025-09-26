import React from 'react';
import { motion } from 'framer-motion';

const characters = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function DigitalRain() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute top-0 text-purple-400/60 text-lg font-mono"
          initial={{ x: Math.random() * window.innerWidth, y: -100 }}
          animate={{ y: window.innerHeight + 100 }}
          transition={{
            duration: Math.random() * 12 + 8, // Increased duration for smoother movement
            repeat: Infinity,
            ease: "linear",
            delay: Math.random() * 4, // Increased delay for better distribution
          }}
          style={{ 
            left: `${(i * 3.33)}%`, // Increased spacing between columns
            textShadow: '0 0 12px rgba(168, 85, 247, 0.8)',
            filter: 'brightness(1.2)',
          }}
        >
          {Array.from({ length: 35 }).map((_, j) => ( // Increased number of characters
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
              {characters[Math.floor(Math.random() * characters.length)]}
            </motion.div>
          ))}
        </motion.div>
      ))}
    </div>
  );
}
