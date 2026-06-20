import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Reply, Smile, CornerDownRight } from 'lucide-react';
import { AIMessage } from './AIMessage';
import { UserMessage } from './UserMessage';
import { Message } from '../../types/chat';
import { AI_PERSONAS } from '../../config/constants';
import { BrandOverride } from '../brand/BrandLogo';
import type { SavedVariation } from './MusicComposeCard';

interface ChatMessageProps extends Message {
  isChatMode: boolean;
  onAnimationComplete: (messageId: number) => void;
  currentPersona: keyof typeof AI_PERSONAS;
  previousMessage?: string | null;
  isStreaming?: boolean;
  streamingMessageId?: number | null;
  loadingPhase?: 'analyzing_photo' | 'thinking' | null;
  isGroupMode?: boolean;
  currentUserId?: string;
  onReply?: (message: { id: number; content: string; sender_nickname?: string; isAI: boolean }) => void;
  onReact?: (messageId: number, emoji: string) => void;
  brandOverride?: BrandOverride;
  onMusicVariationsChange?: (messageId: number, variations: SavedVariation[]) => void;
}

// Quick react emoji options
const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

export function ChatMessage({
  content,
  thinking,
  rawContent,
  isAI,
  isChatMode,
  id,
  hasAnimated,
  onAnimationComplete,
  currentPersona,
  previousMessage,
  imageData,
  audioData,
  audioUrl,
  inputImageUrls,
  pdfFileName,
  isStreaming,
  streamingMessageId,
  loadingPhase,
  isGroupMode,
  currentUserId,
  sender_id,
  sender_nickname,
  sender_avatar,
  replyTo,
  reactions,
  specialMode,
  onReply,
  onReact,
  brandOverride,
  musicVariations,
  onMusicVariationsChange
}: ChatMessageProps) {
  const [showActions, setShowActions] = useState(false);
  const [actionsLocked, setActionsLocked] = useState(false); // For mobile click-to-lock
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // In group mode, check if this message is from another user
  const isOtherUserMessage = isGroupMode && !isAI && sender_id && sender_id !== currentUserId;
  const isOwnMessage = !isAI && (!sender_id || sender_id === currentUserId);

  // Close actions/emoji picker when clicking outside
  useEffect(() => {
    if (!actionsLocked && !showEmojiPicker) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActionsLocked(false);
        setShowActions(false);
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [actionsLocked, showEmojiPicker]);

  const handleClick = () => {
    if (!isGroupMode || !onReply) return;
    // Toggle lock state on click (for mobile)
    if (actionsLocked) {
      setActionsLocked(false);
      setShowActions(false);
      setShowEmojiPicker(false);
    } else {
      setActionsLocked(true);
      setShowActions(true);
    }
  };

  const handleMouseEnter = () => {
    if (!actionsLocked) {
      setShowActions(true);
    }
  };

  const handleMouseLeave = () => {
    // Don't close if emoji picker is open or actions are locked
    if (!actionsLocked && !showEmojiPicker) {
      setShowActions(false);
    }
  };

  const handleReply = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onReply) {
      onReply({
        id,
        content: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
        sender_nickname: isAI ? 'TimeMachine' : sender_nickname,
        isAI
      });
    }
    setActionsLocked(false);
    setShowActions(false);
  };

  const handleReact = (emoji: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onReact) {
      onReact(id, emoji);
    }
    setShowEmojiPicker(false);
    setActionsLocked(false);
    setShowActions(false);
  };

  const toggleEmojiPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newValue = !showEmojiPicker;
    setShowEmojiPicker(newValue);
    // Keep actions visible while emoji picker is open
    if (newValue) {
      setShowActions(true);
    }
  };

  // Render reply preview if this message is replying to another
  const renderReplyPreview = () => {
    if (!replyTo) return null;

    return (
      <div className={`flex items-start gap-2 mb-2 px-3 py-2 rounded-lg bg-white/5 border-l-2 border-purple-500/50 text-sm max-w-[85%] ${isOwnMessage ? 'ml-auto' : ''}`}>
        <CornerDownRight className="w-3 h-3 text-white/40 mt-1 flex-shrink-0" />
        <div className="min-w-0">
          <span className="text-purple-400 text-xs font-medium">
            {replyTo.isAI ? 'TimeMachine' : replyTo.sender_nickname || 'User'}
          </span>
          <p className="text-white/50 text-xs truncate">{replyTo.content}</p>
        </div>
      </div>
    );
  };

  // Render reactions if any
  const renderReactions = () => {
    if (!reactions || Object.keys(reactions).length === 0) return null;

    return (
      <div className={`flex flex-wrap gap-1 mt-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
        {Object.entries(reactions).map(([emoji, userIds]) => (
          <button
            key={emoji}
            onClick={(e) => handleReact(emoji, e)}
            className="px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-xs flex items-center gap-1 transition-colors"
          >
            <span>{emoji}</span>
            <span className="text-white/60">{userIds.length}</span>
          </button>
        ))}
      </div>
    );
  };

  // Render action buttons (positioned absolutely to avoid layout shift)
  const renderActions = () => {
    if (!isGroupMode || !onReply) return null;

    return (
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute -bottom-8 ${isOwnMessage ? 'right-0' : 'left-0'} flex items-center gap-1 z-10`}
          >
            <button
              onClick={handleReply}
              className="p-1.5 rounded-md bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white/50 hover:text-white transition-colors"
              title="Reply"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>
            <div className="relative">
              <button
                onClick={toggleEmojiPicker}
                className="p-1.5 rounded-md bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white/50 hover:text-white transition-colors"
                title="React"
              >
                <Smile className="w-3.5 h-3.5" />
              </button>
              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className={`absolute bottom-full mb-2 ${isOwnMessage ? 'right-0' : 'left-0'} bg-black/80 backdrop-blur-xl rounded-lg p-2 border border-white/10 flex gap-1 z-20`}
                  >
                    {QUICK_REACTIONS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={(e) => handleReact(emoji, e)}
                        className="p-1.5 rounded hover:bg-white/10 text-lg transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  if (isAI) {
    return (
      <div
        ref={containerRef}
        className="relative cursor-pointer"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {renderReplyPreview()}
        <AIMessage
          content={content}
          thinking={thinking}
          rawContent={rawContent}
          isChatMode={isChatMode}
          messageId={id}
          hasAnimated={hasAnimated}
          onAnimationComplete={onAnimationComplete}
          currentPersona={currentPersona}
          previousMessage={previousMessage}
          isStreaming={isStreaming}
          audioUrl={audioUrl}
          isStreamingActive={streamingMessageId === id}
          loadingPhase={streamingMessageId === id ? loadingPhase : undefined}
          specialMode={specialMode}
          brandOverride={brandOverride}
          musicVariations={musicVariations}
          onMusicVariationsChange={onMusicVariationsChange}
        />
        {renderReactions()}
        {renderActions()}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative cursor-pointer"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {renderReplyPreview()}
      <UserMessage
        content={content}
        imageData={imageData}
        audioData={audioData}
        inputImageUrls={inputImageUrls}
        pdfFileName={pdfFileName}
        sender_nickname={isOtherUserMessage ? sender_nickname : undefined}
        sender_avatar={isOtherUserMessage ? sender_avatar : undefined}
        isGroupMode={isGroupMode}
      />
      {renderReactions()}
      {renderActions()}
    </div>
  );
}
