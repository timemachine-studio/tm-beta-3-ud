import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { LoadingSpinner } from '../loading/LoadingSpinner';

interface ImagePreviewProps {
  url: string;
  onRemove: () => void;
  isUploading: boolean;
}

export function ImagePreview({ url, onRemove, isUploading }: ImagePreviewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="relative mb-4 inline-block"
    >
      <div className="relative group rounded-lg overflow-hidden border border-white/10 backdrop-blur-xl">
        <img
          src={url}
          alt="Preview"
          className="max-h-32 rounded-lg object-cover"
          style={{ filter: isUploading ? 'blur(2px)' : 'none' }}
        />
        
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {!isUploading && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onRemove}
            className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}