import React, { useState } from 'react';
import { motion } from 'framer-motion';

export function ParticleField() {
  const [particles] = useState(() => Array.from({ length: 20 }, (_, index) => ({
    index,
    x: Math.random() * window.innerWidth,
    startY: Math.random() * window.innerHeight,
    endY: Math.random() * window.innerHeight,
    duration: Math.random() * 2 + 1,
    delay: Math.random() * 2,
  })));
  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {particles.map(particle => (
        <motion.div
          key={particle.index}
          className="absolute w-1 h-1 bg-white rounded-full"
          initial={{
            x: particle.x,
            y: particle.startY,
            scale: 0,
          }}
          animate={{
            y: [null, particle.endY],
            scale: [0, 1, 0],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            repeatType: "loop",
            ease: "linear",
            delay: particle.delay,
          }}
          style={{
            filter: 'blur(1px)',
          }}
        />
      ))}
    </motion.div>
  );
}
