import { afterEach, describe, expect, it, vi } from 'vitest';
import { runAgentLoop } from './agentLoop.js';
import { buildAppToolDirective, executeTool, resolveDeviceRoundBudget, selectTools } from './tools.js';
import { DEVICE_ROUND_HARD_STOP, MAX_DEVICE_ROUNDS, type DeviceApp } from '../../shared/deviceTools.js';
import type { ProviderTool } from './providerTypes.js';

const names = (tools: ProviderTool[]) => tools.map(tool => tool.function.name);

describe('selectTools with device apps', () => {
  it('offers app tools without an intent gate, once the client declares support', () => {
    const withBridge = names(selectTools({ deviceApps: ['notes', 'chats'] }));
    expect(withBridge).toEqual(expect.arrayContaining([
      'healthcare_search', 'notes_search', 'notes_read', 'notes_create', 'notes_edit',
      'chats_search', 'chats_read',
    ]));
  });

  it('withholds device tools from a client that cannot execute them', () => {
    // An older cached bundle declares nothing. Offering it notes_search would
    // strand every run at the first call.
    const offered = names(selectTools({}));
    expect(offered).toContain('healthcare_search');
    expect(offered.some(name => name.startsWith('notes_') || name.startsWith('chats_'))).toBe(false);
  });

  it('leaves readers out of an empty store but keeps the writer', () => {
    // A user with no notes cannot search them — but notes_create is exactly
    // how they stop having no notes, so it must survive.
    const offered = names(selectTools({ deviceApps: ['notes', 'chats'], deviceDataPresent: [] }));
    // find_tools rides along whenever the catalogue still holds something —
    // it is the catalogue's entry point, not an app tool. See toolCatalog.test.
    expect(offered.filter(name => name !== 'find_tools'))
      .toEqual(['healthcare_search', 'notes_create']);
  });

  it('brings the readers back as soon as there is something to read', () => {
    const offered = names(selectTools({ deviceApps: ['notes', 'chats'], deviceDataPresent: ['notes'] }));
    expect(offered).toEqual(expect.arrayContaining(['notes_search', 'notes_read', 'notes_edit']));
    // Still no history to search.
    expect(offered).not.toContain('chats_search');
  });

  it('assumes data is present when the client says nothing about it', () => {
    // An older bundle sends deviceApps but not deviceDataPresent. Withholding
    // readers there would silently remove a capability it does have.
    expect(names(selectTools({ deviceApps: ['notes', 'chats'] }))).toContain('chats_search');
  });

  it('offers only the apps the client named', () => {
    const offered = names(selectTools({ deviceApps: ['notes'] }));
    expect(offered).toContain('notes_search');
    expect(offered).not.toContain('chats_search');
  });

  it('drops device tools once the round budget is spent', () => {
    const spent = names(selectTools({ deviceApps: ['notes', 'chats'], deviceRoundsUsed: MAX_DEVICE_ROUNDS }));
    expect(spent.some(name => name.startsWith('notes_') || name.startsWith('chats_'))).toBe(false);
    // The server-executed one is unaffected: it costs no round trip.
    expect(spent).toContain('healthcare_search');
    // One below the budget still has a round left.
    const remaining = names(selectTools({ deviceApps: ['notes'], deviceRoundsUsed: MAX_DEVICE_ROUNDS - 1 }));
    expect(remaining).toContain('notes_search');
  });

  it('respects a special mode that opted out of tools entirely', () => {
    const offered = names(selectTools({ specialModeConfig: { tools: [] }, deviceApps: ['notes', 'chats'] }));
    expect(offered).toEqual([]);
  });
});

describe('resolveDeviceRoundBudget', () => {
  afterEach(() => { delete process.env.DEVICE_ROUND_BUDGET; });

  it('defaults to the shared budget', () => {
    expect(resolveDeviceRoundBudget()).toBe(MAX_DEVICE_ROUNDS);
  });

  it('takes a configured value, and clamps it to the hard stop', () => {
    process.env.DEVICE_ROUND_BUDGET = '3';
    expect(resolveDeviceRoundBudget()).toBe(3);
    process.env.DEVICE_ROUND_BUDGET = '9999';
    expect(resolveDeviceRoundBudget()).toBe(DEVICE_ROUND_HARD_STOP);
  });

  it('treats zero as off rather than as unset', () => {
    process.env.DEVICE_ROUND_BUDGET = '0';
    expect(resolveDeviceRoundBudget()).toBe(0);
    expect(names(selectTools({ deviceApps: ['notes', 'chats'] }))).not.toContain('notes_search');
  });

  it('ignores a value that is not a number', () => {
    process.env.DEVICE_ROUND_BUDGET = 'lots';
    expect(resolveDeviceRoundBudget()).toBe(MAX_DEVICE_ROUNDS);
  });
});

describe('buildAppToolDirective', () => {
  const directiveFor = (opts: { deviceApps?: DeviceApp[]; deviceDataPresent?: DeviceApp[]; deviceRoundsUsed?: number }) => {
    const selected = selectTools(opts);
    return buildAppToolDirective({
      toolNames: names(selected),
      deviceRoundsSpent: (opts.deviceApps ?? []).length > 0
        && !selected.some(tool => tool.function.name.startsWith('notes_') || tool.function.name.startsWith('chats_')),
    });
  };

  it('names every surface the model can reach, and that a batch costs one lookup', () => {
    const directive = directiveFor({ deviceApps: ['notes', 'chats'] });
    expect(directive).toContain('do not need to open Notes, Healthcare, History');
    // Batching is what keeps a turn inside its budget without raising it.
    expect(directive).toContain('costs one lookup');
  });

  it('explains why the tools went away instead of letting them vanish', () => {
    const directive = directiveFor({ deviceApps: ['notes', 'chats'], deviceRoundsUsed: MAX_DEVICE_ROUNDS });
    expect(directive).toContain('no longer listed');
    expect(directive).toContain('will not come back');
    // The failure this prevents: answering as though it had never looked.
    expect(directive).toContain('say plainly what you could not check');
  });

  it('does not name apps a client cannot reach on this turn', () => {
    // The tool policy directly above says the listed tools are the only ones
    // there are. Promising more contradicts it.
    const directive = directiveFor({});
    expect(directive).not.toContain('Notes');
    expect(directive).not.toContain('History');
    expect(directive).toContain('Healthcare');
  });

  it('shrinks to match a user who has nothing stored yet', () => {
    const directive = directiveFor({ deviceApps: ['notes', 'chats'], deviceDataPresent: [] });
    // No readers, so no instructions about looking things up or batching.
    expect(directive).toContain('you can still save them one');
    expect(directive).not.toContain('costs one lookup');
    expect(directive).not.toContain('History');
    expect(directive.length).toBeLessThan(300);
  });
});

describe('executeTool on a device tool', () => {
  it('tells the model plainly rather than answering "unknown tool"', async () => {
    const result = await executeTool(
      { id: '1', function: { name: 'notes_search', arguments: '{}' } },
      { persona: 'default' },
      { emitText: vi.fn(), emitMarker: vi.fn() },
    );
    expect(result).toContain('cannot run in this context');
  });
});

// ─── Agent loop suspension ──────────────────────────────────────────────────

/** A provider stream of the newline-delimited frames the loop parses. */
function streamOf(frames: unknown[]): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(`${JSON.stringify(frame)}\n`));
      controller.close();
    },
  });
}

const toolCallFrame = (index: number, id: string, name: string, args = '{}') => ({
  type: 'tool_calls',
  tool_calls: [{ index, id, type: 'function', function: { name, arguments: args } }],
});

function emitter() {
  return { emitContent: vi.fn(), emitToolText: vi.fn(), emitMarker: vi.fn() };
}

describe('runAgentLoop device suspension', () => {
  it('suspends on a device tool call instead of executing it', async () => {
    const emit = emitter();
    const callModel = vi.fn().mockResolvedValue(streamOf([
      { type: 'content', content: 'Let me look.' },
      toolCallFrame(0, 'call-1', 'notes_search', '{"query":"physics","limit":5}'),
    ]));

    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'find my physics note' }],
      tools: [],
      toolContext: { persona: 'default' },
      emit,
      callModel,
      deviceBridge: true,
    });

    expect(callModel).toHaveBeenCalledTimes(1);
    expect(result.deviceSuspension).toBeDefined();
    expect(result.deviceSuspension?.pendingCalls).toEqual([
      { id: 'call-1', name: 'notes_search', arguments: '{"query":"physics","limit":5}' },
    ]);
    expect(result.deviceSuspension?.assistantContent).toBe('Let me look.');
    expect(result.hitMaxIterations).toBe(false);
    expect(result.content).toBe('Let me look.');
  });

  it('runs the server half of a mixed batch and carries its results along', async () => {
    const emit = emitter();
    const callModel = vi.fn().mockResolvedValue(streamOf([
      toolCallFrame(0, 'call-server', 'list_skills'),
      toolCallFrame(1, 'call-device', 'notes_read', '{"note_id":"n1"}'),
    ]));

    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'go' }],
      tools: [],
      toolContext: { persona: 'default' },
      emit,
      callModel,
      deviceBridge: true,
    });

    // The web/skills half must not be thrown away just because the batch also
    // reached for the device — the model asked for both.
    expect(result.deviceSuspension?.resolvedResults.map(entry => entry.name)).toEqual(['list_skills']);
    expect(result.deviceSuspension?.pendingCalls.map(call => call.name)).toEqual(['notes_read']);
    expect(result.deviceSuspension?.allToolCalls).toHaveLength(2);
  });

  it('does not suspend when the caller has no bridge', async () => {
    const emit = emitter();
    const callModel = vi.fn()
      .mockResolvedValueOnce(streamOf([toolCallFrame(0, 'call-1', 'notes_search', '{}')]))
      .mockResolvedValueOnce(streamOf([{ type: 'content', content: 'I cannot reach your notes.' }]));

    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'find my note' }],
      tools: [],
      toolContext: { persona: 'default' },
      emit,
      callModel,
    });

    expect(result.deviceSuspension).toBeUndefined();
    expect(callModel).toHaveBeenCalledTimes(2);
    expect(result.content).toBe('I cannot reach your notes.');
  });

  it('leaves a plain server-tool run exactly as it was', async () => {
    const emit = emitter();
    const callModel = vi.fn()
      .mockResolvedValueOnce(streamOf([toolCallFrame(0, 'call-1', 'list_skills')]))
      .mockResolvedValueOnce(streamOf([{ type: 'content', content: 'Done.' }]));

    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'go' }],
      tools: [],
      toolContext: { persona: 'default' },
      emit,
      callModel,
      deviceBridge: true,
    });

    expect(result.deviceSuspension).toBeUndefined();
    expect(result.content).toBe('Done.');
  });
});
