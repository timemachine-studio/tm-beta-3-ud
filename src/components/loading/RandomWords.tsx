import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LOADING_WORDS } from '../../utils/constants';
import { shuffleArray } from '../../utils/array';

export function RandomWords() {
  const [words, setWords] = useState(LOADING_WORDS);

  useEffect(() => {
    const interval = setInterval(() => {
      setWords(prev => shuffleArray([...prev]));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex gap-6">
      <AnimatePresence mode="wait">
        {words.map((word, index) => (
          <motion.span
            key={`${word.text}-${index}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ 
              opacity: 1, 
              y: 0,
              filter: ['blur(8px)', 'blur(0px)', 'blur(0px)', 'blur(8px)'],
            }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ 
              duration: 0.3,
              delay: index * 0.1,
            }}
            className={`text-4xl font-bold ${word.color}`}
            style={{
              textShadow: '0 0 20px currentColor',
            }}
          >
            {word.text}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
