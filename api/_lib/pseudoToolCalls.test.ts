import { describe, expect, it } from 'vitest';
import { parsePseudoToolCalls, stripPseudoToolMarkup } from './pseudoToolCalls.js';
import type { ProviderTool } from './providerTypes.js';

const offered = (name: string, properties: Record<string, unknown> = {}): ProviderTool => ({
  type: 'function',
  function: { name, parameters: { type: 'object', properties } },
});

describe('MiniMax content-encoded tool calls', () => {
  const liveShape = `I'll search for that chat first, then create the note. <tool_call>
]<]minimax[>[ <invoke name="chats_search"> ]<]minimax[>[ <query> five minute timer</query>
]<]minimax[>[ <after> </after> ]<]minimax[>[ <before> </before> ]<]minimax[>[ </invoke>
]<]minimax[>[</tool_call>`;

  it('normalizes the live MiniMax markup into an offered tool call', () => {
    const calls = parsePseudoToolCalls(liveShape, [offered('chats_search')], 'run_1');
    expect(calls).toEqual([{
      id: 'run_1_0',
      type: 'function',
      function: { name: 'chats_search', arguments: '{"query":"five minute timer"}' },
    }]);
    expect(stripPseudoToolMarkup(liveShape)).toBe("I'll search for that chat first, then create the note.");
  });

  it('never promotes an unoffered name into an executable call', () => {
    const hostile = '<tool_call><invoke name="delete_everything"><path>/</path></invoke></tool_call>';
    expect(parsePseudoToolCalls(hostile, [offered('chats_search')], 'run_2')).toEqual([]);
  });

  it('coerces typed scalar arguments from the offered schema', () => {
    const content = '<tool_call><invoke name="timer_start"><duration>90</duration><silent>true</silent></invoke></tool_call>';
    const calls = parsePseudoToolCalls(content, [offered('timer_start', {
      duration: { type: 'number' },
      silent: { type: 'boolean' },
    })], 'run_3');
    expect(JSON.parse(calls[0].function.arguments)).toEqual({ duration: 90, silent: true });
  });
});
