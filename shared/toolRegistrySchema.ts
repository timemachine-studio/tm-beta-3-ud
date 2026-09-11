/**
 * Validation for generated tools — at every boundary a spec crosses.
 *
 * A spec is untrusted three times over: when the model writes it, when the
 * browser sends the summary back in a request body, and when a row comes out
 * of the registry. The same schema runs at all three, so a tool that could
 * not be published cannot be offered, and a row someone edited by hand cannot
 * reach a sandbox.
 */

import { z } from 'zod';
import { argumentsSchema, digestSchema, hashArguments } from './agent/primitives.js';
import { inputSchemaSpecSchema } from './agent/schemaSpec.js';
import {
  RESERVED_TERMS,
  TOOL_SPEC_LIMITS,
  digestSubject,
  type PublishedTool,
  type SessionTool,
  type ToolSpec,
} from './toolRegistry.js';

const { slug, title, description, summary, source, terms, tests, parameters } = TOOL_SPEC_LIMITS;

/**
 * The model-facing signature, as the bounded JSON-Schema subset in
 * `schemaSpec.ts`. Normalised first: a model routinely leaves out
 * `additionalProperties: false`, and refusing the whole tool for that costs a
 * round trip to learn a rule it had no way to know.
 */
const parametersSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const object = value as Record<string, unknown>;
    return {
      type: 'object',
      properties: {},
      additionalProperties: false,
      ...object,
      ...(object.additionalProperties === undefined ? { additionalProperties: false } : {}),
    };
  },
  inputSchemaSpecSchema.refine(
    (schema) => Object.keys(schema.properties ?? {}).length <= parameters.max,
    `A tool may take at most ${parameters.max} parameters`,
  // A SchemaSpec is a Record<string, unknown> in every way but its declared
  // index signature; the descriptor and the wire type want the plain shape.
  ).transform((schema): Record<string, unknown> => ({ ...schema })),
);

const termSchema = z.string()
  .trim()
  .toLowerCase()
  .min(terms.termMin, `Each term needs at least ${terms.termMin} characters`)
  .max(terms.termMax)
  .refine((term) => !RESERVED_TERMS.has(term), {
    error: (issue) => `"${String(issue.input)}" is too generic to select a tool on; use words specific to what this tool does`,
  });

export const toolTestCaseSchema = z.object({
  // argumentsSchema has already proven this is a JSON object; the cast names
  // the type the runner and the stored-chat validator both want.
  input: argumentsSchema.transform((value) => value as Record<string, unknown>),
  expect: z.string().max(tests.expectMax).optional(),
}).strict();

export const toolSpecSchema = z.object({
  slug: z.string().regex(slug, 'slug must be lowercase letters, digits and underscores, 3–40 characters, starting with a letter'),
  title: z.string().trim().min(title.min).max(title.max),
  description: z.string().trim().min(description.min, `description needs at least ${description.min} characters`).max(description.max),
  summary: z.string().trim().min(summary.min, `summary needs at least ${summary.min} characters`).max(summary.max),
  parameters: parametersSchema,
  source: z.string()
    .min(source.min)
    .max(source.max, `source may be at most ${source.max} characters`)
    .refine((code) => /^[ \t]*def[ \t]+main[ \t]*\(/m.test(code), 'source must define a top-level main() function'),
  terms: z.array(termSchema).min(terms.min, `at least ${terms.min} terms`).max(terms.max)
    .transform((list) => [...new Set(list)]),
  tests: z.array(toolTestCaseSchema).min(tests.min, 'at least one test').max(tests.max),
}).strict();

export type ParsedToolSpec = z.infer<typeof toolSpecSchema>;

/** The subset a request body carries. Everything a descriptor is built from. */
export const sessionToolSummarySchema = toolSpecSchema.pick({
  slug: true, title: true, description: true, summary: true, parameters: true, terms: true,
});

export const publishedToolSchema = toolSpecSchema.extend({
  id: z.string().min(1).max(64),
  version: z.number().int().min(1),
  digest: digestSchema,
  authorId: z.string().max(64).nullable(),
  createdAt: z.string().max(64),
}).strict();

export const sessionToolSchema = toolSpecSchema.extend({
  digest: digestSchema,
  version: z.number().int().min(1),
  published: z.boolean(),
  registryId: z.string().max(64).optional(),
}).strict();

export const registryToolPayloadSchema = z.object({
  id: z.string().min(1).max(64),
  slug: z.string().regex(slug),
  title: z.string().min(title.min).max(title.max),
  version: z.number().int().min(1),
  digest: digestSchema,
  parameters: parametersSchema,
  source: z.string().min(source.min).max(source.max),
}).strict();

/**
 * What a tool *is*, for the registry's unique constraint and the browser's
 * check before running published code. See `digestSubject` for what counts.
 */
export function toolDigest(tool: Pick<ToolSpec, 'slug' | 'parameters' | 'source'>): Promise<string> {
  // Over the normalised signature, so the digest of a spec as the model wrote
  // it and of the same spec as the registry stores it are one digest.
  return hashArguments(digestSubject({ ...tool, parameters: parametersSchema.parse(tool.parameters) }));
}

/** Zod issues, phrased so the model can fix the spec on its next call. */
export function describeSpecIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `- ${issue.path.length ? issue.path.join('.') : 'spec'}: ${issue.message}`)
    .join('\n');
}

/** What the model wrote, validated — or the reasons it was not, for the model. */
export function parseToolSpec(value: unknown): { ok: true; spec: ToolSpec } | { ok: false; issues: string } {
  const parsed = toolSpecSchema.safeParse(value);
  return parsed.success
    ? { ok: true, spec: parsed.data }
    : { ok: false, issues: describeSpecIssues(parsed.error) };
}

/** Row → validated tool, or null. The caller logs the id; the row is skipped. */
export function parsePublishedTool(value: unknown): PublishedTool | null {
  const parsed = publishedToolSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseSessionTool(value: unknown): SessionTool | null {
  const parsed = sessionToolSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
