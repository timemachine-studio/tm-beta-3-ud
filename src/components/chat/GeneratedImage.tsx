import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, ZoomIn } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { AnimatedShinyText } from '../ui/AnimatedShinyText';

interface GeneratedImageProps {
  src: string;
  alt: string;
}

export function GeneratedImage({ src, alt }: GeneratedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showFullView, setShowFullView] = useState(false);
  const { theme } = useTheme();

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setIsDownloading(true);
      
      const response = await fetch(src);
      if (!response.ok) throw new Error('Failed to fetch image');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const filename = alt 
        ? `${alt.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`
        : 'generated_image.png';
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download image:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleImageClick = () => {
    if (!isLoading && !hasError) {
      setShowFullView(true);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative group my-6 max-w-2xl mx-auto cursor-pointer"
        onClick={handleImageClick}
      >
        <div className="relative rounded-3xl overflow-hidden shadow-2xl">
          {/* Clean Loading State with SF Pro Display font */}
          {isLoading && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-10 rounded-3xl">
              <AnimatedShinyText
                text="Let me cook"
                useShimmer={true}
                baseColor="#a855f7"
                shimmerColor="#ffffff"
                gradientAnimationDuration={2}
                textClassName="text-base"
                className="py-2"
                style={{ fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif' }}
              />
            </div>
          )}

          {/* Error State */}
          {hasError && (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-white/5 rounded-3xl">
              <p className={`text-sm ${theme.text} opacity-70 mb-3`}>
                Failed to load generated image
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setHasError(false);
                  setIsLoading(true);
                }}
                className={`px-4 py-2 rounded-xl text-sm
                  bg-white/10 hover:bg-white/20
                  ${theme.text} transition-colors`}
              >
                Retry
              </button>
            </div>
          )}

          {/* Image */}
          {!hasError && (
            <img
              src={src}
              alt={alt}
              onLoad={handleImageLoad}
              onError={handleImageError}
              className={`w-full h-auto transition-all duration-300 rounded-3xl
                ${isLoading ? 'opacity-0' : 'opacity-100'}
                hover:scale-[1.02] transform-gpu`}
              style={{ maxHeight: '600px', objectFit: 'contain' }}
            />
          )}

          {/* Download Button */}
          {!isLoading && !hasError && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleDownload}
              disabled={isDownloading}
              className={`absolute top-4 right-4 p-3 rounded-full
                bg-black/60 hover:bg-black/80
                backdrop-blur-md border border-white/20
                text-white transition-all duration-200
                opacity-0 group-hover:opacity-100
                disabled:opacity-50 disabled:cursor-not-allowed
                shadow-lg hover:shadow-xl`}
              title="Download image"
            >
              {isDownloading ? (
                <div className="w-5 h-5 flex items-center justify-center">
                  <AnimatedShinyText
                    text="..."
                    useShimmer={true}
                    baseColor="#ffffff"
                    shimmerColor="#ffffff"
                    gradientAnimationDuration={1}
                    textClassName="text-xs"
                  />
                </div>
              ) : (
                <Download className="w-5 h-5" />
              )}
            </motion.button>
          )}

          {/* Zoom indicator */}
          {!isLoading && !hasError && (
            <div className={`absolute bottom-4 right-4 p-2 rounded-full
              bg-black/60 backdrop-blur-md border border-white/20
              text-white transition-all duration-200
              opacity-0 group-hover:opacity-100`}
            >
              <ZoomIn className="w-4 h-4" />
            </div>
          )}
        </div>
      </motion.div>

      {/* Full View Modal */}
      <AnimatePresence>
        {showFullView && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4"
            onClick={() => setShowFullView(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-[95vw] max-h-[95vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={src}
                alt={alt}
                className="w-full h-full object-contain rounded-2xl shadow-2xl"
              />
              
              {/* Close button */}
              <button
                onClick={() => setShowFullView(false)}
                className="absolute top-4 right-4 p-3 rounded-full
                  bg-black/60 hover:bg-black/80
                  backdrop-blur-md border border-white/20
                  text-white transition-all duration-200
                  shadow-lg hover:shadow-xl"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Download button in full view */}
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="absolute top-4 left-4 p-3 rounded-full
                  bg-black/60 hover:bg-black/80
                  backdrop-blur-md border border-white/20
                  text-white transition-all duration-200
                  shadow-lg hover:shadow-xl
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloading ? (
                  <div className="w-5 h-5 flex items-center justify-center">
                    <AnimatedShinyText
                      text="..."
                      useShimmer={true}
                      baseColor="#ffffff"
                      shimmerColor="#ffffff"
                      gradientAnimationDuration={1}
                      textClassName="text-xs"
                    />
                  </div>
                ) : (
                  <Download className="w-5 h-5" />
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}