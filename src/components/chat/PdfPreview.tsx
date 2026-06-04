import React from 'react';
import { motion } from 'framer-motion';
import { X, FileText } from 'lucide-react';
import { LoadingSpinner } from '../loading/LoadingSpinner';

interface PdfPreviewProps {
  fileName: string;
  fileSize: string;
  onRemove: () => void;
  isUploading: boolean;
}

export function PdfPreview({ fileName, fileSize, onRemove, isUploading }: PdfPreviewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="relative mb-4 inline-block"
    >
      <div
        className="relative group flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          filter: isUploading ? 'blur(1px)' : 'none'
        }}
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-500/20 border border-red-500/30">
          <FileText className="w-5 h-5 text-red-400" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-white text-sm font-medium truncate max-w-[200px]">
            {fileName}
          </span>
          <span className="text-white/40 text-xs">{fileSize}</span>
        </div>

        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/30 backdrop-blur-sm">
            <LoadingSpinner size="sm" />
          </div>
        )}

        {!isUploading && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onRemove}
            className="ml-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
