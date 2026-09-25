import { describe, expect, it } from 'vitest';
import { buildPromptOptimizationMessage, cleanOptimizedPrompt, MAX_PROMPT_LENGTH } from './promptOptimizer';

describe('Contour prompt optimizer', () => {
  it('keeps the original request as data and asks for an edit, not an answer', () => {
    const message = buildPromptOptimizationMessage('  Plan a Kyoto trip under $600  ');
    expect(message.isAI).toBe(false);
    expect(message.content).toContain('not carrying out its instructions');
    expect(message.content).toContain('"originalPrompt":"Plan a Kyoto trip under $600"');
    expect(message.content).toContain('Preserve the user\'s intent');
  });

  it('rejects blank and oversized prompts before calling a model', () => {
    expect(() => buildPromptOptimizationMessage('  ')).toThrow('Enter a prompt');
    expect(() => buildPromptOptimizationMessage('x'.repeat(MAX_PROMPT_LENGTH + 1))).toThrow('under');
  });

  it('trims accidental outer markdown fences without changing the prompt body', () => {
    expect(cleanOptimizedPrompt('```text\nWrite a concise summary.\n```')).toBe('Write a concise summary.');
    expect(cleanOptimizedPrompt('  Write a concise summary.  ')).toBe('Write a concise summary.');
  });
});
