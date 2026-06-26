import React from 'react';
import { motion } from 'framer-motion';
import { X, FileText, FileCode, FileEdit, File } from 'lucide-react';
import { LoadingSpinner } from '../loading/LoadingSpinner';

interface FilePreviewProps {
  fileName: string;
  fileSize: string;
  onRemove: () => void;
  isUploading: boolean;
}

export function FilePreview({ fileName, fileSize, onRemove, isUploading }: FilePreviewProps) {
  const getFileDetails = (name: string) => {
    const extension = name.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'pdf':
        return {
          Icon: FileText,
          colorClass: 'text-red-400',
          bgClass: 'bg-red-500/20 border-red-500/30',
          label: 'PDF'
        };
      case 'md':
        return {
          Icon: FileEdit,
          colorClass: 'text-indigo-400',
          bgClass: 'bg-indigo-500/20 border-indigo-500/30',
          label: 'Markdown'
        };
      case 'txt':
        return {
          Icon: FileText,
          colorClass: 'text-emerald-400',
          bgClass: 'bg-emerald-500/20 border-emerald-500/30',
          label: 'Text'
        };
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
      case 'json':
      case 'csv':
      case 'html':
      case 'css':
      case 'yaml':
      case 'yml':
      case 'xml':
        return {
          Icon: FileCode,
          colorClass: 'text-amber-400',
          bgClass: 'bg-amber-500/20 border-amber-500/30',
          label: extension.toUpperCase()
        };
      default:
        return {
          Icon: File,
          colorClass: 'text-white/60',
          bgClass: 'bg-white/10 border-white/20',
          label: extension ? extension.toUpperCase() : 'File'
        };
    }
  };

  const { Icon, colorClass, bgClass, label } = getFileDetails(fileName);

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
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg border ${bgClass}`}>
          <Icon className={`w-5 h-5 ${colorClass}`} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-white text-sm font-medium truncate max-w-[200px]" title={fileName}>
            {fileName}
          </span>
          <span className="text-white/40 text-xs">{fileSize} • {label}</span>
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
