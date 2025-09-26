import React from 'react';
import { motion } from 'framer-motion';

export function ScanningEffect() {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Horizontal scan line */}
      <motion.div
        className="absolute w-full h-[2px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"
        animate={{
          top: ['0%', '100%', '0%'],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "linear"
        }}
        style={{
          filter: 'blur(2px)',
          boxShadow: '0 0 20px rgba(168,85,247,0.5)'
        }}
      />

      {/* Subtle grid overlay */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(168,85,247,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.1) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          opacity: 0.2
        }}
      />
    </motion.div>
  );
}
