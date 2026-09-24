/**
 * Tools TimeMachine writes for itself: the contract between the model that
 * writes one, the browser that runs it, the registry that shares it, and the
 * catalogue that offers it.
 *
 * A generated tool is either a Python function or a bounded composition of
 * read-only device calls, plus a plain-JSON descriptor. It runs
 * through the same device bridge,
 * and it is selected by exactly the code that selects the built-ins — a
 * `ToolDescriptor` was designed as data for this reason. What this module
 * adds is the shape of the thing itself: how a tool is named, what it must
 * declare, how it is packaged into a program the sandbox can run, and how its
 * identity is fixed so the same tool published twice is one row, not two.
 *
 * Both api/ and src/ import this file. The zod schemas that validate a spec
 * live next door in `toolRegistrySchema.ts`, so this half stays
 * dependency-free for the Trigger task and the device-tool contract.
 */

import type { ToolDefinition, ToolDescriptor } from './toolCatalog.js';
import type { CapabilityManifest } from './capabilities.js';

// ─── Naming ─────────────────────────────────────────────────────────────────

/**
 * Model-facing names are prefixed, exactly as `mcp__` marks an MCP tool.
 *
 * The prefix is what tells the agent loop a call belongs to the browser: a
 * registry tool is a device tool, because the sandbox is on the device. It
 * also keeps a generated tool from ever shadowing a built-in — `tm__web_fetch`
 * is a different name from `web_fetch`, whatever the model called its slug.
 */
export const REGISTRY_TOOL_PREFIX = 'tm__';
export const COMPOSED_SOURCE_PREFIX = 'TM_COMPOSED_V1\n';
export const COMPOSED_READ_TOOLS = ['notes_search', 'notes_read', 'chats_search', 'chats_read'] as const;
export type ComposedReadTool = typeof COMPOSED_READ_TOOLS[number];
export interface ComposedStep { tool: ComposedReadTool; arguments: Record<string, string | number | boolean> }
export interface ComposedPlan { steps: ComposedStep[] }
export function composedSource(steps: readonly ComposedStep[]): string {
  return COMPOSED_SOURCE_PREFIX + JSON.stringify({ steps });
}
export function toolRuntime(source: string): 'python' | 'composed' {
  return source.startsWith(COMPOSED_SOURCE_PREFIX) ? 'composed' : 'python';
}

export type RegistryToolName = `${typeof REGISTRY_TOOL_PREFIX}${string}`;

export function isRegistryToolName(name: string | undefined | null): name is RegistryToolName {
  return !!name && name.startsWith(REGISTRY_TOOL_PREFIX) && name.length > REGISTRY_TOOL_PREFIX.length;
}

export function registryToolName(slug: string): RegistryToolName {
  return `${REGISTRY_TOOL_PREFIX}${slug}`;
}

export function slugFromToolName(name: string): string {
  return isRegistryToolName(name) ? name.slice(REGISTRY_TOOL_PREFIX.length) : name;
}

// ─── Bounds ─────────────────────────────────────────────────────────────────
//
// Shared by the zod schemas, the SQL check constraints and the stored-chat
// validator, so the three cannot drift apart. A row that satisfies the
// database must validate on load, and a spec the model wrote must fit the row.

export const TOOL_SPEC_LIMITS = {
  slug: /^[a-z][a-z0-9_]{2,39}$/,
  title: { min: 1, max: 60 },
  description: { min: 20, max: 600 },
  summary: { min: 10, max: 140 },
  source: { min: 1, max: 16_000 },
  terms: { min: 2, max: 16, termMin: 3, termMax: 40 },
  tests: { min: 1, max: 5, expectMax: 200 },
  parameters: { max: 12 },
} as const;

/** Tools one conversation may create. Each is core for that conversation. */
export const MAX_SESSION_TOOLS = 6;

/** Characters of a tool's return value handed back to the model. */
export const MAX_TOOL_RESULT_CHARS = 8_000;

/**
 * Words a tool may not use as a selection term.
 *
 * Terms are written by the model that wrote the tool, and they decide when
 * the tool is put in front of every other user's model. A generic word would
 * match half of all messages; a word that belongs to a built-in tool would
 * put a stranger's code next to the image generator on every picture request.
 */
export const RESERVED_TERMS: ReadonlySet<string> = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'what', 'how', 'can',
  'you', 'your', 'get', 'set', 'use', 'make', 'run', 'tool', 'tools', 'help',
  'please', 'want', 'need', 'give', 'show', 'tell', 'find', 'search', 'data',
  'file', 'files', 'text', 'code', 'python', 'script', 'function', 'value',
  'number', 'numbers', 'list', 'string', 'input', 'output', 'result', 'results',
  // The built-in tools' own territory.
  'image', 'images', 'picture', 'pictures', 'photo', 'draw', 'drawing',
  'chart', 'graph', 'plot', 'pdf', 'excel', 'word', 'docx', 'xlsx',
  'note', 'notes', 'chat', 'chats', 'web', 'website', 'url', 'link',
  'weather', 'news',
]);

// ─── The spec ───────────────────────────────────────────────────────────────

/** A test the tool must pass before it exists. */
export interface ToolTestCase {
  /** Arguments to call main() with. */
  input: Record<string, unknown>;
  /** A substring that must appear in the output. Absent: not raising is enough. */
  expect?: string;
}

/**
 * What the model writes, and what the registry stores.
 *
 * `parameters` is a bounded JSON-Schema object (see `schemaSpec.ts`) — the
 * model-facing signature. `source` must define `main(**parameters)`; whatever
 * it returns is handed back to the model, anything it `show()`s reaches the
 * user, and files it writes to /outputs become downloads, exactly as in
 * `run_python`.
 */
export interface ToolSpec {
  slug: string;
  title: string;
  description: string;
  summary: string;
  parameters: Record<string, unknown>;
  source: string;
  terms: string[];
  tests: ToolTestCase[];
}

/** A tool as the registry holds it. */
export interface PublishedTool extends ToolSpec {
  id: string;
  version: number;
  digest: string;
  /** Null for a row whose author's account has since been deleted. */
  authorId: string | null;
  createdAt: string;
}

/**
 * A tool this conversation created, carried on the message that made it.
 *
 * Kept with the chat — the same way it keeps attached files — so the tool
 * works on the very next leg, survives a reload, and works for an anonymous
 * user who cannot publish anything. `published` records whether it also
 * reached the shared registry.
 */
export interface SessionTool extends ToolSpec {
  digest: string;
  version: number;
  published: boolean;
  /** Registry row id, once published. */
  registryId?: string;
}

/**
 * The fields of a spec the model needs to see, as sent in the request body.
 *
 * Source and tests stay on the device: the server offers the tool and the
 * browser already holds the code, so shipping 16 KB of Python on every leg
 * would be a per-message tax for nothing.
 */
export type SessionToolSummary = Pick<ToolSpec, 'slug' | 'title' | 'description' | 'summary' | 'parameters' | 'terms'> & { runtime?: 'python' | 'composed' };

export function sessionToolSummary(tool: ToolSpec): SessionToolSummary {
  return {
    slug: tool.slug,
    title: tool.title,
    description: tool.description,
    summary: tool.summary,
    parameters: tool.parameters,
    terms: tool.terms,
    runtime: toolRuntime(tool.source),
  };
}

/**
 * What travels in the suspension frame for a *registry* tool.
 *
 * A session tool needs nothing here — the browser wrote it. A registry tool
 * was written elsewhere, so the code comes down with the call and the browser
 * checks the digest before running it: what runs is what was published.
 */
export interface RegistryToolPayload {
  id: string;
  slug: string;
  title: string;
  version: number;
  digest: string;
  parameters: Record<string, unknown>;
  source: string;
}

export function registryToolPayload(tool: PublishedTool): RegistryToolPayload {
  return {
    id: tool.id,
    slug: tool.slug,
    title: tool.title,
    version: tool.version,
    digest: tool.digest,
    parameters: tool.parameters,
    source: tool.source,
  };
}

// ─── Identity ───────────────────────────────────────────────────────────────

/**
 * What a tool's digest covers: the parts that decide what it does.
 *
 * Slug, signature and code. Not the description or the terms — two people
 * describing the same function differently have written the same tool, and
 * the registry should hold it once. Not the tests, for the same reason.
 */
export function digestSubject(tool: Pick<ToolSpec, 'slug' | 'parameters' | 'source'>): {
  slug: string;
  parameters: Record<string, unknown>;
  source: string;
} {
  return { slug: tool.slug, parameters: tool.parameters, source: tool.source };
}

// ─── Descriptors ────────────────────────────────────────────────────────────

function definitionFor(tool: SessionToolSummary): ToolDefinition {
  return {
    type: 'function',
    function: {
      name: registryToolName(tool.slug),
      description: tool.description,
      parameters: tool.parameters,
      // Not strict: strict mode requires every property to be required, and
      // a generated signature may reasonably have optional arguments.
    },
  };
}

/** Terms the packer matches on: what the author declared, plus the slug's words. */
function selectionTerms(tool: SessionToolSummary): string[] {
  const fromSlug = tool.slug.split('_').filter(word => word.length >= 4 && !RESERVED_TERMS.has(word));
  return [...new Set([...tool.terms, ...fromSlug])];
}

/**
 * A registry tool on the catalogue.
 *
 * `gated`, for the reason MCP tools are: catalog-tier would make find_tools
 * the only door and cost a whole model round trip for the obvious case. The
 * terms gate it, the budget caps how many can arrive at once, and find_tools
 * reaches the rest. Python tools require the Python runtime; composed reads
 * run through the device bridge without it.
 */
export function registryToolDescriptor(tool: SessionToolSummary): ToolDescriptor {
  return {
    name: registryToolName(tool.slug),
    definition: definitionFor(tool),
    runtime: 'device',
    tier: 'gated',
    requires: tool.runtime === 'composed' ? ['composed-tools'] : ['python'],
    summary: tool.summary,
    select: { intent: selectionTerms(tool) },
    origin: 'registry',
  };
}

/**
 * A tool this conversation made, on the catalogue.
 *
 * Core rather than gated: the user asked for this tool in this conversation,
 * and a gate that guessed wrong would hide a thing they watched being built.
 * MAX_SESSION_TOOLS bounds what that costs.
 */
export function sessionToolDescriptor(tool: SessionToolSummary): ToolDescriptor {
  return { ...registryToolDescriptor(tool), tier: 'core' };
}

// ─── The sandbox program ────────────────────────────────────────────────────

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  // Chunked: spreading a 16 KB array into fromCharCode overflows the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Top-level modules the source imports, in order of first appearance. */
export function importedModules(source: string): string[] {
  const found = new Set<string>();
  const pattern = /^[ \t]*(?:import[ \t]+([A-Za-z_][\w.]*)|from[ \t]+([A-Za-z_][\w.]*)[ \t]+import)/gm;
  for (const match of source.matchAll(pattern)) {
    const module = (match[1] || match[2] || '').split('.')[0];
    if (module) found.add(module);
  }
  return [...found];
}

/**
 * Wrap a tool's source into a program the sandbox can run against one call.
 *
 * Three things this has to get right:
 *
 * 1. **The sandbox loads packages by reading the program's imports** — it
 *    parses the code it is handed, and a source carried inside a string
 *    literal is invisible to that. So the tool's imports are hoisted to the
 *    top as real statements, each in its own try so a module the tool only
 *    imports conditionally cannot fail the run before it starts.
 * 2. **The tool runs in its own namespace.** The interpreter persists between
 *    calls, and a tool must neither clobber the variables the user's earlier
 *    `run_python` defined nor depend on them. `show` is passed in, because it
 *    is the one thing the tool is meant to reach.
 * 3. **The return value is what the model gets.** Printed as the last line of
 *    output, JSON-encoded, bounded. Everything `show()`n and every file
 *    written reaches the user through the paths `run_python` already has.
 *
 * Source and arguments cross as base64: a Python string literal built from
 * JSON is nearly right and wrong in the corners, and nearly is not a thing
 * to be on a path that runs code.
 */
export function buildToolRunProgram(tool: Pick<ToolSpec, 'slug' | 'source'>, args: Record<string, unknown>): string {
  const name = registryToolName(tool.slug);
  const hoisted = importedModules(tool.source)
    .map(module => `try:\n    import ${module}\nexcept Exception:\n    pass`)
    .join('\n');

  return [
    `# TimeMachine tool ${name}`,
    hoisted,
    'import base64 as _tm_b64, json as _tm_json',
    `_tm_source = _tm_b64.b64decode(${JSON.stringify(toBase64(tool.source))}).decode("utf-8")`,
    `_tm_args = _tm_json.loads(_tm_b64.b64decode(${JSON.stringify(toBase64(JSON.stringify(args)))}).decode("utf-8"))`,
    `_tm_ns = {"__name__": ${JSON.stringify(name)}, "show": show}`,
    `exec(compile(_tm_source, ${JSON.stringify(name)}, "exec"), _tm_ns)`,
    'if not callable(_tm_ns.get("main")):',
    `    raise RuntimeError("${name} defines no main() function.")`,
    '_tm_ret = _tm_ns["main"](**_tm_args)',
    'if _tm_ret is not None:',
    `    print("Returned: " + _tm_json.dumps(_tm_ret, default=str, ensure_ascii=False)[:${MAX_TOOL_RESULT_CHARS}])`,
    '',
  ].filter(line => line !== '').join('\n');
}

// ─── create_tool ────────────────────────────────────────────────────────────

export const CREATE_TOOL_NAME = 'create_tool';
export const CREATE_COMPOSED_TOOL_NAME = 'create_composed_tool';
export const PUBLISH_TOOL_NAME = 'publish_tool';

/**
 * Turns that ask for a tool rather than an answer.
 *
 * Narrow on purpose — the owner's call. A one-off calculation is run_python;
 * a tool is for something the user, or another user, will ask for again. The
 * other door is find_tools: a model that searched the catalogue and found
 * nothing has proven the capability is missing, and gets create_tool then.
 */
export const CREATE_TOOL_TERMS = [
  'make a tool', 'make me a tool', 'create a tool', 'build a tool', 'write a tool',
  'new tool', 'custom tool', 'as a tool', 'into a tool', 'save this as a tool',
  'turn this into a tool', 'reusable', 'reuse this', 'reuse it', 'so i can reuse',
  'every time i ask', 'whenever i ask', 'tool that', 'tool for', 'tool which',
];

export const createToolTool: ToolDefinition = {
  type: 'function',
  function: {
    name: CREATE_TOOL_NAME,
    // Every clause here is paid for on each turn that offers this tool, so the
    // schema says only what the model cannot infer. Field rules it gets wrong
    // come back as validation errors it can act on, which is cheaper than
    // teaching them up front on every request.
    description: "Create and test a reusable Python tool, then automatically save it to TimeMachine's shared registry. Use it when the user asks for a tool or find_tools found no fitting capability likely to be needed again; use run_python for one-offs. Source and tests must be generic and contain no user data, secrets, or real examples from private chats.",
    parameters: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'lowercase_with_underscores' },
        title: { type: 'string', description: 'Short human name.' },
        description: { type: 'string', description: 'What it does and when to call it, for a model.' },
        summary: { type: 'string', description: 'One line.' },
        parameters: { type: 'object', description: 'JSON Schema of the arguments (type object, properties, required).' },
        source: { type: 'string', description: 'Python defining main(**parameters). Return a JSON value; show() what the user should see; write files to /outputs.' },
        terms: { type: 'array', items: { type: 'string' }, description: '2-16 specific phrases a request would contain when this tool applies.' },
        tests: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              input: { type: 'object' },
              expect: { type: 'string', description: 'Substring the output must contain. Optional.' },
            },
            required: ['input'],
          },
          description: '1-5 calls that must pass.',
        },
      },
      required: ['slug', 'title', 'description', 'summary', 'parameters', 'source', 'terms', 'tests'],
      additionalProperties: false,
    },
  },
};

export const createToolDescriptor: ToolDescriptor = {
  name: CREATE_TOOL_NAME,
  definition: createToolTool,
  runtime: 'device',
  // Gated, and reachable through find_tools — which is the door that matters:
  // executeTool grants it when a search comes back empty, because that is the
  // moment the model has shown a capability is genuinely missing.
  tier: 'gated',
  requires: ['python', 'authenticated'],
  summary: 'Write, test, and automatically share a reusable Python tool in the TM registry.',
  origin: 'builtin',
  select: { intent: CREATE_TOOL_TERMS },
  capability: generatedToolCapability(CREATE_TOOL_NAME, 'Create tool', createToolTool.function.parameters, 'external-write'),
};

export const createComposedToolTool: ToolDefinition = {
  type: 'function',
  function: {
    name: CREATE_COMPOSED_TOOL_NAME,
    description: 'Create, validate, and automatically share a reusable read-only tool combining TM Notes or chat-history reads. No Python needed. Steps may call only notes_search, notes_read, chats_search or chats_read. Arguments may refer to the new tool inputs as $input.field. Never embed user data in a public tool.',
    parameters: {
      type: 'object',
      properties: {
        slug: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, summary: { type: 'string' },
        parameters: { type: 'object', description: 'JSON Schema for the new tool inputs.' },
        steps: { type: 'array', items: { type: 'object', properties: { tool: { type: 'string', enum: [...COMPOSED_READ_TOOLS] }, arguments: { type: 'object' } }, required: ['tool', 'arguments'] }, description: '1–4 read-only calls. String arguments can be $input.field references.' },
        terms: { type: 'array', items: { type: 'string' } },
        tests: { type: 'array', items: { type: 'object', properties: { input: { type: 'object' }, expect: { type: 'string' } }, required: ['input'] }, description: '1–5 synthetic inputs; expect may match the resolved read plan.' },
      },
      required: ['slug', 'title', 'description', 'summary', 'parameters', 'steps', 'terms', 'tests'],
      additionalProperties: false,
    },
  },
};

export const createComposedToolDescriptor: ToolDescriptor = {
  name: CREATE_COMPOSED_TOOL_NAME, definition: createComposedToolTool, runtime: 'device', tier: 'gated',
  requires: ['composed-tools', 'authenticated'], summary: 'Make a reusable read-only TM Notes/chat tool without Python.', origin: 'builtin',
  select: { intent: ['combine my notes and chats', 'search notes and chats', 'read across notes and chats', 'compose a tool', 'read-only tool', 'tool that searches my notes', 'tool that searches my chats'] },
  capability: generatedToolCapability(CREATE_COMPOSED_TOOL_NAME, 'Create composed tool', createComposedToolTool.function.parameters, 'external-write'),
};

export const publishToolTool: ToolDefinition = {
  type: 'function',
  function: {
    name: PUBLISH_TOOL_NAME,
    description: 'Retry saving a tested tool to the shared TimeMachine registry when its automatic publication failed. No additional user request is needed.',
    parameters: {
      type: 'object',
      properties: { slug: { type: 'string', description: 'The local tool slug to publish.' } },
      required: ['slug'],
      additionalProperties: false,
    },
  },
};

export const publishToolDescriptor: ToolDescriptor = {
  name: PUBLISH_TOOL_NAME,
  definition: publishToolTool,
  runtime: 'device',
  tier: 'gated',
  requires: ['authenticated'],
  summary: 'Retry central publication of a tested tool when automatic save failed.',
  origin: 'builtin',
  select: { intent: ['publish', 'retry publication', 'save the tool', 'share publicly', 'shared registry', 'share the tool', 'make this tool public'] },
  capability: generatedToolCapability(PUBLISH_TOOL_NAME, 'Publish tool', publishToolTool.function.parameters, 'external-write'),
};

function generatedToolCapability(
  name: string,
  title: string,
  inputSchema: Record<string, unknown>,
  effect: CapabilityManifest['effect'],
): CapabilityManifest {
  return {
    id: `tm.tools.${name === CREATE_TOOL_NAME ? 'create' : 'publish'}`,
    version: 1,
    name,
    title,
    description: name === CREATE_TOOL_NAME ? 'Create, test, and publish a reusable tool.' : 'Retry publishing a tested tool for other TM instances.',
    examples: name === CREATE_TOOL_NAME ? ['make a reusable unit converter'] : ['publish that tool for everyone'],
    effect,
    runtime: 'browser',
    persistence: 'cloud',
    background: 'none',
    requiredGrants: ['python'],
    inputSchema,
    outputSchema: { type: 'object', additionalProperties: true },
  };
}
