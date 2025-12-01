import { Message } from '../../types/chat';

const POLLINATIONS_API_KEY = 'plln_pk_jCIIjFYkfyAWJtyxOOQuUawdMvuSgskZ';

export type ExternalAIModel = 'chatgpt' | 'gemini' | 'claude' | 'grok';

interface ExternalAIConfig {
  baseUrl: string;
  model: string;
}

const AI_CONFIGS: Record<ExternalAIModel, ExternalAIConfig> = {
  chatgpt: {
    baseUrl: 'https://text.pollinations.ai',
    model: 'openai'
  },
  gemini: {
    baseUrl: 'https://text.pollinations.ai',
    model: 'gemini'
  },
  claude: {
    baseUrl: 'https://text.pollinations.ai',
    model: 'claude-fast'
  },
  grok: {
    baseUrl: 'https://text.pollinations.ai',
    model: 'grok'
  }
};

interface ExternalAIResponse {
  content: string;
  error?: string;
}

function convertMessagesToOpenAIFormat(messages: Message[]) {
  return messages.map(msg => ({
    role: msg.isAI ? 'assistant' : 'user',
    content: msg.content
  }));
}

export async function generateExternalAIResponse(
  model: ExternalAIModel,
  messages: Message[]
): Promise<ExternalAIResponse> {
  try {
    const config = AI_CONFIGS[model];
    const openAIMessages = convertMessagesToOpenAIFormat(messages);

    const response = await fetch(`${config.baseUrl}/openai/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${POLLINATIONS_API_KEY}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: openAIMessages,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.choices && data.choices.length > 0) {
      return {
        content: data.choices[0].message.content
      };
    }

    throw new Error('Invalid response format from AI');
  } catch (error) {
    console.error(`Failed to generate ${model} response:`, error);
    return {
      content: `I apologize, but I'm having trouble connecting to ${model}. Please try again.`,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function generateExternalAIResponseStreaming(
  model: ExternalAIModel,
  messages: Message[],
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void
): Promise<void> {
  try {
    const config = AI_CONFIGS[model];
    const openAIMessages = convertMessagesToOpenAIFormat(messages);

    const response = await fetch(`${config.baseUrl}/openai/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${POLLINATIONS_API_KEY}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: openAIMessages,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body received');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0]?.delta?.content) {
                onChunk(parsed.choices[0].delta.content);
              }
            } catch (e) {
              // Skip invalid JSON chunks
            }
          }
        }
      }

      onComplete();
    } catch (streamError) {
      console.error('Stream processing error:', streamError);
      onError(streamError instanceof Error ? streamError : new Error('Stream processing failed'));
    }
  } catch (error) {
    console.error(`Failed to generate streaming ${model} response:`, error);
    onError(error instanceof Error ? error : new Error(`Failed to connect to ${model}`));
  }
}
