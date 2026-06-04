import type { VercelRequest, VercelResponse } from '@vercel/node';

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

async function callCerebrasAPI(messages: any[]): Promise<string> {
  const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
  if (!CEREBRAS_API_KEY) {
    throw new Error('CEREBRAS_API_KEY not configured');
  }

  const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CEREBRAS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-oss-120b',
      messages,
      temperature: 0.4,
      max_completion_tokens: 4000,
      top_p: 1,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Cerebras API Error (Notes AI):', errorText);
    throw new Error(`Cerebras API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { title, blocks, instruction } = req.body;

    if (!blocks || !Array.isArray(blocks) || !instruction) {
      return res.status(400).json({ error: 'Missing required fields: blocks, instruction' });
    }

    const noteContext = buildNoteContext(title || '', blocks);

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Here is the current note:\n\n${noteContext}\n\nUser instruction: ${instruction}`,
      },
    ];

    const aiResponse = await callCerebrasAPI(messages);

    // Parse the JSON response from the AI
    // Strip markdown code fences if the model wraps them
    let cleaned = aiResponse.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleaned);

    return res.status(200).json(parsed);
  } catch (error: any) {
    console.error('Notes AI error:', error);

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
      error: error.message || 'Internal server error',
    });
  }
}
