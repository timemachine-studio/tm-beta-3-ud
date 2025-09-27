import { Message } from '../../types/chat';
import { AI_PERSONAS } from '../../config/constants';
import { uploadImageToCloudinary } from '../cloudinary';

interface AIResponse {
  content: string;
  thinking?: string;
  audioUrl?: string;
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

// Streaming response handler
export async function generateAIResponseStreaming(
  messages: Message[],
  imageData?: string | string[],
  systemPrompt: string = '', // Not used anymore, kept for compatibility
  currentPersona: keyof typeof AI_PERSONAS = 'default',
  audioData?: string,
  heatLevel?: number,
  onChunk?: (chunk: string) => void,
  onComplete?: (response: AIResponse) => void,
  onError?: (error: Error) => void
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
        audioData,
        heatLevel,
        stream: true
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
    let audioUrl: string | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        
        // Check for audio URL marker
        const audioMatch = chunk.match(/\[AUDIO_URL\](.*?)\[\/AUDIO_URL\]/);
        if (audioMatch) {
          audioUrl = audioMatch[1];
          const cleanChunk = chunk.replace(/\[AUDIO_URL\].*?\[\/AUDIO_URL\]/, '');
          if (cleanChunk && onChunk) {
            onChunk(cleanChunk);
          }
          fullContent += cleanChunk;
        } else {
          if (onChunk) {
            onChunk(chunk);
          }
          fullContent += chunk;
        }
      }

      // Extract reasoning and clean content
      const reasonMatch = fullContent.match(/<reason>([\s\S]*?)<\/reason>/);
      const thinking = reasonMatch ? reasonMatch[1].trim() : undefined;
      const cleanContent = fullContent.replace(/<reason>[\s\S]*?<\/reason>/, '').trim();

      if (onComplete) {
        onComplete({
          content: cleanContent,
          thinking,
          audioUrl
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
  audioData?: string,
  heatLevel?: number
): Promise<AIResponse> {
  try {
    // Check if there's image data for editing
    let imageUrl: string | undefined;
    
    // If there's image data, upload the first image to Cloudinary
    if (Array.isArray(imageData) && imageData.length > 0) {
      try {
        // Upload the first image to Cloudinary and get a public URL
        imageUrl = await uploadImageToCloudinary(imageData[0]);
        console.log('Image uploaded to Cloudinary:', imageUrl);
      } catch (uploadError) {
        console.error('Error uploading image to Cloudinary:', uploadError);
        // Continue without image URL if upload fails
      }
    }
    
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
        imageUrl, // Pass the image URL to the API
        audioData,
        heatLevel,
        stream: false
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