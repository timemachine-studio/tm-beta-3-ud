import React from 'react';
import { motion } from 'framer-motion';
import { MessageProps } from '../../types/chat';
import { slideInFromRight } from '../../utils/animations';
import { useTheme } from '../../context/ThemeContext';
import { AudioPlayerBubble } from './AudioPlayerBubble';

export function UserMessage({ content, imageData, audioData }: MessageProps) {
  const { theme } = useTheme();
  
  return (
    <motion.div
      {...slideInFromRight}
      className="flex items-start justify-end"
    >
      {/* Display audio message if present */}
      {audioData ? (
        <AudioPlayerBubble
          audioSrc={audioData}
          isUserMessage={true}
          className="max-w-[85%]"
        />
      ) : (
        <div className={`max-w-[85%] px-4 py-2 rounded-2xl
          bg-purple-500/10 backdrop-blur-sm
          border border-purple-500/20
          shadow-[0_0_15px_rgba(168,85,247,0.1)]
          ${theme.text} text-base`}
        >
          {/* Display images if present */}
          {imageData && (
            <div className="mb-3">
              {Array.isArray(imageData) ? (
                <div className="grid grid-cols-2 gap-2">
                  {imageData.map((image, index) => (
                    <img
                      key={index}
                      src={image}
                      alt={`Uploaded image ${index + 1}`}
                      className="max-w-full h-auto rounded-lg object-cover max-h-48"
                    />
                  ))}
                </div>
              ) : (
                <img
                  src={imageData}
                  alt="Uploaded image"
                  className="max-w-full h-auto rounded-lg object-cover max-h-48"
                />
              )}
            </div>
          )}
          
          {/* Display text content if present */}
          {content && <div>{content}</div>}
        </div>
      )}
    </motion.div>
  );
}