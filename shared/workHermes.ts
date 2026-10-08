import { z } from 'zod';
export const HERMES_FEATURES = {
  skills_api: 'Skill catalog', session_resources: 'Persistent sessions', run_events_sse: 'Run events',
  approval_events: 'Approval events', run_stop: 'Stop', run_steer: 'Steering', model_options: 'Model configuration',
} as const;
export const workHermesFeatureSchema = z.enum(['skills_api', 'session_resources', 'run_events_sse', 'approval_events', 'run_stop', 'run_steer', 'model_options']);
export const workHermesSkillSchema = z.object({
  name: z.string().min(1).max(120).refine(value => [...value].every(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)),
  description: z.string().max(500), category: z.string().max(100).nullable(),
});
export const workHermesSnapshotSchema = z.object({
  configured: z.boolean(), connected: z.boolean(), executionEnabled: z.literal(false), message: z.string().max(300),
  features: z.array(workHermesFeatureSchema).max(7), skills: z.array(workHermesSkillSchema).max(50),
  skillCatalogTruncated: z.boolean(),
}).strict();
export type WorkHermesSnapshot = z.infer<typeof workHermesSnapshotSchema>;
