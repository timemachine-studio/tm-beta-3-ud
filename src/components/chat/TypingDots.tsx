import React from 'react';
import { motion } from 'framer-motion';

interface TypingDotsProps {
  className?: string;
}

export function TypingDots({ className = '' }: TypingDotsProps) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className="w-1 h-1 bg-white rounded-full"
          animate={{
            opacity: [0.3, 1, 0.3],
            scale: [0.8, 1, 0.8],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: index * 0.2,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
