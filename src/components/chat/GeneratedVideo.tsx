import React, { memo, useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, RotateCcw } from 'lucide-react';
import { AnimatedShinyText } from '../ui/AnimatedShinyText';
import { AI_PERSONAS } from '../../config/constants';
import { useTheme } from '../../context/ThemeContext';

interface GeneratedVideoProps {
  src: string;
  title?: string;
  persona?: keyof typeof AI_PERSONAS;
}

const PERSONA_SHIMMER_COLORS: Record<string, { baseColor: string; shimmerColor: string }> = {
  girlie: { baseColor: '#ec4899', shimmerColor: '#ffffff' },
  pro: { baseColor: '#06b6d4', shimmerColor: '#ffffff' },
  chatgpt: { baseColor: '#22c55e', shimmerColor: '#ffffff' },
  gemini: { baseColor: '#3b82f6', shimmerColor: '#ffffff' },
  claude: { baseColor: '#f97316', shimmerColor: '#ffffff' },
  grok: { baseColor: '#9ca3af', shimmerColor: '#ffffff' },
  default: { baseColor: '#a855f7', shimmerColor: '#ffffff' },
};

function GeneratedVideoComponent({ src, title = 'Generated video', persona = 'default' }: GeneratedVideoProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { theme } = useTheme();

  const shimmerColors = useMemo(
    () => PERSONA_SHIMMER_COLORS[persona] || PERSONA_SHIMMER_COLORS.default,
    [persona]
  );

  const handleLoaded = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    setReloadKey(prev => prev + 1);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative group my-6 w-full max-w-2xl mx-auto"
    >
      <div className="relative overflow-hidden rounded-3xl bg-black/20 shadow-2xl border border-white/10">
        {isLoading && !hasError && (
          <div className="absolute inset-0 min-h-[260px] flex items-center justify-center bg-black/30 backdrop-blur-sm z-10">
            <AnimatedShinyText
              text="Generating Video"
              useShimmer={true}
              baseColor={shimmerColors.baseColor}
              shimmerColor={shimmerColors.shimmerColor}
              gradientAnimationDuration={2}
              textClassName="text-base"
              className="py-2"
              style={{ fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif' }}
            />
          </div>
        )}

        {hasError ? (
          <div className="min-h-[260px] flex flex-col items-center justify-center p-8 text-center">
            <p className={`text-sm ${theme.text} opacity-70 mb-3`}>
              Failed to load generated video
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-white/10 hover:bg-white/20 ${theme.text} transition-colors`}
            >
              <RotateCcw className="w-4 h-4" />
              Retry
            </button>
          </div>
        ) : (
          <video
            key={reloadKey}
            src={src}
            controls
            playsInline
            preload="metadata"
            onLoadedData={handleLoaded}
            onCanPlay={handleLoaded}
            onError={handleError}
            className={`w-full aspect-video bg-black object-contain transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
          />
        )}

        {!isLoading && !hasError && (
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="absolute top-4 right-4 p-3 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white transition-all duration-200 opacity-0 group-hover:opacity-100 shadow-lg"
            title="Open video"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        )}
      </div>
      <span className="sr-only">{title}</span>
    </motion.div>
  );
}

export const GeneratedVideo = memo(GeneratedVideoComponent);
