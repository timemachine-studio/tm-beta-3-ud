import { z } from 'zod';
import { grantScopeSchema, toolDefinitionSchema } from './contracts';
import { digestSchema, idSchema, jsonValueSchema, versionSchema } from './primitives';
const fileSchema = z.string().min(1).max(256).refine(path => !path.startsWith('/') && !path.includes('\\') && path.split('/').every(part => part !== '..' && part !== '.' && part !== ''), 'Expected package-relative path');
export const packageManifestSchema = z.object({
  schemaVersion: z.literal(1), id: idSchema, version: versionSchema, contentHash: digestSchema,
  ownerId: idSchema, author: z.string().min(1).max(256), visibility: z.enum(['private', 'review', 'public']),
  sourceKind: z.enum(['builtin', 'template', 'generated', 'mcp']), description: z.string().min(1).max(2048),
  tools: z.array(toolDefinitionSchema).max(64), entryPoint: fileSchema,
  requiredGrants: z.array(grantScopeSchema).max(64), networkDestinations: z.array(z.string().url().max(2048)).max(64),
  resourceEffects: z.array(grantScopeSchema).max(64),
  runtimeLimits: z.object({ timeoutMs: z.number().int().positive().max(3600000), memoryMb: z.number().int().positive().max(65536), maxCostMicrousd: z.number().int().nonnegative().safe() }).strict(),
  dependencies: z.array(z.object({ id: idSchema, version: versionSchema, contentHash: digestSchema }).strict()).max(128),
  lockfile: fileSchema, testFixtures: z.array(fileSchema).max(128),
  testReport: z.object({ status: z.enum(['pending', 'passed', 'failed']), reportFile: fileSchema.optional() }).strict(),
  license: z.string().min(1).max(256), provenance: z.string().min(1).max(2048),
  template: jsonValueSchema.optional(),
}).strict();
export const skillManifestSchema = z.object({
  schemaVersion: z.literal(1), id: idSchema, version: versionSchema, contentHash: digestSchema,
  description: z.string().min(1).max(2048), applicability: z.string().max(4096),
  content: z.string().max(32768), references: z.array(fileSchema).max(64),
  toolDependencies: z.array(z.object({ id: idSchema, version: versionSchema, contentHash: digestSchema }).strict()).max(64),
}).strict();
export type PackageManifest = z.infer<typeof packageManifestSchema>;
export type SkillManifest = z.infer<typeof skillManifestSchema>;
