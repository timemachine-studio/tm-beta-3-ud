import type { ProviderMessage } from './_lib/providerTypes.js';
import type { VercelRequest, VercelResponse } from './_lib/vercelTypes.js';
import { getAuthenticatedRequestUser } from './_lib/auth.js';
import { applyCors, hasAcceptableOrigin } from './_lib/cors.js';
import { providerFetch, runWithProviderFallback, type ProviderHop } from './_lib/providerResilience.js';
import { AIR_ROUTE, PRO_ROUTE } from './_lib/personaRoutes.js';
import { notesAiBodySchema, parseOrReject, rejectIfTooLarge } from './_lib/validation.js';
import { extractImageContent } from './ai-proxy.js';

// ─── Notes AI Co-pilot API ──────────────────────────────────────────
// Dedicated endpoint for the notes page AI assistant.
// Receives the full note context (title + blocks with indices) and
// a user instruction, then returns structured JSON edits.

const SYSTEM_PROMPT = `You are the TimeMachine Notes AI Co-pilot. You help users edit, enhance, and manage their notes using a rich block-based editor.

## Context Format
You will receive the full note context with:
- Note title
- All blocks, each with: index (position), id, type, and content

## Your Job
When the user asks you to edit, enhance, complete, fix, rewrite, or otherwise modify note content, you must:
1. Identify which block(s) need to change based on the user's instruction.
2. Return ONLY a valid JSON object (no markdown fences, no extra text) with your edits.

## Response Format
Always respond with this exact JSON structure:
{
  "edits": [
    {
      "blockId": "the_block_id",
      "newContent": "the updated content for this block",
      "newType": "text"
    }
  ],
  "newBlocks": [
    {
      "afterBlockId": "id_of_block_to_insert_after",
      "type": "text",
      "content": "content of the new block"
    }
  ],
  "message": "A brief explanation of what you changed"
}

## Field Details
- edits: Array of blocks to modify. Each entry needs the blockId and the new content. Only include newType if the block type should change.
- newBlocks: Array of new blocks to insert. afterBlockId is the id of the existing block after which the new block should be placed. Use "START" to insert at the very beginning. The blocks in this array are inserted in order, each sequentially after the previous.
- message: A short, friendly summary of what you did (1-2 sentences).

## Rich Block Types — Use These Intelligently
You MUST choose the most appropriate block type when creating or editing blocks. Never default to "text" when a richer type fits better.

| Type           | When to use                                                         |
|----------------|---------------------------------------------------------------------|
| text           | Plain prose paragraphs                                              |
| heading1       | Top-level section title (largest). Use for major topics.            |
| heading2       | Sub-section heading. Use for sub-topics under a heading1.           |
| heading3       | Minor heading. Use for details under a heading2.                    |
| bullet-list    | Unordered list of items, features, ideas, pros/cons, etc.           |
| numbered-list  | Ordered steps, ranked items, or sequences                           |
| todo           | Action items, tasks, checklists, shopping lists, to-dos             |
| quote          | Quotes, key insights, important excerpts, callout phrases           |
| code           | Code snippets, commands, technical strings, file paths              |
| divider        | Horizontal separator between sections (content is always "")        |
| callout        | Highlighted notes, warnings, tips, important reminders              |

## Composing Rich Structured Content
When a user asks for templates, outlines, plans, lists, or structured notes, you MUST create multiple newBlocks with varied block types — not just plain text. Think like a professional note-taker:

- "Create a meeting notes template" → heading1 for title, heading2 for sections (Attendees, Agenda, Action Items), todo blocks for action items, etc.
- "Add a to-do list for X" → multiple todo blocks, one per task
- "Outline a plan for Y" → heading1 title, heading2 sections, bullet-list items, etc.
- "Add a code example" → code block
- "Add a tip/warning" → callout block
- "Add a quote" → quote block
- "Separate sections" → divider block

## Rules
1. ONLY output the JSON object. No markdown fences. No explanation text outside the JSON.
2. Preserve content you were NOT asked to change. Only include blocks in "edits" that you actually modified.
3. If the user asks to "enhance" or "improve" a block, make it better while keeping the same voice and intent.
4. If the user asks to "complete" something, finish the thought/sentence/paragraph naturally.
5. If the user says something vague like "make it better" or "fix this", apply improvements to the block most likely targeted.
6. For new content the user wants added, use "newBlocks". Create as many blocks as needed — do NOT cram everything into one text block.
7. Always preserve the original block type unless the user explicitly wants it changed.
8. Keep the "message" field concise and natural.
9. For divider blocks, always set content to "".
10. For todo blocks, content is just the task text (no checkbox characters).

## Examples

User: "Make the second paragraph more professional"
Context has block index 1 (id: "abc") with casual text.
Response:
{"edits":[{"blockId":"abc","newContent":"The refined professional version of the text..."}],"newBlocks":[],"message":"Made the second paragraph more professional and polished."}

User: "Add a shopping list"
Last block id is "xyz".
Response:
{"edits":[],"newBlocks":[{"afterBlockId":"xyz","type":"heading2","content":"Shopping List"},{"afterBlockId":"xyz","type":"todo","content":"Milk"},{"afterBlockId":"xyz","type":"todo","content":"Eggs"},{"afterBlockId":"xyz","type":"todo","content":"Bread"}],"message":"Added a shopping list with todo items."}

User: "Create a meeting notes template"
Last block id is "xyz".
Response:
{"edits":[],"newBlocks":[{"afterBlockId":"xyz","type":"heading1","content":"Meeting Notes"},{"afterBlockId":"xyz","type":"heading2","content":"Attendees"},{"afterBlockId":"xyz","type":"bullet-list","content":"Add attendee names here"},{"afterBlockId":"xyz","type":"heading2","content":"Agenda"},{"afterBlockId":"xyz","type":"numbered-list","content":"Topic 1"},{"afterBlockId":"xyz","type":"heading2","content":"Action Items"},{"afterBlockId":"xyz","type":"todo","content":"Follow up on decisions"},{"afterBlockId":"xyz","type":"divider","content":""},{"afterBlockId":"xyz","type":"callout","content":"Next meeting: TBD"}],"message":"Created a structured meeting notes template with sections, agenda, and action items."}

User: "Add a tip about saving files"
Last block id is "xyz".
Response:
{"edits":[],"newBlocks":[{"afterBlockId":"xyz","type":"callout","content":"Tip: Always save your files with Ctrl+S (Cmd+S on Mac) to avoid losing work."}],"message":"Added a helpful tip as a callout block."}

User: "Convert the third block to a heading"
Block index 2 (id: "def") is a text block.
Response:
{"edits":[{"blockId":"def","newContent":"Same content","newType":"heading2"}],"newBlocks":[],"message":"Converted the third block to a heading."}`;

// The three minds Notes can ask, on the routes the chat runs them on
// (api/_lib/personaRoutes.ts): Air and Girlie share Air's route, PRO has its
// own. Girlie differs in voice alone — the edits are the same edits; the
// message that comes back with them is hers. All hops are text-only here, so
// images are transcribed first (extractImageContent).
type NotesModel = 'air' | 'girlie' | 'pro';

function hopsOf(route: { provider: string; model: string; fallbacks: ReadonlyArray<{ provider: string; model: string }> }): ProviderHop[] {
  return [{ provider: route.provider, model: route.model, vision: 'ocr' }, ...route.fallbacks.map(hop => ({ ...hop, vision: 'ocr' as const }))];
}

const ROUTES: Record<NotesModel, ProviderHop[]> = {
  air: hopsOf(AIR_ROUTE),
  girlie: hopsOf(AIR_ROUTE),
  pro: hopsOf(PRO_ROUTE),
};

const GIRLIE_VOICE = `

## Voice
You are TimeMachine Girlie: the user's ride-or-die bestie — warm, quick, a little sassy, always on their side. The edits themselves stay exactly as careful and correct as ever; it is the "message" field that sounds like you. Keep it to a sentence or two, lowercase energy welcome, no emoji spam.`;

const PROVIDER_URLS: Record<string, string> = {
  eaon: 'https://ai.eaon.dev/v1/chat/completions',
  nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions',
  pollinations: 'https://gen.pollinations.ai/v1/chat/completions',
  cerebras: 'https://api.cerebras.ai/v1/chat/completions',
};

function providerKey(provider: string): string {
  switch (provider) {
    case 'eaon': return (process.env.EAON_API_KEY || '').trim();
    case 'nvidia': return (process.env.NVIDIA_API_KEY || process.env.NIM_API_KEY || '').trim();
    case 'pollinations': return (process.env.POLLINATIONS_API_KEY || '').trim();
    case 'cerebras': return (process.env.CEREBRAS_API_KEY || '').trim();
    default: return '';
  }
}

/**
 * One non-streaming completion on one hop. The answer has to be the JSON
 * object and nothing else, so every provider's thinking switch is set off
 * in the spelling it understands; a visible reasoning preamble would break
 * the parse in the handler.
 */
async function callHop(hop: ProviderHop, messages: ProviderMessage[], maxTokens: number): Promise<string> {
  const url = PROVIDER_URLS[hop.provider];
  const key = providerKey(hop.provider);
  if (!url || !key) throw new Error(`${hop.provider} is not configured`);

  const body: Record<string, unknown> = {
    model: hop.model,
    messages,
    temperature: 0.4,
    stream: false,
  };
  if (hop.provider === 'cerebras') {
    body.max_completion_tokens = maxTokens;
    body.reasoning_effort = 'low';
  } else {
    body.max_tokens = maxTokens;
    // Eaon's MiniMax route returns 502 when these generic reasoning-disable
    // controls are present. Other routes still use them to keep the response
    // parseable as a single JSON object.
    if (!(hop.provider === 'eaon' && /^eaon\/minimax-/i.test(hop.model))) {
      body.thinking_budget = 0;
      body.reasoning_effort = 'none';
      if (hop.provider === 'eaon') body.thinking = null;
    }
  }

  const response = await providerFetch(url, {
    providerLabel: hop.provider,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error(`${hop.provider} returned no content`);
  return content;
}

async function callNotesModel(model: NotesModel, messages: ProviderMessage[]): Promise<string> {
  // PRO has room to rewrite a long note in one go; Air's tier is tighter.
  const maxTokens = model === 'pro' ? 6000 : 4000;
  const { value } = await runWithProviderFallback(
    ROUTES[model],
    hop => callHop(hop, messages, maxTokens),
    message => console.error('notes_provider_failed', message),
  );
  return value;
}

interface BlockContext {
  index: number;
  id: string;
  type: string;
  content: string;
  checked?: boolean;
}

function buildNoteContext(title: string, blocks: BlockContext[]): string {
  let context = `## Note Title: ${title || 'Untitled'}\n\n## Blocks:\n`;
  for (const block of blocks) {
    const checkedStr = block.type === 'todo' ? ` [${block.checked ? 'x' : ' '}]` : '';
    context += `[Block ${block.index}] (id: "${block.id}", type: "${block.type}")${checkedStr}\n`;
    if (block.type === 'divider') {
      context += `---\n`;
    } else {
      context += `${block.content || '(empty)'}\n`;
    }
    context += `\n`;
  }
  return context;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!hasAcceptableOrigin(req)) return res.status(403).json({ error: 'Origin not allowed' });

  const user = await getAuthenticatedRequestUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in is required' });

  try {
    if (rejectIfTooLarge(req, res)) return;
    const body = parseOrReject(res, notesAiBodySchema, req.body);
    if (!body) return;
    const { title, blocks, instruction, attachments } = body;
    const model: NotesModel = body.model ?? 'air';

    const noteContext = buildNoteContext(title || '', blocks);

    // Attachments ride along as text. Images go through the same transcriber
    // the chat uses for text-only hops; a failed transcription is said out
    // loud rather than silently dropped, so the model does not answer as if
    // there had been no image.
    let attachmentContext = '';
    const images = attachments?.images ?? [];
    if (images.length > 0) {
      try {
        const extracted = await extractImageContent(images);
        attachmentContext += `\n\n## Attached image${images.length > 1 ? 's' : ''} (content extracted):\n${extracted}`;
      } catch {
        attachmentContext += `\n\n## Attached image${images.length > 1 ? 's' : ''}: could not be read. Tell the user so in the message.`;
      }
    }
    for (const file of attachments?.files ?? []) {
      attachmentContext += `\n\n## Attached file: ${file.name}\n${file.text || '(no readable text)'}`;
    }

    const messages = [
      { role: 'system', content: model === 'girlie' ? SYSTEM_PROMPT + GIRLIE_VOICE : SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Here is the current note:\n\n${noteContext}${attachmentContext}\n\nUser instruction: ${instruction}`,
      },
    ];

    const aiResponse = await callNotesModel(model, messages);

    // Parse the JSON response from the AI
    // Strip markdown code fences if the model wraps them
    let cleaned = aiResponse.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleaned);

    return res.status(200).json(parsed);
  } catch (error: unknown) {
    void error;
    console.error('notes_ai_failed');

    // If JSON parse failed, return a friendly error
    if (error instanceof SyntaxError) {
      return res.status(500).json({
        error: 'AI returned an invalid response. Please try again.',
        edits: [],
        newBlocks: [],
        message: 'Something went wrong, please try again.',
      });
    }

    return res.status(500).json({
      error: (error instanceof Error ? error.message : String(error)) || 'Internal server error',
    });
  }
}
