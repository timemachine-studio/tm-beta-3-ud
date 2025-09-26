import React from 'react';
import { motion } from 'framer-motion';

const japaneseTexts = [
  { text: "未来へ", meaning: "To the future" },
  { text: "時間旅行", meaning: "Time travel" },
  { text: "量子転送", meaning: "Quantum transfer" },
];

export function JapaneseText() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {japaneseTexts.map((item, index) => (
        <motion.div
          key={item.text}
          className="absolute text-purple-300/30 text-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: index * 0.5,
          }}
          style={{
            left: `${20 + index * 30}%`,
            top: `${30 + index * 20}%`,
          }}
        >
          <div className="font-bold">{item.text}</div>
          <div className="text-sm opacity-50">{item.meaning}</div>
        </motion.div>
      ))}
    </div>
  );
}
