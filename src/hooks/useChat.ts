import { useState, useCallback, useEffect, useRef } from 'react';
import { Message } from '../types/chat';
import { generateAIResponse, generateAIResponseStreaming } from '../services/ai/aiProxyService';
import { INITIAL_MESSAGE, AI_PERSONAS } from '../config/constants';

interface ChatSession {
  id: string;
  name: string;
  messages: Message[];
  persona: keyof typeof AI_PERSONAS;
  createdAt: string;
  lastModified: string;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([{ ...INITIAL_MESSAGE, hasAnimated: false }]);
  const [isChatMode, setChatMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPersona, setCurrentPersona] = useState<keyof typeof AI_PERSONAS>('default');
  const [currentProHeatLevel, setCurrentProHeatLevel] = useState<number>(2);
  const [currentEmotion, setCurrentEmotion] = useState<string>('joy');
  const [error, setError] = useState<string | null>(null);
  const [showAboutUs, setShowAboutUs] = useState(false);
  const [showRateLimitModal, setShowRateLimitModal] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null);
  const [useStreaming, setUseStreaming] = useState(true); // Toggle for streaming vs non-streaming

  // Set theme based on persona
  const setPersonaTheme = useCallback((persona: keyof typeof AI_PERSONAS) => {
    let themeToSet: string;
    
    switch (persona) {
      case 'girlie':
        themeToSet = 'springDark';
        break;
      case 'pro':
        themeToSet = 'summerDark';
        break;
      default:
        themeToSet = 'autumnDark';
    }
    
    window.dispatchEvent(new CustomEvent('themeChange', { detail: themeToSet }));
  }, []);

  // Save chat session function
  const saveChatSession = useCallback((sessionId: string, messagesToSave: Message[], persona: keyof typeof AI_PERSONAS) => {
    // Save all chat sessions, even short ones

    try {
      const chatSessions = JSON.parse(localStorage.getItem('chatSessions') || '[]') as ChatSession[];
      const now = new Date().toISOString();

      const existingSessionIndex = chatSessions.findIndex(session => session.id === sessionId);

      if (existingSessionIndex !== -1) {
        // Update existing session
        chatSessions[existingSessionIndex] = {
          ...chatSessions[existingSessionIndex],
          messages: messagesToSave,
          lastModified: now
        };
      } else {
        // Create new session
        const firstUserMessage = messagesToSave.find(msg => !msg.isAI);
        let sessionName = 'New Chat';

        if (firstUserMessage) {
          // Use content if available, otherwise check for image or audio
          if (firstUserMessage.content && firstUserMessage.content.trim() && firstUserMessage.content !== '[Image message]' && firstUserMessage.content !== '[Audio message]') {
            sessionName = firstUserMessage.content.slice(0, 50);
          } else if (firstUserMessage.imageData || (firstUserMessage.inputImageUrls && firstUserMessage.inputImageUrls.length > 0)) {
            sessionName = 'Image message';
          } else if (firstUserMessage.audioData) {
            sessionName = 'Audio message';
          }
        }

        const newSession: ChatSession = {
          id: sessionId,
          name: sessionName,
          messages: messagesToSave,
          persona,
          createdAt: now,
          lastModified: now
        };
        chatSessions.push(newSession);
      }

      localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
    } catch (error) {
      console.error('Failed to save chat session:', error);
    }
  }, []);

  // Handle persona change
  const handlePersonaChange = useCallback((persona: keyof typeof AI_PERSONAS) => {
    // Save current session before switching
    if (currentSessionId && messages.length > 1) {
      saveChatSession(currentSessionId, messages, currentPersona);
    }

    setCurrentPersona(persona);
    
    // Reset heat level to 2 when switching to pro persona
    if (persona === 'pro') {
      setCurrentProHeatLevel(2);
    }
    
    setError(null);
    
    // Start new chat with new persona
    const newSessionId = Date.now().toString();
    setCurrentSessionId(newSessionId);
    
    const initialMessage = cleanContent(AI_PERSONAS[persona].initialMessage);
    setMessages([{
      id: Date.now(),
      content: initialMessage,
      isAI: true,
      hasAnimated: false
    }]);
    
    // Set theme based on the new persona
    setPersonaTheme(persona);
  }, [currentSessionId, messages, currentPersona, saveChatSession, setPersonaTheme]);

  // Start new chat function
  const startNewChat = useCallback(() => {
    // Save current session before starting new one
    if (currentSessionId && messages.length > 1) {
      saveChatSession(currentSessionId, messages, currentPersona);
    }

    // Start fresh chat with same persona
    const newSessionId = Date.now().toString();
    setCurrentSessionId(newSessionId);
    
    const initialMessage = cleanContent(AI_PERSONAS[currentPersona].initialMessage);
    setMessages([{
      id: Date.now(),
      content: initialMessage,
      isAI: true,
      hasAnimated: false
    }]);
    
    setError(null);
  }, [currentSessionId, messages, currentPersona, saveChatSession]);

  // Handle streaming message updates
  const updateStreamingMessage = useCallback((messageId: number, content: string, append: boolean = true) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, content: append ? msg.content + content : content }
        : msg
    ));
  }, []);

  // Complete streaming message
  const completeStreamingMessage = useCallback((messageId: number, finalContent: string, thinking?: string, audioUrl?: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, content: finalContent, thinking, audioUrl, hasAnimated: false }
        : msg
    ));
    setStreamingMessageId(null);
    setIsLoading(false);
  }, []);

  const extractEmotion = (content: string): string | null => {
    const match = content.match(/<emotion>([a-z]+)<\/emotion>/i);
    if (!match) return null;
    
    const emotion = match[1].toLowerCase();
    const validEmotions = [
      'sadness', 'joy', 'love', 'excitement', 'anger',
      'motivation', 'jealousy', 'relaxation', 'anxiety', 'hope'
    ];
    
    return validEmotions.includes(emotion) ? emotion : 'joy';
  };

  const cleanContent = (content: string): string => {
    const emotion = extractEmotion(content);
    if (emotion) {
      return content.replace(/<emotion>[a-z]+<\/emotion>/i, '').replace(/<reason>[\s\S]*?<\/reason>/i, '').trim();
    }
    return content.replace(/<reason>[\s\S]*?<\/reason>/i, '').trim();
  };

  // Dismiss rate limit modal
  const dismissRateLimitModal = useCallback(() => {
    setShowRateLimitModal(false);
  }, []);

  // Save chat session when messages change (but not on initial load)
  useEffect(() => {
    if (messages.length > 1 && currentSessionId) {
      saveChatSession(currentSessionId, messages, currentPersona);
    }
  }, [messages, currentSessionId, currentPersona, saveChatSession]);

  // Initialize session ID on first load
  useEffect(() => {
    if (!currentSessionId) {
      setCurrentSessionId(Date.now().toString());
    }
  }, [currentSessionId]);

  const handleSendMessage = useCallback(async (content: string, imageData?: string | string[], audioData?: string, inputImageUrls?: string[]) => {
    let messagePersona = currentPersona;
    let messageContent = content;

    // Check for @persona mentions (case-insensitive)
    const mentionMatch = content.match(/^@(chatgpt|gemini|claude|grok|girlie|pro)\s+(.+)$/i);
    if (mentionMatch) {
      const mentionedModel = mentionMatch[1].toLowerCase();
      messagePersona = mentionedModel as keyof typeof AI_PERSONAS;
      messageContent = mentionMatch[2];
    }

    // Handle audio/image data - if we have audio/images but no text content, create a message indicating the input type
    let finalContent = messageContent;
    if (audioData && !messageContent.trim()) {
      finalContent = '[Audio message]'; // Placeholder text for UI
    } else if ((imageData || (inputImageUrls && inputImageUrls.length > 0)) && !messageContent.trim()) {
      finalContent = '[Image message]'; // Placeholder text for UI
    }

    // Create user message with content for display
    // Use finalContent if it's a placeholder for image/audio-only messages, otherwise keep original content
    const displayContent = (finalContent === '[Image message]' || finalContent === '[Audio message]') ? finalContent : content;
    const userMessage: Message = {
      id: Date.now(),
      content: displayContent, // Use placeholder for image/audio-only, otherwise original content
      isAI: false,
      hasAnimated: false,
      imageData: imageData,
      audioData: audioData,
      inputImageUrls: inputImageUrls
    };

    // Create API message with cleaned content (without @mention) for API call
    const apiUserMessage: Message = {
      id: Date.now(),
      content: finalContent,
      isAI: false,
      hasAnimated: false,
      imageData: imageData,
      audioData: audioData,
      inputImageUrls: inputImageUrls
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    // Create placeholder AI message for streaming
    const aiMessageId = Date.now() + 1;
    const aiMessage: Message = {
      id: aiMessageId,
      content: '',
      isAI: true,
      hasAnimated: false
    };

    setMessages(prev => [...prev, aiMessage]);
    setStreamingMessageId(aiMessageId);

    // Filter out initial welcome message (ID: 1) - it's just for UI aesthetics
    const apiMessages = [...messages, apiUserMessage].filter(msg => msg.id !== 1);

    if (useStreaming) {
      // Use streaming response - send API messages (without @mention in content and without initial message)
      generateAIResponseStreaming(
        apiMessages,
        imageData,
        '', // System prompt is now handled server-side
        messagePersona,
        audioData,
        messagePersona === 'pro' ? currentProHeatLevel : undefined,
        inputImageUrls,
        // onChunk callback
        (chunk: string) => {
          updateStreamingMessage(aiMessageId, chunk, true);
        },
        // onComplete callback
        (response) => {
          const emotion = extractEmotion(response.content);
          const cleanedContent = cleanContent(response.content);

          if (emotion) {
            setCurrentEmotion(emotion);
          }

          completeStreamingMessage(aiMessageId, cleanedContent, response.thinking, response.audioUrl);
        },
        // onError callback
        (error) => {
          console.error('Failed to generate streaming response:', error);

          // Check if it's a rate limit error
          if (error && typeof error === 'object' && 'type' in error && error.type === 'rateLimit') {
            setShowRateLimitModal(true);
          } else {
            setError('Failed to generate response. Please try again.');
          }

          // Remove the placeholder message on error
          setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
          setStreamingMessageId(null);
          setIsLoading(false);
        }
      );
    } else {
      // Use non-streaming response (fallback) - send API messages (without @mention in content and without initial message)
      try {
        const aiResponse = await generateAIResponse(
          apiMessages,
          imageData,
          '', // System prompt is now handled server-side
          messagePersona,
          audioData,
          messagePersona === 'pro' ? currentProHeatLevel : undefined,
          inputImageUrls
        );
        
        const emotion = extractEmotion(aiResponse.content);
        const cleanedContent = cleanContent(aiResponse.content);
        
        if (emotion) {
          setCurrentEmotion(emotion);
        }

        completeStreamingMessage(aiMessageId, cleanedContent, aiResponse.thinking, aiResponse.audioUrl);
      } catch (error) {
        console.error('Failed to generate response:', error);
        
        // Check if it's a rate limit error
        if (error && typeof error === 'object' && 'type' in error && error.type === 'rateLimit') {
          setShowRateLimitModal(true);
        } else {
          setError('Failed to generate response. Please try again.');
        }
        
        // Remove the placeholder message on error
        setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
        setStreamingMessageId(null);
        setIsLoading(false);
      }
    }
  }, [messages, currentPersona, currentProHeatLevel]);

  const markMessageAsAnimated = useCallback((messageId: number) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, hasAnimated: true } : msg
    ));
  }, []);

  const dismissAboutUs = useCallback(() => {
    setShowAboutUs(false);
  }, []);

  const loadChat = useCallback((session: ChatSession) => {
    // Save current session before loading new one
    if (currentSessionId && messages.length > 1) {
      saveChatSession(currentSessionId, messages, currentPersona);
    }

    setCurrentPersona(session.persona);
    setMessages(session.messages);
    setChatMode(true);
    setCurrentSessionId(session.id);
    setPersonaTheme(session.persona);
  }, [currentSessionId, messages, currentPersona, saveChatSession, setPersonaTheme]);

  return {
    messages,
    isChatMode,
    isLoading,
    currentPersona,
    currentProHeatLevel,
    currentEmotion,
    error,
    showAboutUs,
    showRateLimitModal,
    streamingMessageId,
    useStreaming,
    setChatMode,
    handleSendMessage,
    handlePersonaChange,
    setCurrentProHeatLevel,
    startNewChat,
    markMessageAsAnimated,
    dismissAboutUs,
    dismissRateLimitModal,
    loadChat,
    setUseStreaming
  };
}
