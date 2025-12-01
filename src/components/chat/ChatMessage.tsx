import React from 'react';
import { AIMessage } from './AIMessage';
import { UserMessage } from './UserMessage';
import { Message } from '../../types/chat';
import { AI_PERSONAS } from '../../config/constants';

interface ChatMessageProps extends Message {
  isChatMode: boolean;
  onAnimationComplete: (messageId: number) => void;
  currentPersona: keyof typeof AI_PERSONAS;
  previousMessage?: string | null;
  isStreaming?: boolean;
  streamingMessageId?: number | null;
  aiModel?: 'chatgpt' | 'gemini' | 'claude' | 'grok';
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
  previousMessage,
  imageData,
  audioData,
  audioUrl,
  isStreaming,
  streamingMessageId,
  aiModel
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
        previousMessage={previousMessage}
        isStreaming={isStreaming}
        audioUrl={audioUrl}
        isStreamingActive={streamingMessageId === id}
        aiModel={aiModel}
      />
    );
  }
  return (
    <UserMessage 
      content={content} 
      imageData={imageData}
      audioData={audioData}
    />
  );
}
