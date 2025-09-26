import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatedWords } from './AnimatedWords';
import { textGlowStyle } from '../../utils/animations';

interface ResponseCardsProps {
  content: string;
  wordsPerCard: number;
}

export function ResponseCards({ content, wordsPerCard }: ResponseCardsProps) {
  const [currentCard, setCurrentCard] = useState(0);
  
  // Split content into cards
  const words = content.split(' ');
  const cards = [];
  for (let i = 0; i < words.length; i += wordsPerCard) {
    cards.push(words.slice(i, i + wordsPerCard).join(' '));
  }

  const goToNextCard = () => {
    if (currentCard < cards.length - 1) {
      setCurrentCard(prev => prev + 1);
    }
  };

  const goToPrevCard = () => {
    if (currentCard > 0) {
      setCurrentCard(prev => prev - 1);
    }
  };

  return (
    <div className="relative">
      {/* Cards */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentCard}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          className="min-h-[200px] flex items-center justify-center"
        >
          <AnimatedWords
            text={cards[currentCard]}
            className="ai-message text-5xl md:text-6xl lg:text-7xl font-bold text-white"
            style={textGlowStyle}
          />
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-center items-center gap-4 mt-8">
        <button
          onClick={goToPrevCard}
          disabled={currentCard === 0}
          className="p-2 rounded-full bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        
        <span className="text-gray-400">
          {currentCard + 1} / {cards.length}
        </span>
        
        <button
          onClick={goToNextCard}
          disabled={currentCard === cards.length - 1}
          className="p-2 rounded-full bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
