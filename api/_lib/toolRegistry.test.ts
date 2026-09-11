import { describe, expect, it } from 'vitest';
import {
  CREATE_TOOL_NAME,
  MAX_SESSION_TOOLS,
  buildToolRunProgram,
  importedModules,
  isRegistryToolName,
  registryToolDescriptor,
  registryToolName,
  sessionToolDescriptor,
  sessionToolSummary,
  slugFromToolName,
  type PublishedTool,
  type ToolSpec,
} from '../../shared/toolRegistry.js';
import {
  parsePublishedTool,
  parseToolSpec,
  registryToolPayloadSchema,
  toolDigest,
} from '../../shared/toolRegistrySchema.js';
import { isDeviceToolName } from '../../shared/deviceTools.js';
import { attachToolPayloads, latestPerSlug, resolveRequestTools } from './toolRegistry.js';
import { createToolPolicy, executeTool, selectToolSet } from './tools.js';
import { aiProxyBodySchema } from './validation.js';
import type { ProviderTool } from './providerTypes.js';

const names = (tools: ProviderTool[]) => tools.map(tool => tool.function.name);
const userTurn = (content: string) => [{ content, isAI: false }];
const silentEmitter = { emitText: () => {}, emitMarker: () => {} };

/** A spec a model would plausibly write. */
const spec: ToolSpec = {
  slug: 'unit_convert',
  title: 'Unit converter',
  description: 'Convert a length between metres, feet, inches and kilometres. Call it whenever the user asks to convert units of length.',
  summary: 'Convert lengths between metric and imperial units.',
  parameters: {
    type: 'object',
    properties: {
      value: { type: 'number', description: 'The quantity.' },
      from_unit: { type: 'string', description: 'm, km, ft or in.' },
      to_unit: { type: 'string', description: 'm, km, ft or in.' },
    },
    required: ['value', 'from_unit', 'to_unit'],
  },
  source: [
    'import math',
    'FACTORS = {"m": 1.0, "km": 1000.0, "ft": 0.3048, "in": 0.0254}',
    'def main(value, from_unit, to_unit):',
    '    return {"value": value * FACTORS[from_unit] / FACTORS[to_unit], "unit": to_unit}',
  ].join('\n'),
  terms: ['convert', 'metres to feet', 'feet to metres', 'kilometres', 'inches'],
  tests: [{ input: { value: 1, from_unit: 'km', to_unit: 'm' }, expect: '1000' }],
};

function published(overrides: Partial<PublishedTool> = {}): PublishedTool {
  return {
    ...spec,
    id: 'row-1',
    version: 1,
    digest: 'sha256:' + 'a'.repeat(64),
    authorId: 'user-1',
    createdAt: '2026-09-11T00:00:00.000Z',
    ...overrides,
  };
}

describe('registry tool names', () => {
  it('prefixes a slug and recognises the prefix', () => {
    expect(registryToolName('unit_convert')).toBe('tm__unit_convert');
    expect(isRegistryToolName('tm__unit_convert')).toBe(true);
    expect(isRegistryToolName('tm__')).toBe(false);
    expect(isRegistryToolName('web_fetch')).toBe(false);
    expect(slugFromToolName('tm__unit_convert')).toBe('unit_convert');
  });

  it('makes every tm__ name a device tool, without the list learning it', () => {
    expect(isDeviceToolName('tm__anything_at_all')).toBe(true);
    expect(isDeviceToolName(CREATE_TOOL_NAME)).toBe(true);
    expect(isDeviceToolName('mcp__weather__now')).toBe(false);
  });
});

describe('spec validation', () => {
  it('accepts a spec a model would write, and fills in additionalProperties', () => {
    const parsed = parseToolSpec(spec);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.spec.parameters.additionalProperties).toBe(false);
    expect(parsed.spec.terms).toEqual(spec.terms);
  });

  it('refuses generic terms, and says which', () => {
    const parsed = parseToolSpec({ ...spec, terms: ['convert', 'data'] });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues).toContain('"data" is too generic');
    expect(parsed.issues).toContain('terms.1');
  });

  it('refuses a source with no main(), a bad slug, and a schema that is not an object', () => {
    expect(parseToolSpec({ ...spec, source: 'x = 1' }).ok).toBe(false);
    expect(parseToolSpec({ ...spec, slug: 'Unit-Convert' }).ok).toBe(false);
    expect(parseToolSpec({ ...spec, parameters: { type: 'string' } }).ok).toBe(false);
    expect(parseToolSpec({ ...spec, tests: [] }).ok).toBe(false);
  });

  it('bounds the row on the way out of the registry exactly as on the way in', () => {
    expect(parsePublishedTool(published())).not.toBeNull();
    expect(parsePublishedTool(published({ digest: 'md5:nope' }))).toBeNull();
    expect(parsePublishedTool(published({ source: 'x'.repeat(16_001) }))).toBeNull();
    // A stranger's extra column is not a reason to skip a valid row, but an
    // unknown field on the parsed shape is: the schema is strict.
    expect(parsePublishedTool({ ...published(), extra: true })).toBeNull();
  });
});

describe('digest', () => {
  it('is stable across key order and ignores the prose', async () => {
    const a = await toolDigest(spec);
    const b = await toolDigest({
      ...spec,
      // Different prose, different key order, no additionalProperties: the
      // same tool.
      parameters: {
        required: ['value', 'from_unit', 'to_unit'],
        properties: {
          to_unit: { type: 'string', description: 'm, km, ft or in.' },
          from_unit: { type: 'string', description: 'm, km, ft or in.' },
          value: { type: 'number', description: 'The quantity.' },
        },
        type: 'object',
      },
    });
    expect(a).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(b).toBe(a);
  });

  it('changes when the code does', async () => {
    expect(await toolDigest({ ...spec, source: spec.source + '\n# changed' })).not.toBe(await toolDigest(spec));
  });
});

describe('the sandbox program', () => {
  it('hoists the tool\'s imports so the sandbox can load its packages', () => {
    expect(importedModules('import numpy as np\nfrom pandas.io import x\n  import os.path')).toEqual(['numpy', 'pandas', 'os']);
    const program = buildToolRunProgram(spec, { value: 1, from_unit: 'km', to_unit: 'm' });
    expect(program).toMatch(/^try:\n {4}import math\nexcept Exception:\n {4}pass/m);
  });

  it('runs the source in its own namespace, with show() passed in, and prints the return value', () => {
    const program = buildToolRunProgram(spec, { value: 1, from_unit: 'km', to_unit: 'm' });
    expect(program).toContain('"show": show');
    expect(program).toContain('exec(compile(_tm_source, "tm__unit_convert", "exec"), _tm_ns)');
    expect(program).toContain('_tm_ns["main"](**_tm_args)');
    expect(program).toContain('print("Returned: "');
    // Neither the source nor the arguments appear as Python literals; both go
    // through base64, which has no corner cases.
    expect(program).not.toContain('FACTORS = {');
    expect(program).not.toContain('"from_unit": "km"');
  });
});

describe('on the catalogue', () => {
  it('is gated on its own terms plus its slug, requires python, and is a device tool', () => {
    const descriptor = registryToolDescriptor(spec);
    expect(descriptor).toMatchObject({ name: 'tm__unit_convert', tier: 'gated', runtime: 'device', requires: ['python'], origin: 'registry' });
    expect(descriptor.select?.intent).toEqual(expect.arrayContaining(['convert', 'unit', 'convert']));
    expect(descriptor.definition.function.strict).toBeUndefined();
    expect(sessionToolDescriptor(spec).tier).toBe('core');
  });

  it('is offered directly when a term matches, and findable when not', () => {
    const extra = [registryToolDescriptor(spec)];
    const base = { deviceApps: ['python'], extraDescriptors: extra } as const;

    const asked = selectToolSet({ ...base, messages: userTurn('convert 3 km to feet please') });
    expect(names(asked.tools)).toContain('tm__unit_convert');

    const other = selectToolSet({ ...base, messages: userTurn('write me a haiku') });
    expect(names(other.tools)).not.toContain('tm__unit_convert');
    expect(other.findable.map(d => d.name)).toContain('tm__unit_convert');
  });

  it('is never offered to a client that cannot run python', () => {
    const set = selectToolSet({ deviceApps: ['notes'], extraDescriptors: [registryToolDescriptor(spec)], messages: userTurn('convert 3 km to feet') });
    expect(names(set.tools)).not.toContain('tm__unit_convert');
    expect(set.findable.map(d => d.name)).not.toContain('tm__unit_convert');
  });

  it('a session tool shadows a registry tool with the same slug', () => {
    const { descriptors, registryByName } = resolveRequestTools(
      [sessionToolSummary({ ...spec, description: 'The session copy of the converter, kept on this device.' })],
      [published(), published({ id: 'row-2', slug: 'other_tool', digest: 'sha256:' + 'b'.repeat(64) })],
    );
    expect(descriptors.map(d => [d.name, d.tier])).toEqual([
      ['tm__unit_convert', 'core'],
      ['tm__other_tool', 'gated'],
    ]);
    // The frame must not carry registry code for a tool the browser owns.
    expect(registryByName.has('tm__unit_convert')).toBe(false);
    expect(registryByName.has('tm__other_tool')).toBe(true);
  });

  it('bounds session tools and keeps one version per slug', () => {
    const many = Array.from({ length: MAX_SESSION_TOOLS + 2 }, (_, i) => sessionToolSummary({ ...spec, slug: `tool_${i}` }));
    expect(resolveRequestTools(many, []).descriptors).toHaveLength(MAX_SESSION_TOOLS);

    const versions = latestPerSlug([published({ version: 1 }), published({ id: 'row-3', version: 3 }), published({ id: 'row-2', version: 2 })]);
    expect(versions).toHaveLength(1);
    expect(versions[0].id).toBe('row-3');
  });
});

describe('the suspension frame', () => {
  it('carries the code for a registry tool and nothing for a session one', () => {
    const { registryByName } = resolveRequestTools([], [published()]);
    const calls = attachToolPayloads([
      { id: 'a', name: 'tm__unit_convert', arguments: '{}' },
      { id: 'b', name: 'run_python', arguments: '{}' },
    ], registryByName);
    expect(calls[0].tool).toMatchObject({ id: 'row-1', slug: 'unit_convert', version: 1, digest: published().digest });
    expect(calls[0].tool?.source).toBe(spec.source);
    expect(calls[1].tool).toBeUndefined();
    // And what it carries is exactly what the browser will validate.
    expect(registryToolPayloadSchema.safeParse(calls[0].tool).success).toBe(true);
  });
});

describe('create_tool', () => {
  it('is gated on asking for a tool, and findable otherwise', () => {
    const asked = selectToolSet({ deviceApps: ['python'], messages: userTurn('make me a tool that converts bangla dates') });
    expect(names(asked.tools)).toContain(CREATE_TOOL_NAME);

    const plain = selectToolSet({ deviceApps: ['python'], messages: userTurn('what is 17 * 23') });
    expect(names(plain.tools)).not.toContain(CREATE_TOOL_NAME);
    expect(plain.findable.map(d => d.name)).toContain(CREATE_TOOL_NAME);
  });

  it('is granted by a find_tools miss, and never ranked by a find_tools hit', async () => {
    const set = selectToolSet({ deviceApps: ['python'], messages: userTurn('hello') });
    const policy = createToolPolicy({ offered: names(set.tools) });
    const ctx = { persona: 'default', policy, findable: set.findable };

    const miss = await executeTool(
      { id: '1', function: { name: 'find_tools', arguments: JSON.stringify({ query: 'convert bangla calendar dates' }) } },
      ctx, silentEmitter,
    );
    // "dates" overlaps a web_search term, so lexically this is a weak match
    // rather than a miss — and a weak match still hands over create_tool.
    expect(miss).toContain('create_tool is also loaded');
    expect(policy.granted.map(tool => tool.function.name)).toContain(CREATE_TOOL_NAME);

    const outright = createToolPolicy({ offered: names(set.tools) });
    const nothing = await executeTool(
      { id: '3', function: { name: 'find_tools', arguments: JSON.stringify({ query: 'bengali numerals' }) } },
      { ...ctx, policy: outright }, silentEmitter,
    );
    expect(nothing).toContain('create_tool is available now');
    expect(outright.granted.map(tool => tool.function.name)).toEqual([CREATE_TOOL_NAME]);

    // "tool" is in create_tool's name and summary; a query for a web page
    // reader must still find the reader, not the tool-maker.
    const fresh = createToolPolicy({ offered: names(set.tools) });
    const hit = await executeTool(
      { id: '2', function: { name: 'find_tools', arguments: JSON.stringify({ query: 'a tool to read a web page' }) } },
      { ...ctx, policy: fresh }, silentEmitter,
    );
    expect(hit).toContain('web_fetch');
    expect(fresh.granted.map(tool => tool.function.name)).not.toContain(CREATE_TOOL_NAME);
  });
});

describe('the request body', () => {
  it('accepts session tool summaries and refuses ones that would not validate as tools', () => {
    const summary = sessionToolSummary(spec);
    const ok = aiProxyBodySchema.safeParse({ messages: [{ content: 'hi' }], sessionTools: [summary] });
    expect(ok.success).toBe(true);

    const bad = aiProxyBodySchema.safeParse({ messages: [{ content: 'hi' }], sessionTools: [{ ...summary, terms: ['the', 'data'] }] });
    expect(bad.success).toBe(false);

    // Source never travels in the body.
    const withSource = aiProxyBodySchema.safeParse({ messages: [{ content: 'hi' }], sessionTools: [{ ...summary, source: 'def main(): pass' }] });
    expect(withSource.success).toBe(false);
  });
});
