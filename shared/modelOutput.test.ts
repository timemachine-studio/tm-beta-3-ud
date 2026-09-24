import { describe, expect, it } from 'vitest';
import { createPublicOutputFilter, extractModelOutput, stripPrivateModelMarkup } from './modelOutput.js';

describe('private model output', () => {
  it('never displays a content-encoded tool call, even before it closes', () => {
    expect(stripPrivateModelMarkup('Checking. <tool_call><invoke name="notes_read">')).toBe('Checking.');
    expect(stripPrivateModelMarkup('Checking. <tool_call><invoke name="notes_read"></invoke></tool_call> Done.')).toBe('Checking.  Done.');
  });

  it('extracts well-formed reasoning from the visible answer', () => {
    expect(extractModelOutput('<reason>private work</reason>Answer.')).toEqual({ content: 'Answer.', thinking: 'private work' });
  });

  it('never guesses that a paragraph inside unclosed reasoning is public', () => {
    expect(extractModelOutput('<think>private work\n\nmore private work\n\nDone. The same note was updated.')).toEqual({
      content: '',
    });
  });

  it('filters private blocks at every possible stream boundary', () => {
    const input = 'Hello <think>secret</think><tool_call>wire</tool_call><tm_objects private="true">ids</tm_objects>world';
    for (let split = 0; split <= input.length; split++) {
      const filter = createPublicOutputFilter();
      expect(filter.push(input.slice(0, split)) + filter.push(input.slice(split)) + filter.finish()).toBe('Hello world');
    }
    const filter = createPublicOutputFilter();
    expect([...input].map(char => filter.push(char)).join('')).toBe('Hello world');
  });

  it('keeps ambiguous unclosed reasoning private', () => {
    expect(extractModelOutput('<think>still working through the user data')).toEqual({
      content: '',
    });
  });
});
