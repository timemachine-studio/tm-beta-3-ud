// ─── Notes AI Co-pilot Service ──────────────────────────────────────
// Client-side service that sends note context + user instruction
// to the /api/notes-ai endpoint and returns structured edits.

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

export interface NotesAIResponse {
  edits: BlockEdit[];
  newBlocks: NewBlock[];
  message: string;
  error?: string;
}

export async function sendNotesAIRequest(
  title: string,
  blocks: BlockContext[],
  instruction: string
): Promise<NotesAIResponse> {
  try {
    const response = await fetch('/api/notes-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, blocks, instruction }),
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
  } catch (error: any) {
    console.error('Notes AI service error:', error);
    return {
      edits: [],
      newBlocks: [],
      message: '',
      error: error.message || 'Failed to connect to AI. Please try again.',
    };
  }
}
