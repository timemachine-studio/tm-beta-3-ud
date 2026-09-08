import { useState, useCallback, useEffect, useRef } from 'react';
import { Message, ImageDimensions, MusicVariation, ChatErrorCode, RetryContext } from '../types/chat';
import { generateAIResponse, generateAIResponseStreaming, resolveMcpApproval, getActiveProRun, streamProRun, YouTubeMusicData, UserMemoryContext } from '../services/ai/aiProxyService';
import type { McpApprovalDecision, McpApprovalRequest } from '../types/flightControls';
import { ChatError } from '../services/ai/chatErrors';
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
import { newId } from '../utils/id';

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
            const sender = m.sender_nickname || 'User';
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
        const sender = m.sender_nickname || 'User';
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

const VALID_EMOTIONS = [
  'sadness', 'joy', 'love', 'excitement', 'anger',
  'motivation', 'jealousy', 'relaxation', 'anxiety', 'hope'
];

// Pure, so they live at module scope: as inner functions they were a fresh
// identity every render and accounted for five of this file's
// exhaustive-deps violations (production-check.md 1.13).
function extractEmotion(content: string): string | null {
  const match = content.match(/<emotion>([a-z]+)<\/emotion>/i);
  if (!match) return null;

  const emotion = match[1].toLowerCase();
  return VALID_EMOTIONS.includes(emotion) ? emotion : 'joy';
}

function cleanContent(content: string): string {
  const emotion = extractEmotion(content);
  if (emotion) {
    return content.replace(/<emotion>[a-z]+<\/emotion>/i, '').replace(/<(reason|think)>[\s\S]*?<\/\1>/gi, '').trim();
  }
  return content.replace(/<(reason|think)>[\s\S]*?<\/\1>/gi, '').trim();
}

/**
 * Freeze a message list for saving while a turn is still in flight.
 *
 * The interrupted assistant turn is stored as a failed turn rather than an
 * empty bubble, so reopening the chat shows a Retry instead of a blank
 * response (1.10/1.13).
 */
function markStreamingAsInterrupted(list: Message[]): Message[] {
  return list.map(message => (
    message.status === 'streaming'
      ? {
        ...message,
        status: 'error' as const,
        errorCode: 'ABORTED' as const,
        partialContent: message.content?.trim() ? message.content : undefined,
        content: '',
        rawContent: undefined,
        hasAnimated: true,
      }
      : message
  ));
}

export function useChat(
  userId?: string | null,
  userProfile?: { nickname?: string | null; about_me?: string | null },
  initialPersona?: keyof typeof AI_PERSONAS,
  authLoading?: boolean,
  initialSession?: { messages: Message[]; id: string; heat_level?: number } | null,
  flowStateActive?: boolean
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
  const [currentSessionId, setCurrentSessionId] = useState<string>(initialSession?.id || '');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
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

  // In-flight generation, so Stop / unmount / switching chats can cancel it (1.5).
  const abortControllerRef = useRef<AbortController | null>(null);

  // The assistant placeholder the in-flight turn is writing into, and the
  // turns the user has stopped. Stop has to be authoritative in the UI on its
  // own: aborting the request is best-effort (the PRO path reconnects, a
  // provider can keep flushing buffered bytes), so any callback that arrives
  // after a stop for that turn is dropped rather than allowed to resurrect it.
  const streamingMessageIdRef = useRef<string | null>(null);
  const stoppedTurnsRef = useRef<Set<string>>(new Set());

  // Track if there are unsaved changes in this session to prevent auto-saves on initial loads
  const isDirtyRef = useRef(false);

  // Track PRO sessions we already tried to resume, to avoid duplicate reattach loops
  const proResumeAttemptedRef = useRef<Set<string>>(new Set());

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
            firstUserMessage.content !== '[Image message]' &&
            !firstUserMessage.content.startsWith('[PDF:') && !firstUserMessage.content.startsWith('[File:')) {
            sessionName = firstUserMessage.content.slice(0, 50);
          } else if (firstUserMessage.imageData || (firstUserMessage.inputImageUrls && firstUserMessage.inputImageUrls.length > 0)) {
            sessionName = 'Image message';
          } else if (firstUserMessage.pdfFileName) {
            const isPdf = firstUserMessage.pdfFileName.toLowerCase().endsWith('.pdf');
            sessionName = isPdf ? `PDF: ${firstUserMessage.pdfFileName}` : `File: ${firstUserMessage.pdfFileName}`;
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

    // Save the outgoing session before switching. Streaming used to skip this
    // entirely, so leaving a chat mid-generation threw away the user's own
    // message too — and once storage is device-only there is no cloud copy to
    // recover it from (1.13).
    if (currentSessionId && messages.length > 1) {
      saveChatSession(currentSessionId, markStreamingAsInterrupted(messages), currentPersona, true);
    }

    // Cancel any generation still in flight: its result belongs to the chat
    // being left, and there is nowhere safe to put it once we've switched.
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
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
    const newSessionId = newId();
    setCurrentSessionId(newSessionId);

    const initialMessage = cleanContent(AI_PERSONAS[persona].initialMessage);
    setMessages([{
      id: newId(),
      createdAt: new Date().toISOString(),
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

    // Save the outgoing session before starting a new one — including a turn
    // that was still streaming, which used to be dropped wholesale (1.13).
    if (currentSessionId && messages.length > 1) {
      saveChatSession(currentSessionId, markStreamingAsInterrupted(messages), currentPersona, true);
    }

    // Cancel any generation still in flight: its result belongs to the chat
    // being left, and there is nowhere safe to put it once we've switched.
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    isStreamingRef.current = false;
    setStreamingMessageId(null);
    setIsLoading(false);

    // Start fresh chat with same persona
    const newSessionId = newId();
    setCurrentSessionId(newSessionId);
    setActivePdfText(null); // Clear PDF context on new chat

    const initialMessage = cleanContent(AI_PERSONAS[currentPersona].initialMessage);
    setMessages([{
      id: newId(),
      createdAt: new Date().toISOString(),
      content: initialMessage,
      isAI: true,
      hasAnimated: false
    }]);

    setError(null);
  }, [currentSessionId, messages, currentPersona, saveChatSession]);

  // Handle streaming message updates
  const updateStreamingMessage = useCallback((messageId: string, chunk: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id !== messageId) return msg;

      // Accumulate raw content
      const rawContent = (msg.rawContent || '') + chunk;
      
      // Parse rawContent to extract thinking and content on the fly
      let thinking = '';
      let content = '';
      let isInsideReason = false;
      let reasonTagType: 'reason' | 'think' | null = null;
      let i = 0;

      while (i < rawContent.length) {
        if (!isInsideReason) {
          const nextReasonStart = rawContent.indexOf('<reason>', i);
          const nextThinkStart = rawContent.indexOf('<think>', i);
          
          let startTagIndex = -1;
          let tagLength = 0;
          let currentTagType: 'reason' | 'think' | null = null;

          if (nextReasonStart !== -1 && (nextThinkStart === -1 || nextReasonStart < nextThinkStart)) {
            startTagIndex = nextReasonStart;
            tagLength = 8; // '<reason>'.length
            currentTagType = 'reason';
          } else if (nextThinkStart !== -1) {
            startTagIndex = nextThinkStart;
            tagLength = 7; // '<think>'.length
            currentTagType = 'think';
          }

          if (startTagIndex !== -1) {
            content += rawContent.substring(i, startTagIndex);
            isInsideReason = true;
            reasonTagType = currentTagType;
            i = startTagIndex + tagLength;
          } else {
            const openTagPrefixes = ['<', '<r', '<re', '<rea', '<reas', '<reaso', '<reason', '<t', '<th', '<thi', '<thin', '<think'];
            const endsWithOpenTagPrefix = openTagPrefixes.some(prefix => rawContent.endsWith(prefix));
            if (endsWithOpenTagPrefix) {
              for (const prefix of openTagPrefixes) {
                if (rawContent.endsWith(prefix)) {
                  content += rawContent.substring(i, rawContent.length - prefix.length);
                  break;
                }
              }
            } else {
              content += rawContent.substring(i);
            }
            break;
          }
        } else {
          const closeTag = reasonTagType === 'think' ? '</think>' : '</reason>';
          const nextReasonEnd = rawContent.indexOf(closeTag, i);
          if (nextReasonEnd !== -1) {
            thinking += (thinking ? '\n\n' : '') + rawContent.substring(i, nextReasonEnd).trim();
            isInsideReason = false;
            reasonTagType = null;
            i = nextReasonEnd + closeTag.length;
          } else {
            const closeTagPrefixes = reasonTagType === 'think'
              ? ['</', '</t', '</th', '</thi', '</thin', '</think']
              : ['</', '</r', '</re', '</rea', '</reas', '</reaso', '</reason'];
            const endsWithCloseTagPrefix = closeTagPrefixes.some(prefix => rawContent.endsWith(prefix));
            if (endsWithCloseTagPrefix) {
              for (const prefix of closeTagPrefixes) {
                if (rawContent.endsWith(prefix)) {
                  thinking += (thinking ? '\n\n' : '') + rawContent.substring(i, rawContent.length - prefix.length).trim();
                  break;
                }
              }
            } else {
              thinking += (thinking ? '\n\n' : '') + rawContent.substring(i).trim();
            }
            break;
          }
        }
      }

      // Format thinking as undefined if empty
      const finalThinking = thinking.trim() ? thinking.trim() : undefined;
      const finalContent = content;
      
      return {
        ...msg,
        rawContent,
        content: finalContent,
        thinking: finalThinking
      };
    }));
  }, []);

  // Complete streaming message.
  //
  // `turnSessionId` is the session this generation *started* in. It is passed
  // in rather than read from state so a completion can never be written to
  // whichever chat happens to be open when it lands (1.13).
  const completeStreamingMessage = useCallback(async (
    messageId: string,
    finalContent: string,
    thinking?: string,
    audioUrl?: string,
    turnSessionId?: string,
  ) => {
    let processedContent = finalContent;

    // If user is logged in and content has generated images, upload them to Supabase
    if (userId && finalContent.includes('![Generated Image](/api/image?')) {
      try {
        processedContent = await processGeneratedImages(finalContent, userId);
      } catch (error) {
        console.error('Failed to process generated images:', error);
      }
    }

    isDirtyRef.current = true; // Mark as dirty when completing message
    // Update the message with final content
    setMessages(prev => {
      const updatedMessages = prev.map(msg =>
        msg.id === messageId
          ? { ...msg, content: processedContent, thinking, audioUrl, status: 'complete' as const, errorCode: undefined, partialContent: undefined, hasAnimated: false }
          : msg
      );

      // Force immediate save after streaming completes to prevent data loss.
      // Debounced saves can be cancelled if the user navigates away.
      //
      // Two guards, both about the same hazard: the completion must belong to
      // the chat that is actually open. The message has to still be here, and
      // the session must be the one this turn started in.
      const sessionMatches = !turnSessionId || turnSessionId === currentSessionId;
      if (currentSessionId && sessionMatches && !isCollaborative && updatedMessages.some(msg => msg.id === messageId)) {
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

  // Resume an in-flight PRO background generation when its chat is opened.
  // The Trigger.dev stream retains every chunk, so we replay from index 0 and
  // the message rebuilds itself exactly as if the page had never been closed.
  const tryResumeProGeneration = useCallback(async (sessionId: string, persona: keyof typeof AI_PERSONAS) => {
    if (persona !== 'pro' || !sessionId || proResumeAttemptedRef.current.has(sessionId)) return;
    proResumeAttemptedRef.current.add(sessionId);

    try {
      const active = await getActiveProRun(sessionId);
      if (!active) return;

      // Never hijack an ongoing stream in this tab
      if (isStreamingRef.current) return;

      const aiMessageId = newId();
      setMessages(prev => [...prev, {
        id: aiMessageId,
        content: '',
        rawContent: '',
        isAI: true,
        hasAnimated: false,
      }]);
      setStreamingMessageId(aiMessageId);
      setIsLoading(true);
      setLoadingPhase('thinking');
      isStreamingRef.current = true;

      await streamProRun(active.runId, {
        onChunk: (chunk: string) => {
          updateStreamingMessage(aiMessageId, chunk);
        },
        onStatusChange: (status: string) => {
          setLoadingPhase(status as 'analyzing_photo' | 'thinking');
        },
        onComplete: (response) => {
          const emotion = extractEmotion(response.content);
          const cleanedContent = cleanContent(response.content);

          if (emotion) {
            setCurrentEmotion(emotion);
          }

          setLoadingPhase(null);
          completeStreamingMessage(aiMessageId, cleanedContent, response.thinking);
        },
        onError: (error) => {
          console.error('Failed to resume PRO generation:', error.message);
          // Same treatment as any other failed turn: leave it in place with a
          // retry affordance rather than silently deleting the placeholder.
          setMessages(prev => prev.map(msg => msg.id === aiMessageId
            ? { ...msg, status: 'error' as const, errorCode: 'PROVIDER_DOWN' as const, hasAnimated: true }
            : msg));
          setStreamingMessageId(null);
          setIsLoading(false);
          setLoadingPhase(null);
          isStreamingRef.current = false;
        },
      });
    } catch (resumeError) {
      console.error('Failed to check for active PRO generation:', resumeError);
    }
  }, [updateStreamingMessage, completeStreamingMessage]);

  const handleMcpApprovalDecision = useCallback(async (messageId: string, decision: McpApprovalDecision) => {
    const target = messages.find(message => message.id === messageId);
    if (!target?.mcpApproval || target.mcpApproval.status !== 'pending') return;

    setMessages(previous => previous.map(message => message.id === messageId
      ? { ...message, mcpApproval: { ...message.mcpApproval!, status: decision === 'approve' ? 'approved' : 'denied', error: undefined } }
      : message));
    setIsLoading(true);

    try {
      const response = await resolveMcpApproval(target.mcpApproval.runId, decision);
      const finalContent = cleanContent(response.content);
      isDirtyRef.current = true;
      setMessages(previous => {
        const updated = previous.map(message => message.id === messageId
          ? { ...message, content: finalContent, rawContent: undefined, mcpApproval: undefined, hasAnimated: false }
          : message);
        if (currentSessionId && !isCollaborative) {
          setTimeout(() => saveChatSession(currentSessionId, updated, currentPersona, true), 0);
        }
        return updated;
      });
    } catch (approvalError) {
      const errorMessage = approvalError instanceof Error ? approvalError.message : 'Approval failed';
      const uncertain = Boolean((approvalError as Error & { uncertainOutcome?: boolean }).uncertainOutcome);
      setMessages(previous => previous.map(message => message.id === messageId
        ? {
          ...message,
          mcpApproval: {
            ...message.mcpApproval!,
            status: 'failed',
            error: uncertain ? `${errorMessage} The external outcome may be uncertain; the action was not retried.` : errorMessage,
          },
        }
        : message));
    } finally {
      setIsLoading(false);
    }
  }, [messages, currentSessionId, currentPersona, isCollaborative, saveChatSession]);

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
    // - Not dirty (to prevent auto-save on initial load from history)
    if (isDirtyRef.current && messages.length > 1 && currentSessionId && !isStreamingRef.current && !isCollaborative) {
      saveChatSession(currentSessionId, messages, currentPersona);
      isDirtyRef.current = false; // Reset dirty flag after scheduling save
    }
  }, [messages, currentSessionId, currentPersona, saveChatSession, isCollaborative]);

  // Initialize session ID on first load
  useEffect(() => {
    if (!currentSessionId) {
      setCurrentSessionId(newId());
    }
  }, [currentSessionId]);

  // Set theme when loaded from initial session (history).
  // The ref, not an empty dependency array, is what makes this run once —
  // so the real dependencies can be declared honestly (1.13).
  const themeAppliedRef = useRef(false);
  useEffect(() => {
    if (themeAppliedRef.current) return;
    if (initialSession && initialPersona) {
      themeAppliedRef.current = true;
      setPersonaTheme(initialPersona);
    }
  }, [initialSession, initialPersona, setPersonaTheme]);

  // If the app was (re)loaded straight into a PRO chat with a generation
  // still running in the background, reattach to its stream.
  const proResumeStartedRef = useRef(false);
  useEffect(() => {
    if (proResumeStartedRef.current) return;
    if (initialSession?.id && initialPersona === 'pro') {
      proResumeStartedRef.current = true;
      tryResumeProGeneration(initialSession.id, 'pro');
    }
  }, [initialSession?.id, initialPersona, tryResumeProGeneration]);

  // Initialize chat once auth loading is complete
  useEffect(() => {
    // Wait until auth is done loading before initializing
    if (authLoading || isInitialized) return;

    // The composer is live from the first frame now (1.14), so the user can
    // send before this runs. Never overwrite a conversation that has already
    // started — just mark the chat initialized and leave it alone.
    if (messages.length > 0) {
      setIsInitialized(true);
      return;
    }

    // Now we can safely determine the persona (either from profile or default)
    const persona = initialPersona || 'default';
    // Clean emotion tags from initial message
    const rawMessage = AI_PERSONAS[persona].initialMessage;
    const initialMessage = rawMessage.replace(/<emotion>[a-z]+<\/emotion>/i, '').replace(/<reason>[\s\S]*?<\/reason>/i, '').trim();

    setCurrentPersona(persona);
    setPersonaTheme(persona);
    setMessages([{
      id: newId(),
      createdAt: new Date().toISOString(),
      content: initialMessage,
      isAI: true,
      hasAnimated: false
    }]);
    setIsInitialized(true);
  }, [authLoading, isInitialized, initialPersona, setPersonaTheme, messages.length]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Everything the send pipeline reads *when a generation finishes* rather
  // than when it starts. A completion callback can fire minutes after the
  // send: capturing these in the closure is why switching chats mid-stream
  // saved the completion under the previous session id (1.13).
  const latest = useRef({
    messages,
    currentPersona,
    currentProHeatLevel,
    currentSessionId,
    activePdfText,
    isCollaborative,
    collaborativeId,
    userId,
    userProfile,
    flowStateActive,
    useStreaming,
  });
  useEffect(() => {
    latest.current = {
      messages,
      currentPersona,
      currentProHeatLevel,
      currentSessionId,
      activePdfText,
      isCollaborative,
      collaborativeId,
      userId,
      userProfile,
      flowStateActive,
      useStreaming,
    };
  });

  // Stable handles for the callbacks the pipeline invokes on completion, so
  // the pipeline itself never has to be rebuilt (and never goes stale).
  const completeStreamingMessageRef = useRef(completeStreamingMessage);
  const updateStreamingMessageRef = useRef(updateStreamingMessage);
  const saveChatSessionRef = useRef(saveChatSession);
  useEffect(() => {
    completeStreamingMessageRef.current = completeStreamingMessage;
    updateStreamingMessageRef.current = updateStreamingMessage;
    saveChatSessionRef.current = saveChatSession;
  });

  const clearTurnState = useCallback(() => {
    setStreamingMessageId(null);
    streamingMessageIdRef.current = null;
    setIsLoading(false);
    setLoadingPhase(null);
    isStreamingRef.current = false;
    abortControllerRef.current = null;
  }, []);

  // Mark the assistant placeholder as failed, in place.
  //
  // The old code deleted the placeholder and set a global `error` string,
  // which rendered as a banner at the top of the transcript — detached from
  // the turn that failed, with the user's prompt gone and no way to re-run it
  // (1.10). The failure now stays attached to its own turn.
  const failTurn = useCallback((aiMessageId: string, error: unknown) => {
    const code: ChatErrorCode = error instanceof ChatError ? error.code : 'UNKNOWN';
    const partial = error instanceof ChatError ? error.partialContent : undefined;

    isDirtyRef.current = true;
    setMessages(prev => prev.map(msg =>
      msg.id === aiMessageId
        ? {
          ...msg,
          status: 'error' as const,
          errorCode: code,
          content: '',
          rawContent: undefined,
          partialContent: partial && partial.trim() ? cleanContent(partial) : undefined,
          hasAnimated: true,
        }
        : msg
    ));
    clearTurnState();
  }, [clearTurnState]);

  /**
   * Run one assistant turn against an already-built message list.
   *
   * Shared by first sends and retries so a retry is byte-for-byte the same
   * request the first attempt made (1.10).
   */
  const runTurn = useCallback(async (
    aiMessageId: string,
    apiMessages: Message[],
    ctx: RetryContext,
  ) => {
    const {
      messages: _ignored,
      currentSessionId: sessionId,
      activePdfText: cachedPdfText,
      isCollaborative: collaborative,
      userId: uid,
      userProfile: profile,
      useStreaming: streamingEnabled,
    } = latest.current;
    void _ignored;

    const persona = ctx.persona as keyof typeof AI_PERSONAS;
    const userMemoryContext: UserMemoryContext | undefined = profile ? {
      nickname: profile.nickname || undefined,
      about_me: profile.about_me || undefined
    } : undefined;

    setIsLoading(true);
    setLoadingPhase(ctx.inputImageUrls?.length || ctx.imageData ? 'analyzing_photo' : 'thinking');
    setStreamingMessageId(aiMessageId);
    streamingMessageIdRef.current = aiMessageId;
    isStreamingRef.current = true;
    stoppedTurnsRef.current.delete(aiMessageId);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // True once the user has pressed Stop for this turn. Every transport
    // callback checks it, because an abort is not guaranteed to reach us.
    const wasStopped = () => stoppedTurnsRef.current.has(aiMessageId);

    if (streamingEnabled) {
      let approvalReceived = false;
      await generateAIResponseStreaming(
        apiMessages,
        ctx.imageData,
        '', // System prompt is now handled server-side
        persona,
        persona === 'pro' ? ctx.heatLevel : undefined,
        ctx.inputImageUrls,
        ctx.imageDimensions,
        // onChunk callback
        (chunk: string) => {
          if (wasStopped()) return;
          updateStreamingMessageRef.current(aiMessageId, chunk);
        },
        // onComplete callback
        (response) => {
          if (approvalReceived || wasStopped()) return;
          const emotion = extractEmotion(response.content);
          const cleanedContent = cleanContent(response.content);

          if (emotion) {
            setCurrentEmotion(emotion);
          }

          // Handle YouTube music if present
          if (response.youtubeMusic) {
            setYoutubeMusic(response.youtubeMusic);
          }

          // A well-formed stream that carried no answer is still a failed
          // turn. Painting an empty bubble is exactly the "it just glitched"
          // symptom 1.9 set out to remove, so it gets the same retry row.
          if (!cleanedContent.trim() && !response.youtubeMusic) {
            failTurn(aiMessageId, new ChatError('EMPTY', 'The model returned an empty response.'));
            return;
          }

          setLoadingPhase(null);
          abortControllerRef.current = null;
          completeStreamingMessageRef.current(aiMessageId, cleanedContent, response.thinking, undefined, sessionId);
        },
        // onError callback
        (error) => {
          if (approvalReceived || wasStopped()) return;
          console.error('Failed to generate streaming response:', error.message);

          // Every failure — rate limit included — now lands as an inline
          // bubble on the turn that failed. The modal it used to raise was a
          // full-screen interrupt for something that is about one message,
          // and it blamed server load for what was usually a single provider
          // having a bad minute.
          if (error && typeof error === 'object' && 'type' in error && (error as { type?: string }).type === 'rateLimit') {
            failTurn(aiMessageId, new ChatError('RATE_LIMITED', 'Rate limit exceeded'));
            return;
          }
          failTurn(aiMessageId, error);
        },
        uid || undefined,
        userMemoryContext,
        ctx.specialMode,
        // onStatusChange callback for image pipeline UX
        (status) => {
          if (wasStopped()) return;
          setLoadingPhase(status as 'analyzing_photo' | 'thinking');
        },
        ctx.pdfData,
        ctx.pdfFileName,
        // Pass cached PDF text for follow-up messages (avoids re-extraction)
        cachedPdfText || undefined,
        // Flow State: route through Groq for faster speeds
        persona === 'default' ? ctx.flowState : undefined,
        !collaborative ? sessionId : undefined,
        (approval: McpApprovalRequest) => {
          if (wasStopped()) return;
          approvalReceived = true;
          isDirtyRef.current = true;
          clearTurnState();
          setMessages(previous => {
            const updated = previous.map(messageItem => messageItem.id === aiMessageId
              ? {
                ...messageItem,
                content: `Approval required to run ${approval.toolName}.`,
                rawContent: undefined,
                status: 'complete' as const,
                mcpApproval: approval,
                hasAnimated: false,
              }
              : messageItem);
            if (sessionId && !collaborative) {
              setTimeout(() => saveChatSessionRef.current(sessionId, updated, persona, true), 0);
            }
            return updated;
          });
        },
        controller.signal,
      );
      return;
    }

    // Non-streaming fallback.
    try {
      const aiResponse = await generateAIResponse(
        apiMessages,
        ctx.imageData,
        '', // System prompt is now handled server-side
        persona,
        persona === 'pro' ? ctx.heatLevel : undefined,
        ctx.inputImageUrls,
        ctx.imageDimensions,
        uid || undefined,
        userMemoryContext,
        ctx.specialMode,
        ctx.pdfData,
        ctx.pdfFileName,
        cachedPdfText || undefined,
        persona === 'default' ? ctx.flowState : undefined,
        !collaborative ? sessionId : undefined,
        controller.signal,
      );

      if (wasStopped()) return;

      if (aiResponse.mcpApproval) {
        isDirtyRef.current = true;
        clearTurnState();
        setMessages(previous => previous.map(messageItem => messageItem.id === aiMessageId
          ? {
            ...messageItem,
            content: `Approval required to run ${aiResponse.mcpApproval!.toolName}.`,
            status: 'complete' as const,
            mcpApproval: aiResponse.mcpApproval,
          }
          : messageItem));
        return;
      }

      const emotion = extractEmotion(aiResponse.content);
      const cleanedContent = cleanContent(aiResponse.content);

      if (emotion) {
        setCurrentEmotion(emotion);
      }

      if (!cleanedContent.trim()) {
        failTurn(aiMessageId, new ChatError('EMPTY', 'The model returned an empty response.'));
        return;
      }

      setLoadingPhase(null);
      abortControllerRef.current = null;
      completeStreamingMessageRef.current(aiMessageId, cleanedContent, aiResponse.thinking, undefined, sessionId);
    } catch (error) {
      if (wasStopped()) return;
      console.error('Failed to generate response:', error instanceof Error ? error.message : error);

      if (error && typeof error === 'object' && 'type' in error && (error as { type?: string }).type === 'rateLimit') {
        failTurn(aiMessageId, new ChatError('RATE_LIMITED', 'Rate limit exceeded'));
        return;
      }
      failTurn(aiMessageId, error);
    }
  }, [clearTurnState, failTurn]);

  /** Messages worth sending as context: no welcome bubble, no failed turns. */
  const toApiContext = useCallback((list: Message[]) => (
    list.filter(msg => msg.id !== INITIAL_MESSAGE.id && msg.status !== 'error')
  ), []);

  const handleSendMessage = useCallback(async (
    content: string,
    imageData?: string | string[],
    inputImageUrls?: string[],
    imageDimensions?: ImageDimensions,
    replyTo?: { id: string; content: string; sender_nickname?: string; isAI: boolean },
    specialMode?: string,
    pdfData?: string,
    pdfFileName?: string
  ) => {
    const {
      messages: currentMessages,
      currentPersona: persona,
      currentProHeatLevel: heatLevel,
      isCollaborative: collaborative,
      collaborativeId: collabId,
      userId: uid,
      userProfile: profile,
      flowStateActive: flowState,
    } = latest.current;

    let messagePersona = persona;
    let messageContent = content;

    // Check for @persona mentions (case-insensitive)
    const mentionMatch = content.match(/^@(girlie|pro)\s+(.+)$/i);
    if (mentionMatch) {
      const mentionedModel = mentionMatch[1].toLowerCase();
      messagePersona = mentionedModel as keyof typeof AI_PERSONAS;
      messageContent = mentionMatch[2];
    }

    // Add display text for image/file-only messages.
    let finalContent = messageContent;
    if ((imageData || (inputImageUrls && inputImageUrls.length > 0)) && !messageContent.trim()) {
      finalContent = '[Image message]'; // Placeholder text for UI
    } else if (pdfData && !messageContent.trim()) {
      const isPdf = pdfFileName?.toLowerCase().endsWith('.pdf');
      finalContent = isPdf ? `[PDF: ${pdfFileName || 'document.pdf'}]` : `[File: ${pdfFileName || 'document.txt'}]`; // Placeholder text for UI
    }

    // Everything a retry needs, captured now. Retry re-runs the turn from
    // this, never from whatever the UI happens to be set to later (1.10).
    const retryContext: RetryContext = {
      persona: messagePersona,
      heatLevel: messagePersona === 'pro' ? heatLevel : undefined,
      specialMode,
      flowState: messagePersona === 'default' ? flowState : undefined,
      imageData,
      inputImageUrls,
      imageDimensions,
      pdfData,
      pdfFileName,
    };

    // Create user message with content for display
    // Use finalContent for attachment-only placeholders, otherwise keep the original content.
    const displayContent = (finalContent === '[Image message]' || finalContent.startsWith('[PDF:') || finalContent.startsWith('[File:')) ? finalContent : content;
    const userMessage: Message = {
      id: newId(),
      createdAt: new Date().toISOString(),
      content: displayContent, // Use placeholder for image/audio/pdf-only, otherwise original content
      isAI: false,
      hasAnimated: false,
      imageData: imageData,
      inputImageUrls: inputImageUrls,
      imageDimensions: imageDimensions,
      pdfData: pdfData ? 'attached' : undefined, // Don't store full base64 in message state, just flag it
      pdfFileName: pdfFileName,
      retryContext,
      // Add sender info for collaborative mode
      sender_id: collaborative ? uid || undefined : undefined,
      sender_nickname: collaborative ? profile?.nickname || undefined : undefined,
      // Add reply info if replying
      replyTo: replyTo
    };

    // Create API message with cleaned content (without @mention) for API call
    const apiUserMessage: Message = {
      id: newId(),
      createdAt: userMessage.createdAt,
      content: finalContent,
      isAI: false,
      hasAnimated: false,
      imageData: imageData,
      inputImageUrls: inputImageUrls,
      imageDimensions: imageDimensions
    };

    isDirtyRef.current = true; // Mark as dirty on user message send
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    // If in collaborative mode, sync user message to group_chat_messages table
    if (collaborative && collabId && uid && profile?.nickname) {
      sendGroupChatMessage(
        collabId,
        displayContent,
        uid,
        profile.nickname,
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

      if (!mentionsTimeMachine && !isReplyingToAI) {
        // Just send the message, no AI response
        setIsLoading(false);
        return;
      }
    }

    // Create placeholder AI message for streaming
    const aiMessageId = newId();
    const aiMessage: Message = {
      id: aiMessageId,
      createdAt: new Date().toISOString(),
      content: '',
      rawContent: '',
      isAI: true,
      hasAnimated: false,
      status: 'streaming',
      specialMode: specialMode
    };

    setMessages(prev => [...prev, aiMessage]);

    let apiMessages = toApiContext([...currentMessages, apiUserMessage]);

    // In collaborative mode, format user messages as dialogue for AI context
    if (collaborative) {
      apiMessages = formatMessagesAsDialogue(apiMessages);
    }

    // If this message includes PDF text, cache it for follow-up questions
    if (pdfData) {
      setActivePdfText(pdfData);
    }

    await runTurn(aiMessageId, apiMessages, retryContext);
  }, [runTurn, toApiContext]);

  /**
   * Rewind to just before a failed turn and re-run it.
   *
   * "Please try again" used to mean *retype your message* — the prompt was
   * gone from the input box and the placeholder had been deleted. This
   * re-sends the original user turn with its original attachments and
   * persona, and costs no extra quota: the server charges only for a
   * generation that succeeded, so the failed attempt was never billed (1.10).
   */
  const retryMessage = useCallback(async (aiMessageId: string) => {
    if (isStreamingRef.current) return;

    const currentMessages = latest.current.messages;
    const failedIndex = currentMessages.findIndex(msg => msg.id === aiMessageId);
    if (failedIndex < 0) return;

    // The user turn that produced it.
    let userIndex = failedIndex - 1;
    while (userIndex >= 0 && currentMessages[userIndex].isAI) userIndex--;
    if (userIndex < 0) return;

    const userMessage = currentMessages[userIndex];
    const ctx: RetryContext = userMessage.retryContext ?? {
      persona: latest.current.currentPersona,
      heatLevel: latest.current.currentProHeatLevel,
      flowState: latest.current.flowStateActive,
      imageData: userMessage.imageData,
      inputImageUrls: userMessage.inputImageUrls,
      imageDimensions: userMessage.imageDimensions,
    };

    // Everything strictly before the failed turn, plus a fresh placeholder.
    const history = currentMessages.slice(0, failedIndex);
    const newAiMessageId = newId();

    isDirtyRef.current = true;
    setMessages([
      ...history,
      {
        id: newAiMessageId,
        createdAt: new Date().toISOString(),
        content: '',
        rawContent: '',
        isAI: true,
        hasAnimated: false,
        status: 'streaming',
        specialMode: ctx.specialMode,
      },
    ]);
    setError(null);

    let apiMessages = toApiContext(history);
    if (latest.current.isCollaborative) {
      apiMessages = formatMessagesAsDialogue(apiMessages);
    }

    await runTurn(newAiMessageId, apiMessages, ctx);
  }, [runTurn, toApiContext]);

  /**
   * Cancel the generation in flight and settle the turn immediately.
   *
   * Aborting the fetch alone was not enough: whatever streamed so far stayed
   * on screen with the spinner still running until (and unless) the transport
   * surfaced the abort, and on the PRO path the signal was never wired up at
   * all, so Stop did nothing. The UI now finalises the turn itself — partial
   * text is kept as the answer, an empty one becomes a stopped-turn error —
   * and late callbacks for that turn are ignored.
   */
  const stopGeneration = useCallback(() => {
    const aiMessageId = streamingMessageIdRef.current;
    const controller = abortControllerRef.current;
    if (!aiMessageId && !controller) return;

    if (aiMessageId) stoppedTurnsRef.current.add(aiMessageId);
    controller?.abort();
    abortControllerRef.current = null;

    if (!aiMessageId) {
      clearTurnState();
      return;
    }

    const turnSessionId = latest.current.currentSessionId;
    isDirtyRef.current = true;
    setMessages(prev => {
      const updated = prev.map(msg => {
        if (msg.id !== aiMessageId) return msg;
        const partial = cleanContent(msg.content || '');
        return partial.trim()
          ? { ...msg, content: partial, rawContent: undefined, status: 'complete' as const, errorCode: undefined, partialContent: undefined, hasAnimated: true }
          : { ...msg, content: '', rawContent: undefined, status: 'error' as const, errorCode: 'ABORTED' as ChatErrorCode, partialContent: undefined, hasAnimated: true };
      });

      // A stopped turn is a real turn: it has to survive a reload like any
      // other, and with storage going device-only there is no cloud copy.
      if (turnSessionId && !latest.current.isCollaborative) {
        setTimeout(() => saveChatSessionRef.current(turnSessionId, updated, latest.current.currentPersona, true), 0);
      }

      return updated;
    });

    clearTurnState();
  }, [clearTurnState]);

  // Navigating away mid-generation used to leave the request running (and
  // billing) with nobody listening.
  useEffect(() => () => abortControllerRef.current?.abort(), []);
  const markMessageAsAnimated = useCallback((messageId: string) => {
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

    // Save the outgoing session before loading another — including a turn that
    // was still streaming, which used to be dropped wholesale (1.13).
    if (currentSessionId && messages.length > 1) {
      saveChatSession(currentSessionId, markStreamingAsInterrupted(messages), currentPersona, true);
    }

    // Cancel any generation still in flight: its result belongs to the chat
    // being left, and there is nowhere safe to put it once we've switched.
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    isStreamingRef.current = false;
    setStreamingMessageId(null);
    setIsLoading(false);

    // Filter out any empty messages from the loaded session
    const validMessages = session.messages.filter(msg => msg.content && msg.content.trim() !== '');

    // Ensure we have at least the initial message if all messages were empty
    const messagesToLoad = validMessages.length > 0
      ? validMessages
      : [{
        id: newId(),
        createdAt: new Date().toISOString(),
        content: cleanContent(AI_PERSONAS[session.persona].initialMessage),
        isAI: true,
        hasAnimated: false,
      }];

    // Update all state together
    setCurrentPersona(session.persona);
    setMessages(messagesToLoad);
    setChatMode(true);
    setCurrentSessionId(session.id);
    setPersonaTheme(session.persona);
    setError(null);
    setActivePdfText(null); // Clear PDF context when loading a different chat
    isDirtyRef.current = false; // Reset dirty state on load

    // Set heat level if it's a pro session
    if (session.heat_level) {
      setCurrentProHeatLevel(session.heat_level);
    }

    // If a PRO generation is still running in the background for this chat,
    // reattach to its stream and keep the message typing.
    tryResumeProGeneration(session.id, session.persona);
  }, [currentSessionId, messages, currentPersona, saveChatSession, setPersonaTheme, tryResumeProGeneration]);

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
      // Skip the initial welcome message
      const messagesToSync = messages.filter(m => m.id !== INITIAL_MESSAGE.id);
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
  const updateMessageReactions = useCallback((messageId: string, reactions: Record<string, string[]>) => {
    isDirtyRef.current = true;
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, reactions } : msg
    ));
  }, []);

  // Update music variations (Supabase URLs) on a specific message
  // Called when MusicComposeCard finishes uploading to Supabase
  const updateMusicVariations = useCallback((messageId: string, variations: MusicVariation[]) => {
    isDirtyRef.current = true;
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
    retryMessage,
    stopGeneration,
    handlePersonaChange,
    setCurrentProHeatLevel,
    startNewChat,
    markMessageAsAnimated,
    dismissAboutUs,
    loadChat,
    setUseStreaming,
    clearYoutubeMusic,
    // Collaborative actions
    enableCollaborativeMode,
    joinCollaborativeChat,
    leaveCollaborativeMode,
    updateMessageReactions,
    updateMusicVariations,
    handleMcpApprovalDecision,
    // Remote music
    pendingRemoteMusic,
    playPendingMusic,
    dismissPendingMusic
  };
}
