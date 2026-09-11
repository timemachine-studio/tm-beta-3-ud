import { describe, expect, it } from 'vitest';
import { deviceCapabilities, MAX_DEVICE_ROUNDS } from '../../shared/deviceTools.js';
import { estimateSchemaTokens, scoreTool, TOOL_TOKEN_BUDGET } from '../../shared/toolCatalog.js';
import { BUILTIN_CATALOG, buildAppToolDirective, buildToolGuardrail, selectToolSet } from './tools.js';
import type { ProviderTool } from './providerTypes.js';

const names = (tools: ProviderTool[]) => tools.map(tool => tool.function.name);

/** A client that can run everything, which is what the shipped bundle declares. */
const fullClient = { deviceApps: ['notes', 'chats', 'python'] as const };

const offeredFor = (text: string, options: Record<string, unknown> = {}) =>
  names(selectToolSet({
    ...fullClient,
    messages: [{ content: text, isAI: false }],
    ...options,
  }).tools);

describe('when run_python is put in front of the model', () => {
  it('comes along for a sum written in symbols, which no word list would catch', () => {
    expect(offeredFor('what is 17 * 23?')).toContain('run_python');
    expect(offeredFor('What is 17 times 23?')).toContain('run_python');
  });

  it('comes along for a physics question with no operator in it', () => {
    // The live miss this predicate exists for. Two measured quantities and a
    // question with one right answer, carrying no arithmetic symbol and none
    // of the tool's words — it was not offered at all, and the model answered
    // by hand and got the angle wrong in the second decimal.
    expect(offeredFor(
      'There are two vector lines. The one to the east is 1200 N and the one to the south is 2300 N. What is the resultant force? Draw to get it.',
    )).toContain('run_python');
  });

  it('comes along for a document the user wants to download', () => {
    // There is no separate PDF or Word tool: run_python makes them, so the
    // words that mean "make me a file" have to reach this descriptor or the
    // capability is unreachable.
    expect(offeredFor('make me a PDF invoice for these three items')).toContain('run_python');
    expect(offeredFor('put this into an excel spreadsheet I can download')).toContain('run_python');
    expect(offeredFor('write it up as a word document')).toContain('run_python');
  });

  it('comes along for data work and for charts', () => {
    expect(offeredFor('here is a csv of my expenses, what is the average per month?')).toContain('run_python');
    expect(offeredFor('plot the values as a histogram')).toContain('run_python');
    expect(offeredFor('how many days between 3 March and my birthday')).toContain('run_python');
  });

  it('stays out of a turn that has no computation in it', () => {
    // It was core for a while, on the theory that Python offered and not
    // needed is not called. Live, it was: "When was Adamjee Cantonment College
    // established" ran Python to find out, because the sandbox was always
    // there and the policy called dates its job. A standing sandbox is a
    // standing invitation to treat every question as a calculation.
    expect(offeredFor('write me a haiku about cats')).not.toContain('run_python');
    expect(offeredFor('make me a snake game in html')).not.toContain('run_python');
    expect(offeredFor('When was adamjee cantonment college established')).not.toContain('run_python');
    // Not lost, though: the model can still ask for it by name.
    const set = selectToolSet({ ...fullClient, messages: [{ content: 'write me a haiku about cats', isAI: false }] });
    expect(set.findable.map(descriptor => descriptor.name)).toContain('run_python');
  });

  it('still writes code in a code block when that is what was asked for', () => {
    // The guardrail, not the gate, is what keeps a build request from becoming
    // a matplotlib PNG now.
    const guardrail = buildToolGuardrail({ canFindTools: true, canRunPython: true });
    expect(guardrail).toContain('write the code directly in a fenced code block');
  });

  it('is never offered to a client that did not say it can run it', () => {
    // An older cached bundle has no worker to execute this. Offering it would
    // strand the turn on a tool call nothing will ever answer.
    const older = offeredFor('what is 17 * 23?', { deviceApps: ['notes', 'chats'] });
    expect(older).not.toContain('run_python');
    // And it must not reappear through the side door either.
    const set = selectToolSet({
      deviceApps: ['notes', 'chats'],
      messages: [{ content: 'what is 17 * 23?', isAI: false }],
    });
    expect(set.findable.map(descriptor => descriptor.name)).not.toContain('run_python');
  });

  it('needs no find_tools round trip for a calculation the words used to miss', () => {
    // The case that first sent the tool core: nothing in "split the bill four
    // ways" matched a term list, and it is plainly a calculation. Now that the
    // gate is back, the phrase is in the list — a miss like this costs the
    // user one rephrase, which is the deal the gate makes.
    const set = selectToolSet({
      ...fullClient,
      messages: [{ content: 'split the bill four ways and tell me the tip', isAI: false }],
    });
    expect(names(set.tools)).toContain('run_python');
  });

  it('goes away with the other device tools once the round budget is spent', () => {
    const spent = offeredFor('plot the values as a histogram', { deviceRoundsUsed: MAX_DEVICE_ROUNDS });
    expect(spent).not.toContain('run_python');
  });

  it('is not treated as a store that can be empty', () => {
    // notes and chats earn a second ':data' capability so their readers can be
    // withheld from an empty store. Python has nothing to be empty of, and a
    // 'python:data' capability would be a rule with no meaning behind it.
    expect(deviceCapabilities(['notes', 'chats', 'python'], [])).toEqual(['notes', 'chats', 'python']);
  });
});

describe('the gate', () => {
  it('recognises the turns it was widened for', () => {
    const descriptor = BUILTIN_CATALOG.find(candidate => candidate.name === 'run_python');
    const wants = (text: string) => scoreTool(
      { ...descriptor!, tier: 'gated' },
      { lastUserText: text, lastAssistantText: '', hasAttachedImage: false, hasAttachedPdf: false, capabilities: ['python'] },
    ) !== null;
    expect(wants('what is 17 * 23?')).toBe(true);
    expect(wants('the one to the east is 1200 N and the one to the south is 2300 N')).toBe(true);
    expect(wants('make me a PDF invoice')).toBe(true);
    expect(wants('write me a haiku about cats')).toBe(false);
    expect(wants('I loved the 1980s and the 1990s music scene')).toBe(false);
  });
});

describe('what run_python costs a request', () => {
  it('is not squeezed out by tools that are always present anyway', () => {
    // The live failure this test exists for. A user with a skill enabled gets
    // list_skills and read_skill as core; that pushed core past Air's old
    // combined budget, and run_python — the only gated tool that mattered on
    // the turn — silently never reached the model. Core cannot lose its place,
    // so charging it against the same budget only decided which *other* tool
    // vanished, invisibly, because of a change somewhere else entirely.
    const set = selectToolSet({
      ...fullClient,
      surface: 'air',
      includeSkills: true,
      messages: [{ content: 'plot this data as a bar chart', isAI: false }],
    });
    expect(names(set.tools)).toContain('run_python');
    expect(names(set.tools)).toContain('list_skills');
  });

  it('still caps what the speculative tools may add', () => {
    const gated = selectToolSet({
      ...fullClient,
      surface: 'air',
      messages: [{ content: 'plot this data as a bar chart', isAI: false }],
    }).offered.filter(descriptor => descriptor.tier === 'gated');
    const cost = gated.reduce((sum, descriptor) => sum + estimateSchemaTokens(descriptor.definition), 0);
    expect(cost).toBeLessThanOrEqual(TOOL_TOKEN_BUDGET.air);
  });

  it('keeps its schema small enough to stay affordable', () => {
    const set = selectToolSet({ ...fullClient, messages: [{ content: 'what is 2 ** 10?', isAI: false }] });
    const descriptor = set.offered.find(candidate => candidate.name === 'run_python');
    expect(descriptor).toBeDefined();
    // It carries three capabilities — exact answers, analysis, and the
    // show()/outputs contract — so it is allowed to be larger than a search
    // tool, and every clause in it was written for a failure seen live. This
    // is the ceiling, not a target: past it, trim a clause rather than raise
    // the number.
    expect(estimateSchemaTokens(descriptor!.definition)).toBeLessThan(330);
  });
});

describe('when the tools go away mid-turn', () => {
  it('tells the model its Python runs are spent, not just its lookups', () => {
    // A tool that silently vanishes makes the model answer as though it never
    // had one. That applies to a withdrawn sandbox exactly as it does to notes.
    const directive = buildAppToolDirective({
      toolNames: ['healthcare_search'],
      deviceRoundsSpent: true,
      deviceApps: ['notes', 'chats', 'python'],
    });
    expect(directive).toContain('Python run');
    expect(directive).toContain('no longer listed');
  });

  it('does not mention Python to a client that never had it', () => {
    const directive = buildAppToolDirective({
      toolNames: ['healthcare_search'],
      deviceRoundsSpent: true,
      deviceApps: ['notes', 'chats'],
    });
    expect(directive).not.toContain('Python');
  });
});

describe('the policy the model reads alongside the tool', () => {
  it('stops telling the model to do arithmetic in its head once it has a sandbox', () => {
    // Found live. run_python was offered for "4177 * 39281 … plot y = x**2",
    // and the model multiplied it mentally and offered to draw the chart
    // later. Rule 1 had told it to prefer its own reasoning — which is right
    // for a web search and precisely wrong for exact numbers.
    const withPython = buildToolGuardrail({ canFindTools: true, canRunPython: true });
    expect(withPython).toContain('run it instead of working them out in your head');
    expect(withPython).toContain('not a code request');
    expect(withPython).toContain('never say you cannot draw');
  });

  it('leaves the policy alone on a turn with no sandbox in it', () => {
    const plain = buildToolGuardrail({ canFindTools: true });
    expect(plain).toContain('reach for a tool only when the user needs something you cannot produce yourself');
    expect(plain).not.toContain('run_python');
  });

  it('still closes the door when there is no catalogue behind it', () => {
    expect(buildToolGuardrail({ canFindTools: false })).toContain('it does not exist for this turn');
  });
});
