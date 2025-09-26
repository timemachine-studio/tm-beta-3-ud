import React from 'react';
import { motion } from 'framer-motion';

export function LoadingEffects() {
  return (
    <>
      {/* Hexagonal Grid Background */}
      <div className="absolute inset-0 opacity-15">
        <svg width="100%" height="100%" className="absolute inset-0">
          <pattern
            id="hexagons"
            width="60"
            height="52"
            patternUnits="userSpaceOnUse"
            patternTransform="scale(2.5)"
          >
            <path
              d="M25 0L50 14.4v28.8L25 43.4L0 43.4V14.4z"
              fill="none"
              stroke="rgba(168, 85, 247, 0.15)"
              strokeWidth="1"
            />
          </pattern>
          <rect width="100%" height="100%" fill="url(#hexagons)" />
        </svg>
      </div>

      {/* Circuit Lines */}
      <div className="absolute inset-0">
        {Array.from({ length: 10 }).map((_, i) => (
          <motion.div
            key={`circuit-${i}`}
            className="absolute h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent"
            style={{
              top: `${8 + i * 10}%`,
              left: '0',
              right: '0',
            }}
            animate={{
              opacity: [0.1, 0.4, 0.1],
              scaleX: [0.85, 1.15, 0.85],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              delay: i * 0.3,
            }}
          />
        ))}
      </div>

      {/* Animated Particles */}
      {Array.from({ length: 60 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-purple-500 rounded-full"
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
          }}
          animate={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            scale: [0, 1.2, 0],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: Math.random() * 4 + 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Holographic Rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute border border-purple-500/20 rounded-full"
            initial={{ width: 60, height: 60 }}
            animate={{
              width: [60 + i * 120, 180 + i * 120],
              height: [60 + i * 120, 180 + i * 120],
              opacity: [0.6, 0],
              rotate: [0, 180],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 0.6,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Scanning Lines */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/3 to-transparent"
        style={{ height: '200%' }}
        animate={{
          y: ['-50%', '0%'],
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </>
  );
}
