import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { X } from 'lucide-react';
import { MessageProps } from '../../types/chat';
import { AI_PERSONAS } from '../../config/constants';
import { Brain } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { GeneratedImage } from './GeneratedImage';
import { AnimatedShinyText } from '../ui/AnimatedShinyText';
import { AudioPlayerBubble } from './AudioPlayerBubble';

interface AIMessageProps extends MessageProps {
  isChatMode: boolean;
  messageId: number;
  onAnimationComplete: (messageId: number) => void;
  currentPersona?: keyof typeof AI_PERSONAS;
  previousMessage?: string | null;
  isStreaming?: boolean;
  audioUrl?: string;
  isStreamingActive?: boolean;
}

const getPersonaColor = (persona: keyof typeof AI_PERSONAS = 'default') => {
  switch (persona) {
    case 'girlie':
      return 'text-pink-400';
    case 'pro':
      return 'text-cyan-400';
    default:
      return 'text-purple-400';
  }
};

const getPersonaShimmerColors = (persona: keyof typeof AI_PERSONAS = 'default') => {
  switch (persona) {
    case 'girlie':
      return { baseColor: '#ec4899', shimmerColor: '#ffffff' }; // Pink base with white shimmer
    case 'pro':
      return { baseColor: '#06b6d4', shimmerColor: '#ffffff' }; // Cyan base with white shimmer
    default:
      return { baseColor: '#a855f7', shimmerColor: '#ffffff' }; // Purple base with white shimmer
  }
};

const extractMentionedPersona = (message: string | null): keyof typeof AI_PERSONAS | null => {
  if (!message) return null;
  const match = message.match(/^@(girlie|pro)\s/);
  return match ? match[1] as keyof typeof AI_PERSONAS : null;
};

export function AIMessage({ 
  content, 
  thinking: reasoning,
  isChatMode, 
  messageId, 
  hasAnimated, 
  onAnimationComplete, 
  currentPersona = 'default',
  previousMessage = null,
  isStreaming = false,
  audioUrl,
  isStreamingActive = false
}: AIMessageProps) {
  const [showReasoning, setShowReasoning] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const mentionedPersona = extractMentionedPersona(previousMessage);
  const displayPersona = mentionedPersona || currentPersona;
  const personaColor = getPersonaColor(displayPersona);
  const shimmerColors = getPersonaShimmerColors(displayPersona);
  const contentEndRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  // Get persona-specific colors for reasoning display
  const getPersonaReasoningColors = (persona: keyof typeof AI_PERSONAS) => {
    switch (persona) {
      case 'girlie':
        return {
          gradient: 'from-pink-950/90 to-pink-900/90',
          border: 'border-pink-500/20',
          shadow: 'shadow-[0_0_30px_rgba(236,72,153,0.2)]'
        };
      case 'pro':
        return {
          gradient: 'from-cyan-950/90 to-cyan-900/90',
          border: 'border-cyan-500/20',
          shadow: 'shadow-[0_0_30px_rgba(34,211,238,0.2)]'
        };
      default:
        return {
          gradient: 'from-purple-950/90 to-purple-900/90',
          border: 'border-purple-500/20',
          shadow: 'shadow-[0_0_30px_rgba(168,85,247,0.2)]'
        };
    }
  };

  const reasoningColors = getPersonaReasoningColors(displayPersona);

  // Handle image generation detection
  useEffect(() => {
    // Check if we have a complete image link
    if (content.includes('![Image](https://enter.pollinations.ai/')) {
      const imageRegex = /!\[Image\]\(https:\/\/enter\.pollinations\.ai\/api\/generate\/image\/[^)]+\)/g;
      const matches = content.match(imageRegex);
      
      if (matches) {
        // Complete image markdown found, show generating state briefly
        setIsGeneratingImage(true);
        setTimeout(() => {
          setIsGeneratingImage(false);
        }, 1500);
      }
    }
  }, [content]);

  // Handle audio URL detection and loading
  useEffect(() => {
    if (audioUrl && !content) {
      setIsRecordingVoice(true);
      // The audio will load automatically in AudioPlayerBubble
      // We can remove the recording state once content is available or after a timeout
      const timeout = setTimeout(() => {
        setIsRecordingVoice(false);
      }, 3000);
      
      return () => clearTimeout(timeout);
    } else if (audioUrl && content) {
      setIsRecordingVoice(false);
    }
  }, [audioUrl, content]);
  const MarkdownComponents = {
    h1: ({ children }: { children: React.ReactNode }) => (
      <h1 className={`text-2xl font-bold mt-6 mb-4 ${theme.text}`}>{children}</h1>
    ),
    h2: ({ children }: { children: React.ReactNode }) => (
      <h2 className={`text-xl font-bold mt-5 mb-3 ${theme.text}`}>{children}</h2>
    ),
    h3: ({ children }: { children: React.ReactNode }) => (
      <h3 className={`text-lg font-bold mt-4 mb-2 ${theme.text}`}>{children}</h3>
    ),
    p: ({ children }: { children: React.ReactNode }) => (
      <p className={`mb-4 leading-relaxed ${theme.text}`}>{children}</p>
    ),
    strong: ({ children }: { children: React.ReactNode }) => (
      <strong className={`font-bold ${personaColor}`}>{children}</strong>
    ),
    em: ({ children }: { children: React.ReactNode }) => (
      <em className={`italic opacity-80 ${theme.text}`}>{children}</em>
    ),
    ul: ({ children }: { children: React.ReactNode }) => (
      <ul className="list-disc ml-4 mb-4 space-y-2">{children}</ul>
    ),
    ol: ({ children }: { children: React.ReactNode }) => (
      <ol className="list-decimal ml-4 mb-4 space-y-2">{children}</ol>
    ),
    li: ({ children }: { children: React.ReactNode }) => (
      <li className={`leading-relaxed ${theme.text}`}>{children}</li>
    ),
    blockquote: ({ children }: { children: React.ReactNode }) => (
      <blockquote className={`border-l-4 border-purple-500/50 pl-4 my-4 italic opacity-70 ${theme.text}`}>
        {children}
      </blockquote>
    ),
    code: ({ children }: { children: React.ReactNode }) => (
      <code className={`bg-white/10 rounded px-1.5 py-0.5 text-sm font-mono ${theme.text}`}>
        {children}
      </code>
    ),
    pre: ({ children }: { children: React.ReactNode }) => (
      <pre className={`bg-white/10 rounded-lg p-4 mb-4 overflow-x-auto font-mono text-sm ${theme.text}`}>
        {children}
      </pre>
    ),
    img: ({ src, alt }: { src?: string; alt?: string }) => {
      // Check if this is a Pollinations.ai generated image
      if (src && src.includes('enter.pollinations.ai')) {
        return <GeneratedImage src={src} alt={alt || 'Generated image'} />;
      }
      
      // Fallback to regular image for other sources
      return (
        <img 
          src={src} 
          alt={alt} 
          className="max-w-full h-auto rounded-xl my-4"
          loading="lazy"
        />
      );
    },
  };

  const MessageContent = () => (
    <>
      {reasoning && (
        <div className="w-full max-w-4xl mx-auto mb-6">
          <motion.button
            onClick={() => setShowReasoning(!showReasoning)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full
              bg-gradient-to-r ${reasoningColors.gradient.replace('/90', '/20')}
              backdrop-blur-xl border ${reasoningColors.border}
              ${reasoningColors.shadow}
              hover:${reasoningColors.shadow.replace('0.2', '0.4')}
              transition-all duration-300
              mx-auto
              relative
              group
              animate-border-glow
              cursor-pointer`}
          >
            <div className="relative z-10 flex items-center gap-2">
              <Brain className="w-4 h-4" />
              <span className={`text-sm italic ${theme.text}`}>Thought to provide a better answer</span>
            </div>
          </motion.button>

          <AnimatePresence>
            {showReasoning && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`mt-2 p-4 relative
                  bg-gradient-to-r ${reasoningColors.gradient}
                  backdrop-blur-xl rounded-lg border ${reasoningColors.border}
                  ${reasoningColors.shadow}`}
              >
                <button
                  onClick={() => setShowReasoning(false)}
                  className="absolute top-2 right-2 p-1 rounded-full
                    bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4 text-white/80" />
                </button>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  components={MarkdownComponents}
                  className={`text-sm ${theme.text}`}
                >
                  {reasoning}
                </ReactMarkdown>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Generating image state */}
      {isGeneratingImage && (
        <div className="w-full max-w-2xl mx-auto my-4">
          <div className="flex items-center justify-center py-4 px-4 rounded-2xl bg-black/5 backdrop-blur-sm">
            <AnimatedShinyText
              text="Generating Image"
              useShimmer={true}
              baseColor={shimmerColors.baseColor}
              shimmerColor={shimmerColors.shimmerColor}
              gradientAnimationDuration={2}
              textClassName="text-base"
              className="py-1"
              style={{ 
                fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
                fontSize: '16px'
              }}
            />
          </div>
        </div>
      )}

      {/* Recording voice state */}
      {isRecordingVoice && (
        <div className="w-full max-w-2xl mx-auto my-4">
          <div className="flex items-center justify-center py-4 px-4 rounded-2xl bg-black/5 backdrop-blur-sm">
            <AnimatedShinyText
              text="Recording voice"
              useShimmer={true}
              baseColor={shimmerColors.baseColor}
              shimmerColor={shimmerColors.shimmerColor}
              gradientAnimationDuration={2}
              textClassName="text-base"
              className="py-1"
              style={{ 
                fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
                fontSize: '16px'
              }}
            />
          </div>
        </div>
      )}

      {/* Display audio response if present */}
      {audioUrl && !isRecordingVoice && (
        <div className="w-full max-w-2xl mx-auto my-4">
          <div className="flex flex-col gap-1">
            <div className={`text-xs font-medium ${personaColor} opacity-60`}>
              {AI_PERSONAS[displayPersona].name}
            </div>
            <AudioPlayerBubble
              audioSrc={audioUrl}
              isUserMessage={false}
              className="max-w-full"
              currentPersona={displayPersona}
            />
          </div>
        </div>
      )}
      {/* Show content when not generating or when generation is complete */}
      {!isGeneratingImage && !isRecordingVoice && (content || isStreamingActive) && !audioUrl && (
        <>
          {isChatMode ? (
            <div className="flex flex-col gap-1">
              <div className={`text-xs font-medium ${personaColor} opacity-60`}>
                {AI_PERSONAS[displayPersona].name}
                {isStreamingActive && (
                  <span className="ml-2 inline-flex items-center">
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="w-2 h-2 bg-current rounded-full"
                    />
                  </span>
                )}
              </div>
              <div className={`${theme.text} text-base leading-relaxed max-w-[85%]`}>
                {content ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={MarkdownComponents}
                    className="prose prose-invert prose-sm max-w-none"
                  >
                    {content}
                  </ReactMarkdown>
                ) : isStreamingActive ? (
                  <div className="flex items-center gap-2 text-sm opacity-60">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                    />
                    Thinking...
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className={`${theme.text} ${
              isChatMode 
                ? 'text-base sm:text-lg' 
                : 'text-xl sm:text-2xl md:text-3xl'
            } w-full max-w-4xl mx-auto text-center`}>
              {content ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  components={MarkdownComponents}
                  className="prose prose-invert max-w-none"
                >
                  {content}
                </ReactMarkdown>
              ) : isStreamingActive ? (
                <div className="flex items-center justify-center gap-3 text-lg opacity-60">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-6 h-6 border-2 border-current border-t-transparent rounded-full"
                  />
                  Thinking...
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
      <div ref={contentEndRef} />
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.6,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      onAnimationComplete={() => !hasAnimated && onAnimationComplete(messageId)}
      className={`w-full`}
    >
      <MessageContent />
    </motion.div>
  );
}
