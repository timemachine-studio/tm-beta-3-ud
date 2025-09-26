import React from 'react';
import { motion } from 'framer-motion';

export function LoadingRing() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "linear"
      }}
      className="w-32 h-32 rounded-full border-4 border-transparent border-t-yellow-400 border-r-green-400 border-b-cyan-400 border-l-purple-400"
      style={{
        filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.3))',
      }}
    />
  );
}
