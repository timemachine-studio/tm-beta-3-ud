export interface ExtractedModelOutput {
  content: string;
  thinking?: string;
}

const MINIMAX_SEPARATOR = /\]\s*<\]\s*minimax\s*\[>\s*\[/gi;
const TOOL_CALL_BLOCK = /<tool_call\b[^>]*>[\s\S]*?(?:<\/tool_call>|$)/gi;
const CLOSED_REASONING_BLOCK = /<(reason|think)>[\s\S]*?<\/\1>/gi;

/**
 * Split user-facing text from tagged model reasoning. A few providers have
 * been observed omitting the closing `</think>` tag. An unclosed block is
 * dropped completely: malformed private output is never promoted into UI
 * content or an expandable reasoning surface.
 */
export function extractModelOutput(fullContent: string): ExtractedModelOutput {
  const thinking: string[] = [];
  let visible = fullContent.replace(/<(reason|think)>([\s\S]*?)<\/\1>/gi, (_match, _tag, body: string) => {
    if (body.trim()) thinking.push(body.trim());
    return '';
  });

  const unclosed = /<(reason|think)>/i.exec(visible);
  if (unclosed) {
    const before = visible.slice(0, unclosed.index);
    visible = before;
  }

  const content = stripPrivateModelMarkup(visible).trim();
  return { content, ...(thinking.length > 0 ? { thinking: thinking.join('\n\n') } : {}) };
}

/** Hold partial tag prefixes across chunks; private bytes never reach a transport. */
export function createPublicOutputFilter() {
  const tags = ['think', 'reason', 'tool_call', 'tm_objects'];
  let pending = '';
  let hidden: string | null = null;
  return {
    push(chunk: string): string {
      pending += chunk;
      let output = '';
      while (pending) {
        if (hidden) {
          const end = `</${hidden}>`;
          const index = pending.toLowerCase().indexOf(end);
          if (index < 0) { pending = pending.slice(-(end.length - 1)); break; }
          pending = pending.slice(index + end.length);
          hidden = null;
          continue;
        }
        const index = pending.indexOf('<');
        if (index < 0) { output += pending; pending = ''; break; }
        output += pending.slice(0, index);
        pending = pending.slice(index);
        const lower = pending.toLowerCase();
        const opening = tags.find(tag => lower.startsWith(`<${tag}>`) || lower.startsWith(`<${tag} `));
        if (opening) {
          const end = pending.indexOf('>');
          if (end < 0) break;
          hidden = opening;
          pending = pending.slice(end + 1);
        } else if (tags.some(tag => `<${tag}>`.startsWith(lower))) {
          break;
        } else { output += pending[0]; pending = pending.slice(1); }
      }
      return output;
    },
    finish(): string { pending = ''; hidden = null; return ''; },
  };
}

/**
 * Safe for every render, including a response that is still streaming.
 * An opened private block is hidden through the current end of the string, so
 * raw XML cannot flash on screen while the closing bytes are still in flight.
 */
export function stripPrivateModelMarkup(content: string): string {
  return content
    .replace(TOOL_CALL_BLOCK, '')
    .replace(CLOSED_REASONING_BLOCK, '')
    .replace(/<(reason|think)>[\s\S]*$/gi, '')
    .replace(MINIMAX_SEPARATOR, '')
    .trim();
}
