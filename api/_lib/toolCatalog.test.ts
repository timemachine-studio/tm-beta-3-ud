import { describe, expect, it } from 'vitest';
import {
  BUILTIN_CATALOG,
  createToolPolicy,
  applyPolicy,
  executeTool,
  selectToolSet,
  buildToolGuardrail,
  wantsImageTool,
  wantsWebSearchTool,
} from './tools.js';
import { runAgentLoop, trimToolResults } from './agentLoop.js';
import {
  MAX_TOOLS_PER_FIND,
  estimateSchemaTokens,
  packTools,
  rankFindableTools,
  type ToolDescriptor,
} from '../../shared/toolCatalog.js';
import type { ProviderTool } from './providerTypes.js';

const names = (tools: ProviderTool[]) => tools.map(tool => tool.function.name);
const userTurn = (content: string) => [{ content, isAI: false }];
const silentEmitter = { emitText: () => {}, emitMarker: () => {} };

// The gates below were regular expressions with no tests at all before the
// catalogue landed. These pin the behaviour their comments claimed, so the
// port from regex to term lists is verified rather than assumed.
describe('selection gates, ported from the original regexes', () => {
  it('offers the image tool when a picture is the deliverable', () => {
    for (const ask of ['make an image of a cat', 'draw me a dragon', 'I need a logo for my shop']) {
      expect(wantsImageTool({ lastUserText: ask, lastAssistantText: '', hasAttachedImage: false }))
        .toBe(true);
    }
  });

  it('never offers it on a build request, whatever else the message mentions', () => {
    // The failure this whole mechanism exists for: "make a game in html" came
    // back as a picture of a game.
    for (const ask of [
      'make me a game in html',
      'draw a diagram of the architecture as an svg',
      'write a python script that renders art',
    ]) {
      expect(wantsImageTool({ lastUserText: ask, lastAssistantText: '', hasAttachedImage: false }))
        .toBe(false);
    }
  });

  it('follows up on a picture it produced last turn', () => {
    expect(wantsImageTool({
      lastUserText: 'make it darker',
      lastAssistantText: 'Here you go ![Generated Image](/api/image?prompt=cat)',
      hasAttachedImage: false,
    })).toBe(true);

    // The same words with no picture behind them are just a conversation.
    expect(wantsImageTool({
      lastUserText: 'make it darker',
      lastAssistantText: 'The room is painted beige.',
      hasAttachedImage: false,
    })).toBe(false);
  });

  it('follows up on an image the user just attached', () => {
    expect(wantsImageTool({
      lastUserText: 'remove the background',
      lastAssistantText: '',
      hasAttachedImage: true,
    })).toBe(true);
  });

  it('offers web_search only for things a live lookup answers', () => {
    expect(wantsWebSearchTool('what is the latest news on the election')).toBe(true);
    expect(wantsWebSearchTool('look up the weather in Dhaka')).toBe(true);
    // The year predicate, which used to be an alternation inside the regex.
    expect(wantsWebSearchTool('who won the world cup in 2026')).toBe(true);
    expect(wantsWebSearchTool('explain how recursion works')).toBe(false);
  });

  it('matches phrases that the old regex spelled with an optional space', () => {
    expect(wantsWebSearchTool('lookup the exchange rate')).toBe(true);
    expect(wantsWebSearchTool('look up the exchange rate')).toBe(true);
  });
});

describe('web_fetch selection', () => {
  it('is offered when the user pastes a link', () => {
    const set = selectToolSet({ messages: userTurn('summarise https://example.com/post for me') });
    expect(names(set.tools)).toContain('web_fetch');
  });

  it('stays out of a message with no page to read', () => {
    const set = selectToolSet({ messages: userTurn('explain quantum tunnelling') });
    expect(names(set.tools)).not.toContain('web_fetch');
  });

  it('is still loadable when the gate declined it', () => {
    // "Read the Wikipedia page on X" carries no URL. The gate is a guess; the
    // model asking for the capability by name is not.
    const set = selectToolSet({ messages: userTurn('explain quantum tunnelling') });
    expect(set.findable.map(d => d.name)).toContain('web_fetch');
  });
});

describe('gateIsFinal', () => {
  it('keeps generate_image out of the catalogue when its gate declined', () => {
    const set = selectToolSet({ messages: userTurn('write me a haiku about rain') });
    expect(names(set.tools)).not.toContain('generate_image');
    // Not offered *and* not findable: find_tools is not a way round this gate.
    expect(set.findable.map(d => d.name)).not.toContain('generate_image');
  });

  it('keeps it out on a vetoed build turn too', () => {
    const set = selectToolSet({ messages: userTurn('build me an html game with pictures') });
    expect(names(set.tools)).not.toContain('generate_image');
    expect(set.findable.map(d => d.name)).not.toContain('generate_image');
  });
});

describe('token budget', () => {
  const bigTool = (name: string, padding: number): ToolDescriptor => ({
    name,
    definition: {
      type: 'function',
      function: { name, description: 'x'.repeat(padding), parameters: { type: 'object', properties: {} } },
    },
    runtime: 'server',
    tier: 'gated',
    summary: `${name} summary`,
    select: { intent: ['widget'] },
  });

  const ctx = {
    lastUserText: 'widget',
    lastAssistantText: '',
    hasAttachedImage: false,
    hasAttachedPdf: false,
    capabilities: [] as string[],
  };

  it('packs what fits and makes the rest findable', () => {
    const packed = packTools([bigTool('a', 900), bigTool('b', 900)], ctx, 400);
    expect(packed.offered).toHaveLength(1);
    expect(packed.findable).toHaveLength(1);
    // Nothing is lost — it moved, so find_tools can still reach it.
    expect([...packed.offered, ...packed.findable]).toHaveLength(2);
  });

  it('never drops a core tool, even when that overruns', () => {
    const core: ToolDescriptor = { ...bigTool('core_tool', 900), tier: 'core', select: undefined };
    const packed = packTools([core, bigTool('gated_tool', 900)], ctx, 100);
    expect(packed.offered.map(d => d.name)).toEqual(['core_tool']);
    expect(packed.findable.map(d => d.name)).toEqual(['gated_tool']);
    expect(packed.tokensUsed).toBeGreaterThan(100);
  });

  it('gives PRO more room than Air for the same turn', () => {
    const air = selectToolSet({ messages: userTurn('hello'), surface: 'air' });
    const pro = selectToolSet({ messages: userTurn('hello'), surface: 'pro', includeSkills: true });
    expect(pro.tokensUsed).toBeGreaterThan(air.tokensUsed);
  });
});

describe('find_tools', () => {
  it('can be turned off for a deployment', () => {
    const previous = process.env.FIND_TOOLS_MIN_TAIL;
    process.env.FIND_TOOLS_MIN_TAIL = '99';
    try {
      const set = selectToolSet({ messages: userTurn('hello there') });
      expect(names(set.tools)).not.toContain('find_tools');
      // The catalogue is still computed — only the door is closed.
      expect(set.findable.length).toBeGreaterThan(0);
    } finally {
      if (previous === undefined) delete process.env.FIND_TOOLS_MIN_TAIL;
      else process.env.FIND_TOOLS_MIN_TAIL = previous;
    }
  });

  it('is offered only when the catalogue still holds something', () => {
    const withTail = selectToolSet({ messages: userTurn('hello there') });
    expect(withTail.canFindTools).toBe(true);
    expect(names(withTail.tools)).toContain('find_tools');

    // A special mode that named its own tools is a closed set.
    const closed = selectToolSet({
      specialModeConfig: { tools: ['webSearch'] },
      messages: userTurn('what is the latest news'),
    });
    expect(closed.canFindTools).toBe(false);
    expect(names(closed.tools)).not.toContain('find_tools');
  });

  it('rewrites the tool policy so it does not contradict itself', () => {
    // Rule 3 without find_tools says an unlisted tool does not exist. With
    // find_tools that is false, and shipping both teaches the model to ignore
    // the policy block.
    expect(buildToolGuardrail({ canFindTools: false })).toContain('it does not exist for this turn');
    expect(buildToolGuardrail({ canFindTools: true })).toContain('call find_tools to load it');
  });

  it('loads matching schemas into the run', async () => {
    const set = selectToolSet({ messages: userTurn('explain quantum tunnelling') });
    const policy = createToolPolicy({ offered: names(set.tools) });

    const result = await executeTool(
      { id: '1', function: { name: 'find_tools', arguments: JSON.stringify({ query: 'read a web page' }) } },
      { persona: 'default', policy, findable: set.findable },
      silentEmitter,
    );

    expect(result).toContain('web_fetch');
    expect(policy.granted.map(t => t.function.name)).toContain('web_fetch');
    // The next iteration's tool list is where the grant actually lands.
    expect(names(applyPolicy(set.tools, policy))).toContain('web_fetch');
  });

  it('loads a bounded number at a time', async () => {
    const many: ToolDescriptor[] = Array.from({ length: 8 }, (_unused, index) => ({
      name: `widget_${index}`,
      definition: {
        type: 'function',
        function: { name: `widget_${index}`, description: 'widget tool', parameters: { type: 'object', properties: {} } },
      },
      runtime: 'server',
      tier: 'catalog',
      summary: 'A widget tool for widget work',
    }));
    const policy = createToolPolicy({ offered: ['find_tools'] });

    const result = await executeTool(
      { id: '1', function: { name: 'find_tools', arguments: JSON.stringify({ query: 'widget' }) } },
      { persona: 'default', policy, findable: many },
      silentEmitter,
    );

    expect(policy.granted).toHaveLength(MAX_TOOLS_PER_FIND);
    expect(result).toContain('Also matched but not loaded');
  });

  it('says so plainly when there is nothing left to load', async () => {
    const policy = createToolPolicy({ offered: ['find_tools'] });
    const result = await executeTool(
      { id: '1', function: { name: 'find_tools', arguments: JSON.stringify({ query: 'anything' }) } },
      { persona: 'default', policy, findable: [] },
      silentEmitter,
    );
    expect(result).toContain('No further tools are available');
    expect(policy.granted).toHaveLength(0);
  });

  it('ranks by overlap with name, summary and intent terms', () => {
    const matches = rankFindableTools(
      BUILTIN_CATALOG.filter(d => d.name === 'web_fetch' || d.name === 'healthcare_search'),
      'read the text of a web page',
    );
    expect(matches[0].descriptor.name).toBe('web_fetch');
  });
});

describe('the runtime backstop, generalised', () => {
  it('refuses a tool that was never offered, and revokes the name', async () => {
    const policy = createToolPolicy({ offered: ['web_search'] });
    const result = await executeTool(
      { id: '1', function: { name: 'run_python', arguments: '{}' } },
      { persona: 'default', policy },
      silentEmitter,
    );
    expect(result).toContain('was not offered for this request');
    expect(policy.revoked.has('run_python')).toBe(true);
  });

  it('stays out of the way when the call site did not say what it offered', async () => {
    // Older call sites pass only the two flags. They must keep working.
    const policy = createToolPolicy({ imageAllowed: false, searchAllowed: true });
    const result = await executeTool(
      { id: '1', function: { name: 'generate_image', arguments: JSON.stringify({ prompt: 'cat' }) } },
      { persona: 'default', policy },
      silentEmitter,
    );
    expect(result).toContain('not available for this request');
  });

  it('lets a granted tool through', async () => {
    const policy = createToolPolicy({ offered: ['find_tools'] });
    policy.granted.push({
      type: 'function',
      function: { name: 'healthcare_search', description: '', parameters: {} },
    });
    const result = await executeTool(
      { id: '1', function: { name: 'healthcare_search', arguments: JSON.stringify({ query: 'napa' }) } },
      { persona: 'default', policy, healthcareSearch: async () => 'Napa 500mg' },
      silentEmitter,
    );
    expect(result).toBe('Napa 500mg');
  });
});

describe('find_tools in the agent loop', () => {
  /** One model turn that calls find_tools, then one that answers. */
  function scriptedModel(calls: ProviderTool[][]) {
    let turn = 0;
    return async (_messages: unknown, activeTools: ProviderTool[]) => {
      calls.push(activeTools);
      const first = turn++ === 0;
      const frames = first
        ? [{ type: 'tool_calls', tool_calls: [{ index: 0, id: 'c1', type: 'function', function: { name: 'find_tools', arguments: '{"query":"read a web page"}' } }] }]
        : [{ type: 'content', content: 'done' }];
      return new ReadableStream({
        start(controller) {
          for (const frame of frames) controller.enqueue(new TextEncoder().encode(`${JSON.stringify(frame)}\n`));
          controller.close();
        },
      });
    };
  }

  it('puts a loaded tool into the very next request', async () => {
    const set = selectToolSet({ messages: userTurn('explain quantum tunnelling') });
    const policy = createToolPolicy({ offered: names(set.tools) });
    const calls: ProviderTool[][] = [];

    await runAgentLoop({
      messages: [],
      tools: set.tools,
      toolContext: { persona: 'default', policy, findable: set.findable },
      emit: { emitContent: () => {}, emitToolText: () => {}, emitMarker: () => {} },
      callModel: scriptedModel(calls),
    });

    expect(names(calls[0])).not.toContain('web_fetch');
    expect(names(calls[1])).toContain('web_fetch');
  });

  it('withdraws find_tools one iteration before the end', async () => {
    const set = selectToolSet({ messages: userTurn('hello') });
    const calls: ProviderTool[][] = [];
    await runAgentLoop({
      messages: [],
      tools: set.tools,
      toolContext: { persona: 'default', policy: createToolPolicy({ offered: names(set.tools) }), findable: set.findable },
      emit: { emitContent: () => {}, emitToolText: () => {}, emitMarker: () => {} },
      callModel: async (_m, activeTools) => {
        calls.push(activeTools);
        return new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(`${JSON.stringify({ type: 'content', content: 'hi' })}\n`));
            controller.close();
          },
        });
      },
      maxIterations: 2,
    });
    // maxIterations 2 means iteration 1 is already the second-to-last: a tool
    // loaded there could only be called on iteration 2, which runs with none.
    expect(names(calls[0])).not.toContain('find_tools');
  });
});

describe('an empty answer', () => {
  const stream = (frames: object[]) => new ReadableStream({
    start(controller) {
      for (const frame of frames) controller.enqueue(new TextEncoder().encode(`${JSON.stringify(frame)}\n`));
      controller.close();
    },
  });
  const quiet = { emitContent: () => {}, emitToolText: () => {}, emitMarker: () => {} };

  it('is retried once when nothing has reached the client yet, and the caller is told why', async () => {
    let calls = 0;
    const attempts: boolean[] = [];
    const result = await runAgentLoop({
      messages: [],
      tools: [],
      toolContext: { persona: 'default' },
      emit: quiet,
      callModel: async (_m, _t, attempt) => {
        attempts.push(attempt.afterEmptyAnswer);
        return stream(++calls === 1 ? [] : [{ type: 'content', content: 'second time lucky' }]);
      },
    });
    expect(calls).toBe(2);
    // The flag is what lets the route walk past the hop that said nothing —
    // the fallback chain cannot see an empty answer on its own.
    expect(attempts).toEqual([false, true]);
    expect(result.content).toBe('second time lucky');
    expect(result.iterations).toBe(1);
  });

  it('is retried only once, and never after text has streamed', async () => {
    let calls = 0;
    const twiceEmpty = await runAgentLoop({
      messages: [], tools: [], toolContext: { persona: 'default' }, emit: quiet,
      callModel: async () => { calls++; return stream([]); },
    });
    expect(calls).toBe(2);
    expect(twiceEmpty.content).toBe('');

    // A tool call on iteration 1 produced text, so an empty iteration 2 is a
    // finished answer, not a failure to retry — retrying would duplicate it.
    calls = 0;
    const afterText = await runAgentLoop({
      messages: [], tools: [], toolContext: { persona: 'default' }, emit: quiet,
      callModel: async () => stream(++calls === 1
        ? [{ type: 'content', content: 'partial' }, { type: 'tool_calls', tool_calls: [{ index: 0, id: 'c1', type: 'function', function: { name: 'no_such_tool', arguments: '{}' } }] }]
        : []),
    });
    expect(calls).toBe(2);
    expect(afterText.content).toBe('partial');
  });
});

describe('catalogue integrity', () => {
  it('names every descriptor after the tool it describes', () => {
    for (const descriptor of BUILTIN_CATALOG) {
      expect(descriptor.definition.function.name).toBe(descriptor.name);
    }
  });

  it('keeps find_tools cheap, because it rides on almost every request', () => {
    const set = selectToolSet({ messages: userTurn('hello') });
    const findTools = set.tools.find(tool => tool.function.name === 'find_tools');
    expect(findTools).toBeDefined();
    expect(estimateSchemaTokens(findTools as never)).toBeLessThan(180);
  });

  it('gives every descriptor a summary for find_tools to show', () => {
    for (const descriptor of BUILTIN_CATALOG) {
      expect(descriptor.summary.length).toBeGreaterThan(0);
      expect(descriptor.summary.length).toBeLessThan(120);
    }
  });
});

describe('trimming replayed tool output', () => {
  const toolMessage = (id: string, name: string, chars: number) => ({
    role: 'tool', tool_call_id: id, name, content: 'x'.repeat(chars),
  });

  it('leaves a transcript that fits the budget alone', () => {
    const messages = [
      { role: 'user', content: 'hi' },
      toolMessage('1', 'web_fetch', 100),
    ];
    expect(trimToolResults(messages, 1000)).toBe(messages);
  });

  it('trims the oldest results and keeps the newest intact', () => {
    // The newest is what the model is answering from; trimming it would make
    // the whole round trip pointless.
    const messages = [
      toolMessage('1', 'web_fetch', 5_000),
      toolMessage('2', 'web_search', 5_000),
      toolMessage('3', 'web_fetch', 5_000),
    ];
    const trimmed = trimToolResults(messages, 6_000);

    expect(trimmed[0].content).toContain('trimmed');
    expect(trimmed[0].content).toContain('web_fetch');
    expect(trimmed[1].content).toContain('trimmed');
    expect(trimmed[2].content).toHaveLength(5_000);
  });

  it('replaces content rather than removing the message', () => {
    // Dropping a role:'tool' message orphans the tool_call_id on the assistant
    // turn above it, which providers reject outright.
    const messages = [
      { role: 'assistant', content: null, tool_calls: [{ id: '1', type: 'function', function: { name: 'web_fetch', arguments: '{}' } }] },
      toolMessage('1', 'web_fetch', 30_000),
      toolMessage('2', 'web_search', 30_000),
    ];
    const trimmed = trimToolResults(messages, 1_000);

    expect(trimmed).toHaveLength(3);
    expect(trimmed[1].tool_call_id).toBe('1');
    expect(trimmed[1].role).toBe('tool');
  });

  it('stops trimming as soon as the transcript fits', () => {
    const messages = [
      toolMessage('1', 'a', 10_000),
      toolMessage('2', 'b', 10_000),
      toolMessage('3', 'c', 1_000),
    ];
    const trimmed = trimToolResults(messages, 12_000);
    expect(trimmed[0].content).toContain('trimmed');
    // The second already fits once the first is gone, so it survives whole.
    expect(trimmed[1].content).toHaveLength(10_000);
  });
});
