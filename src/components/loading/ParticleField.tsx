import React from 'react';
import { motion } from 'framer-motion';

export function ParticleField() {
  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-white rounded-full"
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            scale: 0,
          }}
          animate={{
            y: [null, Math.random() * window.innerHeight],
            scale: [0, 1, 0],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            duration: Math.random() * 2 + 1,
            repeat: Infinity,
            repeatType: "loop",
            ease: "linear",
            delay: Math.random() * 2,
          }}
          style={{
            filter: 'blur(1px)',
          }}
        />
      ))}
    </motion.div>
  );
}
