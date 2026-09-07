import { z } from 'zod';
import { schemaSpecSchema } from '../agent/schemaSpec';
import { grantScopeSchema } from '../agent/contracts';
import { idSchema, versionSchema } from '../agent/primitives';

// Resolver IDs select shipped code. A manifest never supplies executable URLs.
export const appDescriptorSchema = z.object({
  schemaVersion: z.literal(1), id: idSchema, name: z.string().min(1).max(128), version: versionSchema,
  tools: z.array(z.object({ id: idSchema, version: versionSchema }).strict()).max(64),
  resourceSchemas: z.array(z.object({ type: idSchema, schema: schemaSpecSchema }).strict()).max(32),
  grants: z.array(grantScopeSchema).max(64),
  cards: z.array(z.enum(['note', 'chat', 'healthcare', 'file', 'preview'])).max(5),
  deepLinkResolvers: z.array(z.enum(['notes.object', 'chat.message', 'healthcare.record', 'artifact.file'])).max(4),
}).strict();
export type AppDescriptor = z.infer<typeof appDescriptorSchema>;
