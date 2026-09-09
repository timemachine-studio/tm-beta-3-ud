import { z } from 'zod';
import { jsonValueSchema, type JsonValue } from './primitives';

/** Deliberately bounded JSON Schema subset for v1 tool/resource definitions.
 * External schemas must be normalized by their adapter; no remote $ref loading. */
export interface SchemaSpec {
  type: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
  description?: string;
  properties?: Record<string, SchemaSpec>;
  required?: string[];
  additionalProperties?: false;
  items?: SchemaSpec;
  enum?: JsonValue[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
}
const node: z.ZodType<SchemaSpec, JsonValue> = z.lazy(() => z.object({
  type: z.enum(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']),
  description: z.string().max(2048).optional(),
  properties: z.record(z.string().min(1).max(128), node).optional(),
  required: z.array(z.string().min(1).max(128)).max(128).optional(),
  additionalProperties: z.literal(false).optional(), items: node.optional(),
  enum: z.array(jsonValueSchema).min(1).max(128).optional(),
  minLength: z.number().int().nonnegative().optional(), maxLength: z.number().int().nonnegative().optional(),
  minimum: z.number().finite().optional(), maximum: z.number().finite().optional(),
  minItems: z.number().int().nonnegative().optional(), maxItems: z.number().int().nonnegative().optional(),
}).strict().superRefine((value, ctx) => {
  const reject = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  if (value.type === 'object') {
    if (!value.properties || value.additionalProperties !== false) reject('Object schemas require properties and additionalProperties:false');
    if (value.required?.some(key => !Object.prototype.hasOwnProperty.call(value.properties ?? {}, key))) reject('Required keys must exist in properties');
  } else if (value.properties || value.required || value.additionalProperties !== undefined) reject('Object keywords require object type');
  if (value.type === 'array' && !value.items) reject('Array schemas require items');
  if (value.type !== 'array' && (value.items || value.minItems !== undefined || value.maxItems !== undefined)) reject('Array keywords require array type');
  if (value.type !== 'string' && (value.minLength !== undefined || value.maxLength !== undefined)) reject('String keywords require string type');
  if (!['number', 'integer'].includes(value.type) && (value.minimum !== undefined || value.maximum !== undefined)) reject('Numeric keywords require numeric type');
  if ((value.minLength ?? 0) > (value.maxLength ?? Infinity) || (value.minItems ?? 0) > (value.maxItems ?? Infinity) || (value.minimum ?? -Infinity) > (value.maximum ?? Infinity)) reject('Invalid bounds');
}));
// The preflight bounds recursion before the recursive schema validator runs.
export const schemaSpecSchema = jsonValueSchema.pipe(node);
export const inputSchemaSpecSchema = schemaSpecSchema.refine(value => value.type === 'object', 'Tool input must be an object schema');
