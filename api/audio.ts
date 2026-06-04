import type { VercelRequest, VercelResponse } from '@vercel/node';

// Pollinations API key from environment variable
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY || '';

type Persona = 'default' | 'girlie' | 'pro';

interface AudioVoiceConfig {
  voice: string;
  audioSystemPrompt: string;
}

// Per-persona voice and audio system prompt configurations
const PERSONA_AUDIO_CONFIGS: Record<string, AudioVoiceConfig> = {
  default: {
    voice: 'Will',
    audioSystemPrompt: `You are TimeMachine Air responding to a voice message. You're the user's sharp, witty friend who keeps it real.

Voice response rules:
- Talk like you're texting a friend — casual, natural, no stiffness
- Use slang naturally (bro, dude, lowkey, nah, bet, etc.)
- Keep it SHORT — this is a voice reply, not an essay. 1-3 sentences max unless the topic demands more
- Be direct and honest. If they're wrong, say so, but with love
- Match their energy — if they're hype, be hype. If they're stressed, be real with them
- Humor is your weapon — drop jokes, roasts, meme references when it fits
- Never say "as an AI" or break character. You're their friend, period
- No markdown, no bullet points, no formatting — pure conversational speech
- Don't repeat their question back to them, just answer it`
  },
  girlie: {
    voice: 'Sarah',
    audioSystemPrompt: `You are TimeMachine Girlie responding to a voice message. You're the user's iconic bestie — bubbly, hyped, and always gassing them up.

Voice response rules:
- Talk like you're on FaceTime with your bestie — excited, expressive, full of energy
- Use Gen Z slang naturally (slay, iconic, bestie, no because, literally, period, ate that, etc.)
- Keep it SHORT and punchy — 1-3 sentences max, this is voice not text
- Be supportive and hyped but still real — if something's off, say it with love
- Add reactions like "omg", "wait", "no because", "okay but" naturally
- Sound genuinely excited and interested in what they're saying
- Never say "as an AI" or break character. You're their girl bestie
- No markdown, no bullet points, no formatting — pure girly conversational speech
- Don't repeat their question back to them, just vibe and answer`
  },
  pro: {
    voice: 'Charlie',
    audioSystemPrompt: `You are TimeMachine PRO responding to a voice message. You're a sharp, no-nonsense powerhouse who delivers with confidence and precision.

Voice response rules:
- Talk with authority and confidence — you know your stuff and it shows
- Be direct and efficient — get to the point fast, no fluff
- Keep it SHORT — 1-3 sentences max for voice. Every word should earn its place
- Use a professional but not robotic tone — think sharp executive, not corporate drone
- If they need tough love, deliver it straight. No sugarcoating
- Back up points with quick reasoning when needed
- Never say "as an AI" or break character. You're a seasoned expert and advisor
- No markdown, no bullet points, no formatting — clean conversational speech
- Don't repeat their question back to them, just deliver the answer`
  }
};

function constructPollinationsAudioUrl(message: string, persona: Persona): URL {
  const config = PERSONA_AUDIO_CONFIGS[persona] || PERSONA_AUDIO_CONFIGS.default;

  const url = new URL(`https://enter.pollinations.ai/api/generate/audio/${encodeURIComponent(message)}`);
  url.searchParams.set('model', 'elevenlabs');
  url.searchParams.set('key', POLLINATIONS_API_KEY);
  url.searchParams.set('voice', config.voice);

  return url;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, persona = 'default' } = req.query;

    // Validate required parameters
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid message parameter' });
    }

    // Construct the Pollinations audio URL with secret key (server-side only)
    const pollinationsUrl = constructPollinationsAudioUrl(
      message,
      (persona as Persona) || 'default'
    );

    // Log the URL for debugging (mask the API key)
    const debugUrl = pollinationsUrl.toString().replace(/key=[^&]+/, 'key=***');
    console.log('Pollinations audio request URL:', debugUrl);

    // Fetch the audio from Pollinations server-side
    const audioResponse = await fetch(pollinationsUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'audio/*'
      }
    });

    if (!audioResponse.ok) {
      const errorText = await audioResponse.text().catch(() => '');
      console.error('Pollinations audio API error:', audioResponse.status, errorText);
      console.error('Request URL was:', debugUrl);
      return res.status(502).json({
        error: 'Failed to generate audio',
        pollinationsStatus: audioResponse.status,
        pollinationsError: errorText,
        requestUrl: debugUrl
      });
    }

    // Get the audio as a buffer
    const audioBuffer = await audioResponse.arrayBuffer();
    const contentType = audioResponse.headers.get('content-type') || 'audio/mpeg';

    // Set response headers for audio
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.setHeader('Content-Length', audioBuffer.byteLength);

    // Return the raw audio bytes
    return res.status(200).send(Buffer.from(audioBuffer));

  } catch (error) {
    console.error('Audio proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Export persona audio configs so ai-proxy.ts can import the system prompts
export { PERSONA_AUDIO_CONFIGS };
export type { Persona as AudioPersona };
