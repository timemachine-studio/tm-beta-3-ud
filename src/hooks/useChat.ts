import { useState, useCallback, useEffect, useRef } from 'react';
import { Message, ImageDimensions, MusicVariation } from '../types/chat';
import { generateAIResponse, generateAIResponseStreaming, YouTubeMusicData, UserMemoryContext } from '../services/ai/aiProxyService';
import { INITIAL_MESSAGE, AI_PERSONAS } from '../config/constants';
import { chatService, ChatSession } from '../services/chat/chatService';
import { processGeneratedImages } from '../services/image/imageService';
import {
  subscribeToGroupChat,
  sendGroupChatMessage,
  getGroupChat,
  createGroupChat,
  updateGroupChatMusic,
  subscribeToGroupChatMusic,
  getGroupChatMusic
} from '../services/groupChat/groupChatService';
import { GroupChatParticipant } from '../types/groupChat';
import { createVideoMarkdown } from '../services/video/videoService';

// Generate a proper UUID for session IDs
function generateUUID(): string {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Format collaborative messages as dialogue for AI context
// Bundles consecutive user messages between AI responses
function formatMessagesAsDialogue(messages: Message[]): Message[] {
  const formatted: Message[] = [];
  let userMessagesBuffer: Message[] = [];

  for (const msg of messages) {
    if (msg.isAI) {
      // If we have buffered user messages, bundle them
      if (userMessagesBuffer.length > 0) {
        const dialogueContent = userMessagesBuffer
          .map(m => {
            const sender = m.senderNickname || 'User';
            return `[${sender}]: ${m.content}`;
          })
          .join('\n');

        formatted.push({
          ...userMessagesBuffer[userMessagesBuffer.length - 1],
          content: dialogueContent,
        });
        userMessagesBuffer = [];
      }
      // Add AI message as-is
      formatted.push(msg);
    } else {
      // Buffer user messages
      userMessagesBuffer.push(msg);
    }
  }

  // Handle remaining buffered user messages
  if (userMessagesBuffer.length > 0) {
    const dialogueContent = userMessagesBuffer
      .map(m => {
        const sender = m.senderNickname || 'User';
        return `[${sender}]: ${m.content}`;
      })
      .join('\n');

    formatted.push({
      ...userMessagesBuffer[userMessagesBuffer.length - 1],
      content: dialogueContent,
    });
  }

  return formatted;
}

export function useChat(
  userId?: string | null,
  userProfile?: { nickname?: string | null; about_me?: string | null },
  initialPersona?: keyof typeof AI_PERSONAS,
  authLoading?: boolean,
  initialSession?: { messages: Message[]; id: string; heat_level?: number } | null
) {
  // Start with empty state - will be initialized once we know the persona
  // Unless we have an initialSession (loading from history)
  const [messages, setMessages] = useState<Message[]>(initialSession?.messages || []);
  const [isChatMode, setChatMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPersona, setCurrentPersona] = useState<keyof typeof AI_PERSONAS>(initialPersona || 'default');
  // If initialSession provided, we're already initialized
  const [isInitialized, setIsInitialized] = useState(!!initialSession);
  const [currentProHeatLevel, setCurrentProHeatLevel] = useState<number>(initialSession?.heat_level || 2);
  const [currentEmotion, setCurrentEmotion] = useState<string>('joy');
  const [error, setError] = useState<string | null>(null);
  const [showAboutUs, setShowAboutUs] = useState(false);
  const [showRateLimitModal, setShowRateLimitModal] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>(initialSession?.id || '');
  const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null);
  const [useStreaming, setUseStreaming] = useState(true);
  const [youtubeMusic, setYoutubeMusic] = useState<YouTubeMusicData | null>(null);
  // Track loading phase for image pipeline UX: 'analyzing_photo' | 'thinking' | null
  const [loadingPhase, setLoadingPhase] = useState<'analyzing_photo' | 'thinking' | null>(null);
  // Pending remote music - music received from group chat that needs user action to play
  const [pendingRemoteMusic, setPendingRemoteMusic] = useState<YouTubeMusicData | null>(null);
  // PDF: cached extracted text for follow-up questions in this session
  const [activePdfText, setActivePdfText] = useState<string | null>(null);

  // Collaborative mode state
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [collaborativeId, setCollaborativeId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<GroupChatParticipant[]>([]);
  const collaborativeUnsubscribeRef = useRef<(() => void) | null>(null);
  const musicUnsubscribeRef = useRef<(() => void) | null>(null);
  // Track current local music to avoid showing "Play for me too" for own music
  const currentMusicVideoIdRef = useRef<string | null>(null);

  // Track if save is pending to debounce
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track if streaming is in progress - don't save during streaming (AI message is incomplete)
  const isStreamingRef = useRef<boolean>(false);

  // Update chatService with userId when it changes
  useEffect(() => {
    chatService.setUserId(userId || null);
  }, [userId]);

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

  // Save chat session function - uses chatService which handles both local and Supabase
  const saveChatSession = useCallback((sessionId: string, messagesToSave: Message[], persona: keyof typeof AI_PERSONAS, forceImmediate: boolean = false) => {
    // Don't save while streaming is in progress (AI message is incomplete/empty)
    if (isStreamingRef.current && !forceImmediate) {
      return;
    }

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const doSave = async () => {
      try {
        const now = new Date().toISOString();
        const firstUserMessage = messagesToSave.find(msg => !msg.isAI);
        let sessionName = 'New Chat';

        if (firstUserMessage) {
          if (firstUserMessage.content && firstUserMessage.content.trim() &&
            firstUserMessage.content !== '[Image message]' && firstUserMessage.content !== '[Audio message]' && !firstUserMessage.content.startsWith('[PDF:')) {
            sessionName = firstUserMessage.content.slice(0, 50);
          } else if (firstUserMessage.imageData || (firstUserMessage.inputImageUrls && firstUserMessage.inputImageUrls.length > 0)) {
            sessionName = 'Image message';
          } else if (firstUserMessage.audioData) {
            sessionName = 'Audio message';
          } else if (firstUserMessage.pdfFileName) {
            sessionName = `PDF: ${firstUserMessage.pdfFileName}`;
          }
        }

        const session: ChatSession = {
          id: sessionId,
          name: sessionName,
          messages: messagesToSave,
          persona,
          heat_level: persona === 'pro' ? currentProHeatLevel : undefined,
          createdAt: now,
          lastModified: now
        };

        await chatService.saveSession(session);
      } catch (error) {
        console.error('Failed to save chat session:', error);
      }
    };

    if (forceImmediate) {
      // Save immediately without debounce (used when switching sessions)
      doSave();
    } else {
      // Debounce saves to avoid too many requests
      saveTimeoutRef.current = setTimeout(doSave, 500);
    }
  }, [currentProHeatLevel]);

  // Handle persona change
  const handlePersonaChange = useCallback((persona: keyof typeof AI_PERSONAS) => {
    // Cancel any pending saves to avoid race conditions
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    // Save current session immediately before switching (only if not streaming)
    if (currentSessionId && messages.length > 1 && !isStreamingRef.current) {
      saveChatSession(currentSessionId, messages, currentPersona, true); // Force immediate save
    }

    // Clear streaming state if somehow still set
    isStreamingRef.current = false;
    setStreamingMessageId(null);
    setIsLoading(false);

    setCurrentPersona(persona);

    // Reset heat level to 2 when switching to pro persona
    if (persona === 'pro') {
      setCurrentProHeatLevel(2);
    }

    setError(null);
    setActivePdfText(null); // Clear PDF context on persona switch

    // Start new chat with new persona
    const newSessionId = generateUUID();
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
    // Cancel any pending saves to avoid race conditions
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    // Save current session immediately before starting new one (only if not streaming)
    if (currentSessionId && messages.length > 1 && !isStreamingRef.current) {
      saveChatSession(currentSessionId, messages, currentPersona, true); // Force immediate save
    }

    // Clear streaming state if somehow still set
    isStreamingRef.current = false;
    setStreamingMessageId(null);
    setIsLoading(false);

    // Start fresh chat with same persona
    const newSessionId = generateUUID();
    setCurrentSessionId(newSessionId);
    setActivePdfText(null); // Clear PDF context on new chat

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
  const completeStreamingMessage = useCallback(async (messageId: number, finalContent: string, thinking?: string, audioUrl?: string) => {
    let processedContent = finalContent;

    // If user is logged in and content has generated images, upload them to Supabase
    if (userId && finalContent.includes('![Generated Image](/api/image?')) {
      try {
        processedContent = await processGeneratedImages(finalContent, userId);
      } catch (error) {
        console.error('Failed to process generated images:', error);
      }
    }

    // Update the message with final content
    setMessages(prev => {
      const updatedMessages = prev.map(msg =>
        msg.id === messageId
          ? { ...msg, content: processedContent, thinking, audioUrl, hasAnimated: false }
          : msg
      );

      // Force immediate save after streaming completes to prevent data loss
      // This is critical - debounced saves can be cancelled if user navigates away
      if (currentSessionId && !isCollaborative) {
        // Use setTimeout(0) to ensure this runs after state update is applied
        setTimeout(() => {
          saveChatSession(currentSessionId, updatedMessages, currentPersona, true);
        }, 0);
      }

      return updatedMessages;
    });

    setStreamingMessageId(null);
    setIsLoading(false);
    isStreamingRef.current = false; // Mark streaming as complete

    // If in collaborative mode, sync AI message to group_chat_messages table
    if (isCollaborative && collaborativeId && userId && userProfile?.nickname) {
      sendGroupChatMessage(
        collaborativeId,
        processedContent,
        userId, // owner sends on behalf of AI
        userProfile.nickname,
        undefined, // avatar
        true, // isAI
        undefined, // images
        audioUrl,
        thinking
      );
    }
  }, [userId, isCollaborative, collaborativeId, userProfile, currentSessionId, currentPersona, saveChatSession]);

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

  // Clear YouTube music
  const clearYoutubeMusic = useCallback(() => {
    setYoutubeMusic(null);
    // If in collaborative mode, also clear group music
    if (isCollaborative && collaborativeId) {
      updateGroupChatMusic(collaborativeId, null);
    }
  }, [isCollaborative, collaborativeId]);

  // Sync music to group chat when it changes in collaborative mode
  useEffect(() => {
    // Sync local music to database so other participants can see it
    if (isCollaborative && collaborativeId && youtubeMusic) {
      updateGroupChatMusic(collaborativeId, {
        videoId: youtubeMusic.videoId,
        title: youtubeMusic.title,
        artist: youtubeMusic.artist
      });
    }
  }, [isCollaborative, collaborativeId, youtubeMusic]);

  // Keep ref in sync with youtubeMusic state for subscription callbacks
  useEffect(() => {
    currentMusicVideoIdRef.current = youtubeMusic?.videoId || null;
  }, [youtubeMusic]);

  // Save chat session when messages change (but not on initial load, and not during streaming)
  useEffect(() => {
    // Don't auto-save if:
    // - Only 1 message (initial state)
    // - No session ID
    // - Currently streaming (AI message is incomplete)
    // - In collaborative mode (messages are stored in group_chat_messages table)
    if (messages.length > 1 && currentSessionId && !isStreamingRef.current && !isCollaborative) {
      saveChatSession(currentSessionId, messages, currentPersona);
    }
  }, [messages, currentSessionId, currentPersona, saveChatSession, isCollaborative]);

  // Initialize session ID on first load
  useEffect(() => {
    if (!currentSessionId) {
      setCurrentSessionId(generateUUID());
    }
  }, [currentSessionId]);

  // Set theme when loaded from initial session (history)
  useEffect(() => {
    if (initialSession && initialPersona) {
      setPersonaTheme(initialPersona);
    }
  }, []); // Only run once on mount

  // Initialize chat once auth loading is complete
  useEffect(() => {
    // Wait until auth is done loading before initializing
    if (authLoading || isInitialized) return;

    // Now we can safely determine the persona (either from profile or default)
    const persona = initialPersona || 'default';
    // Clean emotion tags from initial message
    const rawMessage = AI_PERSONAS[persona].initialMessage;
    const initialMessage = rawMessage.replace(/<emotion>[a-z]+<\/emotion>/i, '').replace(/<reason>[\s\S]*?<\/reason>/i, '').trim();

    setCurrentPersona(persona);
    setPersonaTheme(persona);
    setMessages([{
      id: Date.now(),
      content: initialMessage,
      isAI: true,
      hasAnimated: false
    }]);
    setIsInitialized(true);
  }, [authLoading, isInitialized, initialPersona, setPersonaTheme]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleSendMessage = useCallback(async (
    content: string,
    imageData?: string | string[],
    audioData?: string,
    inputImageUrls?: string[],
    imageDimensions?: ImageDimensions,
    replyTo?: { id: number; content: string; sender_nickname?: string; isAI: boolean },
    specialMode?: string,
    pdfData?: string,
    pdfFileName?: string
  ) => {
    let messagePersona = currentPersona;
    let messageContent = content;

    // Check for @persona mentions (case-insensitive)
    const mentionMatch = content.match(/^@(chatgpt|gemini|claude|grok|girlie|pro)\s+(.+)$/i);
    if (mentionMatch) {
      const mentionedModel = mentionMatch[1].toLowerCase();
      messagePersona = mentionedModel as keyof typeof AI_PERSONAS;
      messageContent = mentionMatch[2];
    }

    // Handle audio/image/pdf data - if we have audio/images/pdf but no text content, create a message indicating the input type
    let finalContent = messageContent;
    if (audioData && !messageContent.trim()) {
      finalContent = '[Audio message]'; // Placeholder text for UI
    } else if ((imageData || (inputImageUrls && inputImageUrls.length > 0)) && !messageContent.trim()) {
      finalContent = '[Image message]'; // Placeholder text for UI
    } else if (pdfData && !messageContent.trim()) {
      finalContent = `[PDF: ${pdfFileName || 'document.pdf'}]`; // Placeholder text for UI
    }

    // Create user message with content for display
    // Use finalContent if it's a placeholder for image/audio/pdf-only messages, otherwise keep original content
    const displayContent = (finalContent === '[Image message]' || finalContent === '[Audio message]' || finalContent.startsWith('[PDF:')) ? finalContent : content;
    const userMessage: Message = {
      id: Date.now(),
      content: displayContent, // Use placeholder for image/audio/pdf-only, otherwise original content
      isAI: false,
      hasAnimated: false,
      imageData: imageData,
      audioData: audioData,
      inputImageUrls: inputImageUrls,
      imageDimensions: imageDimensions,
      pdfData: pdfData ? 'attached' : undefined, // Don't store full base64 in message state, just flag it
      pdfFileName: pdfFileName,
      // Add sender info for collaborative mode
      sender_id: isCollaborative ? userId || undefined : undefined,
      sender_nickname: isCollaborative ? userProfile?.nickname || undefined : undefined,
      // Add reply info if replying
      replyTo: replyTo
    };

    // Create API message with cleaned content (without @mention) for API call
    const apiUserMessage: Message = {
      id: Date.now(),
      content: finalContent,
      isAI: false,
      hasAnimated: false,
      imageData: imageData,
      audioData: audioData,
      inputImageUrls: inputImageUrls,
      imageDimensions: imageDimensions
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);
    // Set initial loading phase based on whether images/pdf are attached
    const hasImages = !!(imageData || (inputImageUrls && inputImageUrls.length > 0));
    setLoadingPhase(hasImages ? 'analyzing_photo' : 'thinking');

    // If in collaborative mode, sync user message to group_chat_messages table
    if (isCollaborative && collaborativeId && userId && userProfile?.nickname) {
      sendGroupChatMessage(
        collaborativeId,
        displayContent,
        userId,
        userProfile.nickname,
        undefined, // avatar
        false, // isAI
        inputImageUrls,
        undefined, // audioUrl
        undefined // reasoning
      );

      // In collaborative mode, trigger AI if:
      // 1. @timemachine is mentioned, OR
      // 2. User is replying to an AI message
      const mentionsTimeMachine = /(@timemachine|timemachine)/i.test(content);
      const isReplyingToAI = replyTo?.isAI === true;

      if (!mentionsTimeMachine && !isReplyingToAI && specialMode !== 'video-generation') {
        // Just send the message, no AI response
        setIsLoading(false);
        return;
      }
    }

    // Create placeholder AI message for streaming
    const aiMessageId = Date.now() + 1;
    const aiMessage: Message = {
      id: aiMessageId,
      content: '',
      isAI: true,
      hasAnimated: false,
      specialMode: specialMode
    };

    setMessages(prev => [...prev, aiMessage]);
    setStreamingMessageId(aiMessageId);
    isStreamingRef.current = true; // Mark streaming as started

    if (specialMode === 'video-generation') {
      try {
        const videoMarkdown = createVideoMarkdown({
          prompt: messageContent,
          inputImageUrls,
          duration: 5
        });

        setLoadingPhase(null);
        await completeStreamingMessage(aiMessageId, videoMarkdown);
      } catch (error) {
        console.error('Failed to generate video:', error);
        setError('Failed to generate video. Please try again.');
        setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
        setStreamingMessageId(null);
        setIsLoading(false);
        setLoadingPhase(null);
        isStreamingRef.current = false;
      }
      return;
    }

    // Filter out initial welcome message (ID: 1) - it's just for UI aesthetics
    let apiMessages = [...messages, apiUserMessage].filter(msg => msg.id !== 1);

    // In collaborative mode, format user messages as dialogue for AI context
    if (isCollaborative) {
      apiMessages = formatMessagesAsDialogue(apiMessages);
    }

    // Prepare user memory context from profile
    const userMemoryContext: UserMemoryContext | undefined = userProfile ? {
      nickname: userProfile.nickname || undefined,
      about_me: userProfile.about_me || undefined
    } : undefined;

    // If this message includes PDF text, cache it for follow-up questions
    if (pdfData) {
      setActivePdfText(pdfData);
    }

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
        imageDimensions,
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

          // Handle YouTube music if present
          if (response.youtubeMusic) {
            setYoutubeMusic(response.youtubeMusic);
          }


          setLoadingPhase(null);
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
          setLoadingPhase(null);
          isStreamingRef.current = false; // Clear streaming flag on error
        },
        userId || undefined,
        userMemoryContext,
        specialMode,
        // onStatusChange callback for image pipeline UX
        (status) => {
          setLoadingPhase(status);
        },
        pdfData,
        pdfFileName,
        // Pass cached PDF text for follow-up messages (avoids re-extraction)
        activePdfText || undefined
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
          inputImageUrls,
          imageDimensions,
          userId || undefined,
          userMemoryContext,
          specialMode,
          pdfData,
          pdfFileName,
          activePdfText || undefined
        );

        const emotion = extractEmotion(aiResponse.content);
        const cleanedContent = cleanContent(aiResponse.content);

        if (emotion) {
          setCurrentEmotion(emotion);
        }


        setLoadingPhase(null);
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
        setLoadingPhase(null);
        isStreamingRef.current = false; // Clear streaming flag on error
      }
    }
  }, [messages, currentPersona, currentProHeatLevel, userId, userProfile, isCollaborative, collaborativeId, completeStreamingMessage]);

  const markMessageAsAnimated = useCallback((messageId: number) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, hasAnimated: true } : msg
    ));
  }, []);

  const dismissAboutUs = useCallback(() => {
    setShowAboutUs(false);
  }, []);

  const loadChat = useCallback((session: ChatSession) => {
    // Cancel any pending saves to avoid race conditions
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    // Save current session immediately before loading new one (only if not streaming)
    if (currentSessionId && messages.length > 1 && !isStreamingRef.current) {
      saveChatSession(currentSessionId, messages, currentPersona, true); // Force immediate save
    }

    // Clear streaming state if somehow still set
    isStreamingRef.current = false;
    setStreamingMessageId(null);
    setIsLoading(false);

    // Filter out any empty messages from the loaded session
    const validMessages = session.messages.filter(msg => msg.content && msg.content.trim() !== '');

    // Ensure we have at least the initial message if all messages were empty
    const messagesToLoad = validMessages.length > 0
      ? validMessages
      : [{ id: Date.now(), content: cleanContent(AI_PERSONAS[session.persona].initialMessage), isAI: true, hasAnimated: false }];

    // Update all state together
    setCurrentPersona(session.persona);
    setMessages(messagesToLoad);
    setChatMode(true);
    setCurrentSessionId(session.id);
    setPersonaTheme(session.persona);
    setError(null);
    setActivePdfText(null); // Clear PDF context when loading a different chat

    // Set heat level if it's a pro session
    if (session.heat_level) {
      setCurrentProHeatLevel(session.heat_level);
    }
  }, [currentSessionId, messages, currentPersona, saveChatSession, setPersonaTheme]);

  // Enable collaborative mode for current session
  const enableCollaborativeMode = useCallback(async (chatName: string): Promise<string | null> => {
    if (!userId || !userProfile?.nickname) return null;

    const shareId = await createGroupChat(
      currentSessionId,
      userId,
      userProfile.nickname,
      chatName,
      currentPersona
    );

    if (shareId) {
      setCollaborativeId(shareId);
      setIsCollaborative(true);
      setParticipants([{
        id: `${userId}-owner`,
        user_id: userId,
        nickname: userProfile.nickname,
        joined_at: new Date().toISOString(),
        is_owner: true
      }]);

      // Push existing messages to group_chat_messages table
      // Skip the initial welcome message (id: 1)
      const messagesToSync = messages.filter(m => m.id !== 1);
      for (const msg of messagesToSync) {
        await sendGroupChatMessage(
          shareId,
          msg.content,
          userId,
          msg.isAI ? 'TimeMachine' : userProfile.nickname,
          undefined, // avatar
          msg.isAI,
          msg.inputImageUrls,
          msg.audioUrl,
          msg.thinking
        );
      }

      // Subscribe to real-time updates
      collaborativeUnsubscribeRef.current = subscribeToGroupChat(
        shareId,
        (newMessage) => {
          // Only add messages NOT from current user (to avoid duplicates)
          if (newMessage.sender_id !== userId) {
            setMessages(prev => {
              const exists = prev.some(m => m.id === newMessage.id);
              if (exists) return prev;
              return [...prev, {
                id: newMessage.id,
                content: newMessage.content,
                isAI: newMessage.isAI,
                hasAnimated: newMessage.hasAnimated,
                thinking: newMessage.thinking,
                audioUrl: newMessage.audioUrl,
                inputImageUrls: newMessage.inputImageUrls,
                sender_id: newMessage.sender_id,
                sender_nickname: newMessage.sender_nickname,
                sender_avatar: newMessage.sender_avatar,
                reactions: newMessage.reactions
              }];
            });
          }
        },
        (newParticipant) => {
          setParticipants(prev => {
            const exists = prev.some(p => p.user_id === newParticipant.user_id);
            if (exists) return prev;
            return [...prev, newParticipant];
          });
        },
        // Reaction update callback
        (messageId, reactions) => {
          setMessages(prev => prev.map(msg =>
            msg.id === messageId ? { ...msg, reactions } : msg
          ));
        }
      );

      // Subscribe to music changes
      musicUnsubscribeRef.current = subscribeToGroupChatMusic(
        shareId,
        (music) => {
          console.log('[useChat] Music subscription callback - received:', music);

          // Always set pending remote music - UI will hide button if already playing locally
          if (music) {
            console.log('[useChat] Setting pending remote music');
            setPendingRemoteMusic({
              videoId: music.videoId,
              title: music.title,
              artist: music.artist || '',
              thumbnail: ''
            });
          } else {
            console.log('[useChat] Clearing pending remote music');
            setPendingRemoteMusic(null);
          }
        }
      );
    }

    return shareId;
  }, [userId, userProfile, currentSessionId, currentPersona, messages]);

  // Join an existing collaborative chat
  const joinCollaborativeChat = useCallback(async (shareId: string) => {
    const chat = await getGroupChat(shareId);
    if (!chat) return false;

    setCollaborativeId(shareId);
    setIsCollaborative(true);
    setCurrentPersona(chat.persona);
    setPersonaTheme(chat.persona);
    setParticipants(chat.participants);

    // Map messages with sender info - use snake_case to match Message type
    const loadedMessages = chat.messages.length > 0
      ? chat.messages.map(m => ({
        id: m.id,
        content: m.content,
        isAI: m.isAI,
        hasAnimated: m.hasAnimated ?? true,
        thinking: m.thinking,
        audioUrl: m.audioUrl,
        inputImageUrls: m.inputImageUrls,
        sender_id: m.sender_id,
        sender_nickname: m.sender_nickname,
        sender_avatar: m.sender_avatar,
        reactions: m.reactions
      }))
      : [{ ...INITIAL_MESSAGE, hasAnimated: true }];

    setMessages(loadedMessages);
    // Don't set currentSessionId to shareId - it's not a UUID and will break chat_sessions table
    // setCurrentSessionId(shareId);

    // Subscribe to real-time updates
    collaborativeUnsubscribeRef.current = subscribeToGroupChat(
      shareId,
      (newMessage) => {
        // Only add messages NOT from current user (to avoid duplicates/id mismatch)
        if (newMessage.sender_id !== userId) {
          setMessages(prev => {
            const exists = prev.some(m => m.id === newMessage.id);
            if (exists) return prev;

            return [...prev, {
              id: newMessage.id,
              content: newMessage.content,
              isAI: newMessage.isAI,
              hasAnimated: newMessage.hasAnimated,
              thinking: newMessage.thinking,
              audioUrl: newMessage.audioUrl,
              inputImageUrls: newMessage.inputImageUrls,
              sender_id: newMessage.sender_id,
              sender_nickname: newMessage.sender_nickname,
              sender_avatar: newMessage.sender_avatar,
              reactions: newMessage.reactions
            }];
          });
        }
      },
      (newParticipant) => {
        setParticipants(prev => {
          const exists = prev.some(p => p.user_id === newParticipant.user_id);
          if (exists) return prev;
          return [...prev, newParticipant];
        });
      },
      // Reaction update callback
      (messageId, reactions) => {
        setMessages(prev => prev.map(msg =>
          msg.id === messageId ? { ...msg, reactions } : msg
        ));
      }
    );

    // Get current music if any - set as pending (user needs to click to play)
    const currentMusic = await getGroupChatMusic(shareId);
    if (currentMusic) {
      setPendingRemoteMusic({
        videoId: currentMusic.videoId,
        title: currentMusic.title,
        artist: currentMusic.artist || '',
        thumbnail: ''
      });
    }

    // Subscribe to music changes
    musicUnsubscribeRef.current = subscribeToGroupChatMusic(
      shareId,
      (music) => {
        console.log('[useChat] joinCollaborativeChat - music subscription callback:', music);

        // Always set pending remote music - UI will hide button if already playing locally
        if (music) {
          console.log('[useChat] Setting pending remote music from join');
          setPendingRemoteMusic({
            videoId: music.videoId,
            title: music.title,
            artist: music.artist || '',
            thumbnail: ''
          });
        } else {
          console.log('[useChat] Clearing pending remote music from join');
          setPendingRemoteMusic(null);
        }
      }
    );

    return true;
  }, [setPersonaTheme, userId]);

  // Leave collaborative mode
  const leaveCollaborativeMode = useCallback(() => {
    if (collaborativeUnsubscribeRef.current) {
      collaborativeUnsubscribeRef.current();
      collaborativeUnsubscribeRef.current = null;
    }
    if (musicUnsubscribeRef.current) {
      musicUnsubscribeRef.current();
      musicUnsubscribeRef.current = null;
    }
    setIsCollaborative(false);
    setCollaborativeId(null);
    setParticipants([]);
    setYoutubeMusic(null);
    setPendingRemoteMusic(null);
  }, []);

  // Play pending remote music (user clicked "Play for me too")
  const playPendingMusic = useCallback(() => {
    if (pendingRemoteMusic) {
      setYoutubeMusic(pendingRemoteMusic);
      setPendingRemoteMusic(null);
    }
  }, [pendingRemoteMusic]);

  // Dismiss pending remote music without playing
  const dismissPendingMusic = useCallback(() => {
    setPendingRemoteMusic(null);
  }, []);

  // Update reactions on a specific message
  const updateMessageReactions = useCallback((messageId: number, reactions: Record<string, string[]>) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, reactions } : msg
    ));
  }, []);

  // Update music variations (Supabase URLs) on a specific message
  // Called when MusicComposeCard finishes uploading to Supabase
  const updateMusicVariations = useCallback((messageId: number, variations: MusicVariation[]) => {
    setMessages(prev => {
      const updated = prev.map(msg =>
        msg.id === messageId ? { ...msg, musicVariations: variations } : msg
      );
      // Force immediate save so the Supabase URLs are persisted
      if (currentSessionId && !isCollaborative) {
        setTimeout(() => {
          saveChatSession(currentSessionId, updated, currentPersona, true);
        }, 0);
      }
      return updated;
    });
  }, [currentSessionId, currentPersona, saveChatSession, isCollaborative]);

  // Cleanup collaborative and music subscriptions on unmount
  useEffect(() => {
    return () => {
      if (collaborativeUnsubscribeRef.current) {
        collaborativeUnsubscribeRef.current();
      }
      if (musicUnsubscribeRef.current) {
        musicUnsubscribeRef.current();
      }
    };
  }, []);

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
    youtubeMusic,
    loadingPhase,
    currentSessionId,
    // Collaborative mode
    isCollaborative,
    collaborativeId,
    participants,
    // Actions
    setChatMode,
    handleSendMessage,
    handlePersonaChange,
    setCurrentProHeatLevel,
    startNewChat,
    markMessageAsAnimated,
    dismissAboutUs,
    dismissRateLimitModal,
    loadChat,
    setUseStreaming,
    clearYoutubeMusic,
    // Collaborative actions
    enableCollaborativeMode,
    joinCollaborativeChat,
    leaveCollaborativeMode,
    updateMessageReactions,
    updateMusicVariations,
    // Remote music
    pendingRemoteMusic,
    playPendingMusic,
    dismissPendingMusic
  };
}
