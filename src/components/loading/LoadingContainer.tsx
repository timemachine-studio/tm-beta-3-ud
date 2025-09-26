import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlitchWords } from './GlitchWords';
import { ParticleField } from './ParticleField';
import { CentreStageText } from './CentreStageText';

interface LoadingContainerProps {
  isVisible: boolean;
}

export function LoadingContainer({ isVisible }: LoadingContainerProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex flex-col items-center justify-center z-50"
        >
          <ParticleField />
          
          {/* Centre Stage Text */}
          <div className="absolute top-1/3">
            <CentreStageText />
          </div>

          {/* Dynamic Words */}
          <div className="absolute top-1/2">
            <GlitchWords />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
