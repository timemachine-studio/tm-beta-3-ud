import { Message, ImageDimensions } from '../../types/chat';
import { AI_PERSONAS } from '../../config/constants';

export interface YouTubeMusicData {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
}

interface AIResponse {
  content: string;
  thinking?: string;
  youtubeMusic?: YouTubeMusicData;
}

// Custom error class for rate limits
class RateLimitError extends Error {
  type: string;

  constructor(message: string) {
    super(message);
    this.type = 'rateLimit';
    this.name = 'RateLimitError';
  }
}

// User profile info for memory context
export interface UserMemoryContext {
  nickname?: string;
  about_me?: string;
}

// Streaming response handler
export async function generateAIResponseStreaming(
  messages: Message[],
  imageData?: string | string[],
  systemPrompt: string = '', // Not used anymore, kept for compatibility
  currentPersona: keyof typeof AI_PERSONAS = 'default',
  heatLevel?: number,
  inputImageUrls?: string[],
  imageDimensions?: ImageDimensions,
  onChunk?: (chunk: string) => void,
  onComplete?: (response: AIResponse) => void,
  onError?: (error: Error) => void,
  userId?: string,
  userMemories?: UserMemoryContext,
  specialMode?: string,
  onStatusChange?: (status: string) => void,
  pdfData?: string,
  pdfFileName?: string,
  pdfExtractedText?: string,
  flowState?: boolean
): Promise<void> {
  try {
    // Call the Vercel API route with streaming enabled
    const response = await fetch('/api/ai-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages.map(msg => ({
          content: msg.content,
          isAI: msg.isAI
        })),
        persona: currentPersona,
        imageData,
        heatLevel,
        inputImageUrls,
        imageDimensions,
        stream: true,
        flowState,
        userId,
        userMemories,
        specialMode,
        pdfData,
        pdfFileName,
        pdfExtractedText
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Check for rate limit errors
      if (response.status === 429 || errorData.type === 'rateLimit') {
        throw new RateLimitError('Rate limit exceeded');
      }

      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body received');
    }

    // Process streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let youtubeMusic: YouTubeMusicData | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        let chunk = decoder.decode(value, { stream: true });



        // Check for image analysis status markers
        if (chunk.includes('[IMAGE_ANALYZING]')) {
          chunk = chunk.replace('[IMAGE_ANALYZING]', '');
          if (onStatusChange) onStatusChange('analyzing_photo');
        }
        if (chunk.includes('[IMAGE_ANALYZED]')) {
          chunk = chunk.replace('[IMAGE_ANALYZED]', '');
          if (onStatusChange) onStatusChange('thinking');
        }

        // Check for custom tool/status markers
        if (chunk.includes('[STATUS:')) {
          const regex = /\[STATUS:(.*?)\]/g;
          let match;
          while ((match = regex.exec(chunk)) !== null) {
            const statusText = match[1];
            if (onStatusChange) onStatusChange(statusText);
          }
          chunk = chunk.replace(/\[STATUS:.*?\]/g, '');
        }
        if (chunk.includes('[STATUS_END]')) {
          chunk = chunk.replaceAll('[STATUS_END]', '');
          if (onStatusChange) onStatusChange('thinking');
        }

        // Check for YouTube Music marker
        const musicMatch = chunk.match(/\[YOUTUBE_MUSIC\](.*?)\[\/YOUTUBE_MUSIC\]/);
        if (musicMatch) {
          try {
            youtubeMusic = JSON.parse(musicMatch[1]);
          } catch (e) {
            console.error('Error parsing YouTube music data:', e);
          }
          chunk = chunk.replace(/\[YOUTUBE_MUSIC\].*?\[\/YOUTUBE_MUSIC\]/, '');
        }

        if (chunk && onChunk) {
          onChunk(chunk);
        }
        fullContent += chunk;
      }

      // Extract reasoning and clean content
      const reasoningBlocks = [...fullContent.matchAll(/<(reason|think)>([\s\S]*?)<\/\1>/gi)].map(m => m[2].trim());
      const thinking = reasoningBlocks.length > 0 ? reasoningBlocks.join('\n\n') : undefined;
      const cleanContent = fullContent.replace(/<(reason|think)>[\s\S]*?<\/\1>/gi, '').trim();

      if (onComplete) {
        onComplete({
          content: cleanContent,
          thinking,
          youtubeMusic,
        });
      }

    } catch (streamError) {
      console.error('Stream processing error:', streamError);
      if (onError) {
        onError(streamError instanceof Error ? streamError : new Error('Stream processing failed'));
      }
    }

  } catch (error) {
    console.error('Error calling AI proxy:', error);

    if (error instanceof RateLimitError) {
      if (onError) onError(error);
      return;
    }

    const fallbackError = error instanceof Error ? error : new Error('Unknown error occurred');
    if (onError) {
      onError(fallbackError);
    }
  }
}

// Non-streaming response (existing function, kept for compatibility)
export async function generateAIResponse(
  messages: Message[],
  imageData?: string | string[],
  systemPrompt: string = '', // Not used anymore, kept for compatibility
  currentPersona: keyof typeof AI_PERSONAS = 'default',
  heatLevel?: number,
  inputImageUrls?: string[],
  imageDimensions?: ImageDimensions,
  userId?: string,
  userMemories?: UserMemoryContext,
  specialMode?: string,
  pdfData?: string,
  pdfFileName?: string,
  pdfExtractedText?: string,
  flowState?: boolean
): Promise<AIResponse> {
  try {
    // Call the Vercel API route without streaming
    const response = await fetch('/api/ai-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages.map(msg => ({
          content: msg.content,
          isAI: msg.isAI
        })),
        persona: currentPersona,
        imageData,
        heatLevel,
        inputImageUrls,
        imageDimensions,
        stream: false,
        flowState,
        userId,
        userMemories,
        specialMode,
        pdfData,
        pdfFileName,
        pdfExtractedText
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Check for rate limit errors
      if (response.status === 429 || errorData.type === 'rateLimit') {
        throw new RateLimitError('Rate limit exceeded');
      }

      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    // Get the complete JSON response
    const result = await response.json();
    return result;

  } catch (error) {
    console.error('Error calling AI proxy:', error);

    if (error instanceof RateLimitError) {
      throw error; // Re-throw rate limit errors to be handled by the UI
    }

    if (error instanceof Error) {
      // Return simplified error message for other errors
      return {
        content: "I apologize, but I'm having trouble connecting right now. Please try again in a moment."
      };
    }

    return {
      content: "I apologize, but I'm having trouble connecting right now. Please try again in a moment."
    };
  }
}
