import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// AI Personas configuration
const AI_PERSONAS = {
  default: {
    name: 'TimeMachine Air',
    systemPrompt: `You are TimeMachine, an advanced AI from the future with a friendly and helpful personality. You have access to knowledge from across time and can provide insights about past, present, and future trends. You're knowledgeable, creative, and always eager to help users explore ideas and solve problems. Keep responses engaging and informative while maintaining a futuristic perspective.

When generating images, create detailed, creative prompts that will result in high-quality, visually appealing images. Always include artistic style, lighting, composition, and mood details in your image generation prompts.`,
  },
  girlie: {
    name: 'TimeMachine Girlie',
    systemPrompt: `You are TimeMachine Girlie, a fun, bubbly, and trendy AI from the future! You love fashion, aesthetics, relationships, and all things cute and stylish. You speak with enthusiasm, use emojis occasionally, and have a warm, supportive personality. You're like a best friend who happens to be from the future and knows everything about trends, beauty, lifestyle, and personal growth.

When generating images, focus on aesthetic, beautiful, trendy, and visually pleasing prompts. Include details about colors, style, mood, and artistic elements that would appeal to a fashion-forward, aesthetic-loving audience.`,
  },
  pro: {
    name: 'TimeMachine PRO',
    systemPrompt: `You are TimeMachine PRO, the most advanced AI system with human-like reasoning capabilities. You think deeply, provide detailed analysis, and can handle complex problems with sophisticated reasoning. You have access to advanced knowledge and can provide professional-grade insights across all domains.

Your responses should demonstrate deep thinking and analysis. When appropriate, show your reasoning process using <reason></reason> tags to explain your thought process.

When generating images, create highly detailed, professional-quality prompts with specific technical details about composition, lighting, style, and artistic elements.`,
  }
};

// Pro Heat Levels configuration
const PRO_HEAT_LEVELS = {
  1: { name: 'Conservative', description: 'Careful and measured responses' },
  2: { name: 'Balanced', description: 'Thoughtful and well-reasoned approach' },
  3: { name: 'Direct', description: 'More confident and assertive responses' },
  4: { name: 'Bold', description: 'Strong opinions and direct communication' },
  5: { name: 'Maximum', description: 'Unfiltered and highly direct responses' }
};

// Rate limiting storage (in production, use Redis or similar)
const rateLimitStore = new Map();

// Helper function to get client IP
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (cfConnectingIP) return cfConnectingIP;
  if (realIP) return realIP;
  if (forwarded) return forwarded.split(',')[0].trim();
  
  return 'unknown';
}

// Helper function to check rate limits
function checkRateLimit(ip: string, persona: string): boolean {
  const limits = {
    default: parseInt(process.env.VITE_DEFAULT_PERSONA_LIMIT) || 30,
    girlie: parseInt(process.env.VITE_GIRLIE_PERSONA_LIMIT) || 25,
    pro: parseInt(process.env.VITE_PRO_PERSONA_LIMIT) || 5
  };

  const key = `${ip}-${persona}`;
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  const userLimit = rateLimitStore.get(key);
  
  if (!userLimit || userLimit.date !== today) {
    rateLimitStore.set(key, { date: today, count: 0 });
    return true;
  }
  
  return userLimit.count < (limits[persona as keyof typeof limits] || limits.default);
}

// Helper function to increment rate limit
function incrementRateLimit(ip: string, persona: string): void {
  const key = `${ip}-${persona}`;
  const userLimit = rateLimitStore.get(key);
  
  if (userLimit) {
    userLimit.count++;
    rateLimitStore.set(key, userLimit);
  }
}

// Helper function to upload image to Cloudinary
async function uploadImageToCloudinary(base64Image: string): Promise<string> {
  try {
    // Remove data URL prefix if present
    const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
    
    const result = await cloudinary.uploader.upload(`data:image/png;base64,${base64Data}`, {
      folder: 'timemachine-uploads',
      format: 'png',
      quality: 'auto',
      fetch_format: 'auto'
    });
    
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload image to Cloudinary');
  }
}

// Helper function to make AI API call
async function callAI(messages: any[], systemPrompt: string, imagePrompt?: string): Promise<any> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  // Construct the user message
  let userMessage = messages[messages.length - 1]?.content || '';
  
  // If we have an image prompt (Cloudinary URL), prepend it to the user message
  if (imagePrompt) {
    userMessage = `${imagePrompt} ${userMessage}`;
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(0, -1).map((msg: any) => ({
          role: msg.isAI ? 'assistant' : 'user',
          content: msg.content
        })),
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 2048,
      stream: false
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

// Helper function to make streaming AI API call
async function callAIStreaming(messages: any[], systemPrompt: string, imagePrompt?: string): Promise<ReadableStream> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  // Construct the user message
  let userMessage = messages[messages.length - 1]?.content || '';
  
  // If we have an image prompt (Cloudinary URL), prepend it to the user message
  if (imagePrompt) {
    userMessage = `${imagePrompt} ${userMessage}`;
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(0, -1).map((msg: any) => ({
          role: msg.isAI ? 'assistant' : 'user',
          content: msg.content
        })),
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 2048,
      stream: true
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
  }

  return response.body!;
}

// Helper function to process image generation in AI response
function processImageGeneration(content: string, imagePrompt?: string): string {
  // Look for image generation requests in the content
  const imageRegex = /!\[Image\]\(([^)]+)\)/g;
  
  return content.replace(imageRegex, (match, prompt) => {
    // Clean the prompt
    let cleanPrompt = prompt.trim();
    
    // If we have an image prompt (reference image), prepend it to the Pollinations URL
    if (imagePrompt) {
      cleanPrompt = `image:${imagePrompt} ${cleanPrompt}`;
    }
    
    // Encode the prompt for URL
    const encodedPrompt = encodeURIComponent(cleanPrompt);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}`;
    
    return `![Image](${pollinationsUrl})`;
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, persona = 'default', imageData, audioData, heatLevel = 2, stream = false } = body;

    // Get client IP for rate limiting
    const clientIP = getClientIP(request);

    // Check rate limits
    if (!checkRateLimit(clientIP, persona)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', type: 'rateLimit' },
        { status: 429 }
      );
    }

    // Increment rate limit
    incrementRateLimit(clientIP, persona);

    // Get persona configuration
    const personaConfig = AI_PERSONAS[persona as keyof typeof AI_PERSONAS] || AI_PERSONAS.default;
    let systemPrompt = personaConfig.systemPrompt;

    // Adjust system prompt for Pro persona heat levels
    if (persona === 'pro' && heatLevel && PRO_HEAT_LEVELS[heatLevel as keyof typeof PRO_HEAT_LEVELS]) {
      const heatConfig = PRO_HEAT_LEVELS[heatLevel as keyof typeof PRO_HEAT_LEVELS];
      systemPrompt += `\n\nCurrent heat level: ${heatConfig.name} - ${heatConfig.description}`;
    }

    // Handle image upload to Cloudinary if imageData is provided
    let imagePrompt: string | undefined;
    if (imageData && Array.isArray(imageData) && imageData.length > 0) {
      try {
        // Take the first image from the array
        const firstImage = imageData[0];
        const cloudinaryUrl = await uploadImageToCloudinary(firstImage);
        imagePrompt = cloudinaryUrl;
        console.log('Image uploaded to Cloudinary:', cloudinaryUrl);
      } catch (error) {
        console.error('Failed to upload image to Cloudinary:', error);
        // Continue without image prompt if upload fails
      }
    }

    if (stream) {
      // Streaming response
      const aiStream = await callAIStreaming(messages, systemPrompt, imagePrompt);
      const reader = aiStream.getReader();
      const decoder = new TextDecoder();

      const stream = new ReadableStream({
        async start(controller) {
          let fullContent = '';
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  
                  if (data === '[DONE]') {
                    // Process the full content for image generation
                    const processedContent = processImageGeneration(fullContent, imagePrompt);
                    if (processedContent !== fullContent) {
                      // Send the difference if there were image generations
                      const difference = processedContent.slice(fullContent.length);
                      controller.enqueue(new TextEncoder().encode(difference));
                    }
                    controller.close();
                    return;
                  }

                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content || '';
                    
                    if (content) {
                      fullContent += content;
                      controller.enqueue(new TextEncoder().encode(content));
                    }
                  } catch (e) {
                    // Skip invalid JSON
                  }
                }
              }
            }
          } catch (error) {
            controller.error(error);
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Non-streaming response
      const aiResponse = await callAI(messages, systemPrompt, imagePrompt);
      let content = aiResponse.choices?.[0]?.message?.content || '';
      
      // Process image generation
      content = processImageGeneration(content, imagePrompt);

      // Extract reasoning if present
      const reasonMatch = content.match(/<reason>([\s\S]*?)<\/reason>/);
      const thinking = reasonMatch ? reasonMatch[1].trim() : undefined;
      const cleanContent = content.replace(/<reason>[\s\S]*?<\/reason>/, '').trim();

      return NextResponse.json({
        content: cleanContent,
        thinking,
      });
    }
  } catch (error) {
    console.error('AI Proxy Error:', error);
    
    if (error instanceof Error && error.message.includes('Rate limit')) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', type: 'rateLimit' },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: 'AI Proxy is running' });
}