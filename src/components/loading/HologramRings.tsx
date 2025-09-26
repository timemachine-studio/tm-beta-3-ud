import React from 'react';
import { motion } from 'framer-motion';

export function HologramRings() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-purple-500/20"
          initial={{ width: 100, height: 100, opacity: 0 }}
          animate={{
            width: [100 + i * 40, 200 + i * 40],
            height: [100 + i * 40, 200 + i * 40],
            opacity: [0.3, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.4,
            ease: "easeOut"
          }}
          style={{
            boxShadow: '0 0 20px rgba(168,85,247,0.2)',
          }}
        />
      ))}
    </div>
  );
}
