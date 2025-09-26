import React from 'react';
import { motion } from 'framer-motion';

export function HologramTitle() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative"
    >
      {/* Main title */}
      <motion.h1
        className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-purple-300 to-purple-600"
        style={{
          fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
          WebkitTextStroke: '1px rgba(255, 255, 255, 0.1)'
        }}
        animate={{
          textShadow: [
            '0 0 20px rgba(168,85,247,0.5), 0 0 40px rgba(168,85,247,0.3)',
            '0 0 40px rgba(168,85,247,0.7), 0 0 80px rgba(168,85,247,0.5)',
            '0 0 20px rgba(168,85,247,0.5), 0 0 40px rgba(168,85,247,0.3)',
          ]
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        TimeMachine CS
      </motion.h1>

      {/* Glitch copies */}
      <motion.h1
        className="absolute inset-0 text-4xl font-bold text-purple-500/50"
        style={{ fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif' }}
        animate={{
          x: [-2, 2, -2],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 0.2,
          repeat: Infinity,
          ease: "linear"
        }}
      >
        TimeMachine CS
      </motion.h1>
      
      <motion.h1
        className="absolute inset-0 text-4xl font-bold text-cyan-500/50"
        style={{ fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif' }}
        animate={{
          x: [2, -2, 2],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 0.2,
          repeat: Infinity,
          ease: "linear",
          delay: 0.1
        }}
      >
        TimeMachine CS
      </motion.h1>

      {/* Hologram scan effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/10 to-transparent"
        animate={{
          y: [-20, 20],
          opacity: [0, 0.5, 0],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "linear"
        }}
      />
    </motion.div>
  );
}