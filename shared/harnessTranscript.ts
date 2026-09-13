import type { ToolTranscriptMessage } from './deviceTools.js';
import { MAX_MODE_TRANSCRIPT_BUDGET_CHARS, MAX_MODE_TRANSCRIPT_MESSAGES } from './maxMode.js';

const SUMMARY_PREFIX = '[Earlier workspace activity — compacted]\n';
const SUMMARY_CHARS = 12_000;
const SUMMARY_SUFFIX = '\nThese are abbreviated tool records, not full file contents. Re-read a file before editing it.';

/** Keep complete call/result groups; cutting individual messages orphans tool IDs. */
export function compactHarnessTranscript(messages: readonly ToolTranscriptMessage[]): ToolTranscriptMessage[] {
  if (messages.length <= MAX_MODE_TRANSCRIPT_MESSAGES && JSON.stringify(messages).length <= MAX_MODE_TRANSCRIPT_BUDGET_CHARS) return [...messages];
  const groups: ToolTranscriptMessage[][] = [];
  const summaries: string[] = [];
  for (const message of messages) {
    if (message.role === 'assistant' && !message.tool_calls?.length && message.content?.startsWith(SUMMARY_PREFIX)) {
      summaries.push(message.content.slice(SUMMARY_PREFIX.length).replace(SUMMARY_SUFFIX, ''));
      continue;
    }
    if (message.role === 'assistant' || !groups.length) groups.push([]);
    groups[groups.length - 1].push(message);
  }
  let count = groups.reduce((n, group) => n + group.length, 0);
  let chars = groups.reduce((n, group) => n + JSON.stringify(group).length, 0);
  while (groups.length > 0 && (count + 1 > MAX_MODE_TRANSCRIPT_MESSAGES || chars + SUMMARY_CHARS > MAX_MODE_TRANSCRIPT_BUDGET_CHARS)) {
    const group = groups.shift()!;
    count -= group.length;
    chars -= JSON.stringify(group).length;
    for (const call of group[0].tool_calls ?? []) {
      let path = '';
      try {
        const args = JSON.parse(call.function.arguments);
        if (typeof args.path === 'string') path = ` ${JSON.stringify(args.path).slice(0, 160)}`;
      } catch { /* An invalid call still has a useful error result. */ }
      const result = group.find(entry => entry.tool_call_id === call.id)?.content ?? 'result unavailable';
      summaries.push(`${call.function.name}${path}: ${result.length > 300 ? `${result.slice(0, 100)} … ${result.slice(-200)}` : result}`);
    }
  }
  const remaining = groups.flat();
  if (!summaries.length) return remaining;
  const summary = summaries.join('\n');
  return [{ role: 'assistant', content: SUMMARY_PREFIX
    + (summary.length > SUMMARY_CHARS ? `[Oldest activity omitted; inspect the current files.]\n${summary.slice(-SUMMARY_CHARS)}` : summary)
    + SUMMARY_SUFFIX }, ...remaining];
}
