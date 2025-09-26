import React from 'react';
import { AIMessage } from './AIMessage';
import { UserMessage } from './UserMessage';
import { Message } from '../../types/chat';
import { AI_PERSONAS } from '../../config/constants';

interface ChatMessageProps extends Message {
  isChatMode: boolean;
  onAnimationComplete: (messageId: number) => void;
  currentPersona: keyof typeof AI_PERSONAS;
  isStreaming?: boolean;
  previousMessage?: string | null;
}

export function ChatMessage({ 
  content, 
  thinking, 
  isAI, 
  isChatMode, 
  id, 
  hasAnimated, 
  onAnimationComplete, 
  currentPersona,
  isStreaming,
  previousMessage,
  imageData
}: ChatMessageProps) {
  if (isAI) {
    return (
      <AIMessage 
        content={content} 
        thinking={thinking}
        isChatMode={isChatMode} 
        messageId={id}
        hasAnimated={hasAnimated}
        onAnimationComplete={onAnimationComplete}
        currentPersona={currentPersona}
        isStreaming={isStreaming}
        previousMessage={previousMessage}
      />
    );
  }
  return (
    <UserMessage 
      content={content} 
      imageData={imageData}
    />
  );
}
