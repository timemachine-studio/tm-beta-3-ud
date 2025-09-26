import React from 'react';
import { motion } from 'framer-motion';

export function PremiumLoadingBar() {
  return (
    <div className="relative w-full h-1 bg-purple-900/30 rounded-full overflow-hidden backdrop-blur-sm">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 blur-xl" />
      
      {/* Main loading bar */}
      <motion.div
        initial={{ scaleX: 0, x: '-100%' }}
        animate={{ scaleX: 1, x: '100%' }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute inset-0 bg-gradient-to-r from-purple-600 via-purple-400 to-purple-600"
        style={{
          transformOrigin: 'left',
          boxShadow: `
            0 0 20px rgba(168, 85, 247, 0.5),
            0 0 40px rgba(168, 85, 247, 0.3)
          `,
        }}
      />

      {/* Shimmer effect */}
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
        style={{ width: '50%' }}
      />
    </div>
  );
}
