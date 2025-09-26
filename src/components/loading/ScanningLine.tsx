import React from 'react';
import { motion } from 'framer-motion';

export function ScanningLine() {
  return (
    <motion.div
      animate={{
        y: [-50, 50],
        opacity: [0.3, 1, 0.3],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        repeatType: "reverse",
      }}
      className="absolute w-full h-0.5 bg-gradient-to-r from-transparent via-white to-transparent"
      style={{ 
        filter: 'blur(2px)',
        boxShadow: '0 0 20px rgba(255,255,255,0.5)',
      }}
    />
  );
}
