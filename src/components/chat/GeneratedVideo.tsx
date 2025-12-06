import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Play, Image as ImageIcon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { AnimatedShinyText } from '../ui/AnimatedShinyText';

interface GeneratedVideoProps {
  src: string;
  alt: string;
}

export function GeneratedVideo({ src, alt }: GeneratedVideoProps) {
  const [confirmationState, setConfirmationState] = useState<'pending' | 'approved' | 'image'>('pending');
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showFullView, setShowFullView] = useState(false);
  const { theme } = useTheme();

  // Extract prompt from URL for image generation fallback
  const extractPromptFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const encodedPrompt = pathParts[pathParts.length - 1];
      return decodeURIComponent(encodedPrompt);
    } catch (error) {
      console.error('Failed to extract prompt from URL:', error);
      return 'Generated content';
    }
  };

  const generateImageUrl = (prompt: string): string => {
    const encodedPrompt = encodeURIComponent(prompt);
    const hardcodedToken = "plln_sk_GnhDxr0seAiz92cgYsAh3VjBGQM8NRLK";
    const width = 2160;
    const height = 3840;
    return `https://enter.pollinations.ai/api/generate/image/${encodedPrompt}?width=${width}&height=${height}&enhance=false&private=true&nologo=true&model=seedream-pro&key=${hardcodedToken}`;
  };

  const handleContinue = () => {
    setConfirmationState('approved');
    setIsLoading(true);
  };

  const handleGenerateAsImage = () => {
    setConfirmationState('image');
  };

  const handleVideoLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleVideoError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setIsDownloading(true);

      const response = await fetch(src);
      if (!response.ok) throw new Error('Failed to fetch video');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const filename = alt
        ? `${alt.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`
        : 'generated_video.mp4';

      link.download = filename;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download video:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleVideoClick = () => {
    if (!isLoading && !hasError) {
      setShowFullView(true);
    }
  };

  // Confirmation Card State
  if (confirmationState === 'pending') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative my-6 max-w-2xl mx-auto"
      >
        <div className={`relative rounded-3xl overflow-hidden shadow-2xl border ${theme.border} bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-blue-500/10 backdrop-blur-xl`}>
          <div className="p-8 flex flex-col items-center text-center space-y-6">
            {/* Icon */}
            <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Play className="w-8 h-8 text-purple-400" />
            </div>

            {/* Title */}
            <div>
              <h3 className={`text-2xl font-semibold ${theme.text} mb-2`}>
                TimeMachine wants to generate a video
              </h3>
              <p className={`text-sm ${theme.text} opacity-70`}>
                Video generation is resource-intensive. Choose how to proceed:
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-3 w-full max-w-sm">
              {/* Continue Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleContinue}
                className="w-full px-6 py-4 rounded-2xl font-medium
                  bg-gradient-to-r from-purple-500 to-pink-500
                  hover:from-purple-600 hover:to-pink-600
                  text-white shadow-lg hover:shadow-xl
                  transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                Continue
              </motion.button>

              {/* Generate as Image Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGenerateAsImage}
                className={`w-full px-6 py-4 rounded-2xl font-medium
                  bg-white/10 hover:bg-white/20
                  ${theme.text} border ${theme.border}
                  transition-all duration-200 flex items-center justify-center gap-2`}
              >
                <ImageIcon className="w-5 h-5" />
                Generate this as image instead
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // If user chose to generate as image instead
  if (confirmationState === 'image') {
    const prompt = extractPromptFromUrl(src);
    const imageUrl = generateImageUrl(prompt);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative group my-6 max-w-2xl mx-auto cursor-pointer"
        onClick={() => {
          if (!isLoading && !hasError) {
            setShowFullView(true);
          }
        }}
      >
        <div className="relative rounded-3xl overflow-hidden shadow-2xl">
          {/* Loading State */}
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
              src={imageUrl}
              alt={prompt}
              onLoad={() => {
                setIsLoading(false);
                setHasError(false);
              }}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
              className={`w-full h-auto transition-all duration-300 rounded-3xl
                ${isLoading ? 'opacity-0' : 'opacity-100'}
                hover:scale-[1.02] transform-gpu`}
              style={{ maxHeight: '600px', objectFit: 'contain' }}
            />
          )}
        </div>

        {/* Full View Modal for Image */}
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
                  src={imageUrl}
                  alt={prompt}
                  className="w-full h-full object-contain rounded-2xl shadow-2xl"
                />

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
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // Video generation approved - show video
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative group my-6 max-w-2xl mx-auto cursor-pointer"
        onClick={handleVideoClick}
      >
        <div className="relative rounded-3xl overflow-hidden shadow-2xl">
          {/* Loading State with shimmer */}
          {isLoading && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-10 rounded-3xl">
              <AnimatedShinyText
                text="Generating video"
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
                Failed to load generated video
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

          {/* Video */}
          {!hasError && (
            <video
              src={src}
              onLoadedData={handleVideoLoad}
              onError={handleVideoError}
              controls
              loop
              playsInline
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
              title="Download video"
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

          {/* Play indicator */}
          {!isLoading && !hasError && (
            <div className={`absolute bottom-4 right-4 p-2 rounded-full
              bg-black/60 backdrop-blur-md border border-white/20
              text-white transition-all duration-200
              opacity-0 group-hover:opacity-100`}
            >
              <Play className="w-4 h-4" />
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
              <video
                src={src}
                controls
                loop
                autoPlay
                playsInline
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
