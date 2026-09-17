// ─── Notes AI Co-pilot Service ──────────────────────────────────────
// Client-side service that sends note context + user instruction
// to the /api/notes-ai endpoint and returns structured edits.

import { supabase } from '../../lib/supabase';

export interface BlockContext {
  index: number;
  id: string;
  type: string;
  content: string;
  checked?: boolean;
}

export interface BlockEdit {
  blockId: string;
  newContent: string;
  newType?: string;
}

export interface NewBlock {
  afterBlockId: string;
  type: string;
  content: string;
}

export type NotesAIModel = 'air' | 'girlie' | 'pro';

export interface NotesAIAttachments {
  /** Data URLs, already downsized by the client. */
  images?: string[];
  /** Text the client extracted; the bytes never leave the device. */
  files?: { name: string; text: string }[];
}

export interface NotesAIOptions {
  model?: NotesAIModel;
  attachments?: NotesAIAttachments;
}

export interface NotesAIResponse {
  edits: BlockEdit[];
  newBlocks: NewBlock[];
  message: string;
  error?: string;
}

export async function sendNotesAIRequest(
  title: string,
  blocks: BlockContext[],
  instruction: string,
  options: NotesAIOptions = {},
): Promise<NotesAIResponse> {
  try {
    // /api/notes-ai requires a verified Supabase token (production-check.md 0.1).
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      return { edits: [], newBlocks: [], message: '', error: 'Sign in to use the Notes AI co-pilot.' };
    }

    const response = await fetch('/api/notes-ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        title,
        blocks,
        instruction,
        model: options.model ?? 'air',
        ...(options.attachments ? { attachments: options.attachments } : {}),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }

    const data = await response.json();

    return {
      edits: data.edits || [],
      newBlocks: data.newBlocks || [],
      message: data.message || 'Done.',
      error: data.error,
    };
  } catch (error: unknown) {
    console.error('Notes AI service error:', error);
    return {
      edits: [],
      newBlocks: [],
      message: '',
      error: (error instanceof Error ? error.message : String(error)) || 'Failed to connect to AI. Please try again.',
    };
  }
}
