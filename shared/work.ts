import { z } from 'zod';

export const workPersonaSchema = z.enum(['default', 'girlie', 'pro']);
export type WorkPersona = z.infer<typeof workPersonaSchema>;
export const workStatusSchema = z.enum(['queued', 'planning', 'review', 'running', 'completed', 'failed', 'cancelled']);
export type WorkStatus = z.infer<typeof workStatusSchema>;
export const ACTIVE_WORK_STATUSES: WorkStatus[] = ['queued', 'planning', 'review', 'running'];
export const isWorkActive = (status: WorkStatus) => ACTIVE_WORK_STATUSES.includes(status);
export const isWorkExecuting = (status: WorkStatus) => ['queued', 'planning', 'running'].includes(status);
export const workPathSchema = z.string().min(1).max(160)
  .regex(/^[a-zA-Z0-9_ .\-/]+$/)
  .refine(path => !path.startsWith('/') && path.split('/').every(part => part !== '.' && part !== '..' && part.trim().length > 0), 'Use a relative workspace path');
export const workFileKindSchema = z.enum(['markdown', 'text', 'csv', 'code']);
export const workPlanSchema = z.object({
  title: z.string().min(1).max(120),
  approach: z.string().min(1).max(1800),
  steps: z.array(z.object({ title: z.string().min(1).max(180), description: z.string().min(1).max(1600) }).strict()).min(1).max(6),
  deliverables: z.array(z.string().min(1).max(200)).min(1).max(8),
  limitations: z.array(z.string().min(1).max(400)).max(8),
}).strict();
export type WorkPlan = z.infer<typeof workPlanSchema>;
export const workThreadSchema = z.array(z.object({
  role: z.enum(['user', 'assistant']), content: z.string().min(1).max(12000), at: z.iso.datetime(),
}).strict()).max(80);
export const workTaskSchema = z.object({
  id: z.uuid(), user_id: z.uuid(), session_id: z.uuid(), title: z.string().max(120),
  goal: z.string().max(12000), instructions: z.string().max(4000), persona: workPersonaSchema,
  status: workStatusSchema, plan: workPlanSchema.nullable(), thread: workThreadSchema,
  step_index: z.number().int().min(0).max(6), revision: z.number().int().nonnegative(), generation: z.number().int().nonnegative(),
  summary: z.string().max(12000).nullable(), error: z.string().max(1000).nullable(),
  worker_id: z.string().max(200).nullable(), created_at: z.iso.datetime({ offset: true }), updated_at: z.iso.datetime({ offset: true }),
}).passthrough();
export type WorkTask = z.infer<typeof workTaskSchema>;
export const workFileSchema = z.object({
  id: z.uuid(), task_id: z.uuid(), path: workPathSchema, kind: workFileKindSchema,
  content: z.string().max(80000), revision: z.number().int().positive(), source: z.boolean(),
  updated_at: z.iso.datetime({ offset: true }),
}).passthrough();
export type WorkFile = z.infer<typeof workFileSchema>;
export const workActivitySchema = z.object({
  task_id: z.uuid(), sequence: z.number().int().positive(), type: z.string().max(80),
  title: z.string().max(300), created_at: z.iso.datetime({ offset: true }),
}).passthrough();
export type WorkActivity = z.infer<typeof workActivitySchema>;
export const workTraceSchema = z.object({
  id: z.uuid(), phase: z.string().max(40), provider: z.string().max(60), model: z.string().max(200),
  outcome: z.enum(['failed', 'invalid_output', 'completed']),
  latency_ms: z.number().nullable(), input_tokens: z.number().nullable(), output_tokens: z.number().nullable(),
  estimated_cost: z.number().nullable(), config_version: z.string().max(80), created_at: z.iso.datetime({ offset: true }),
}).passthrough();
export type WorkTrace = z.infer<typeof workTraceSchema>;
export interface WorkCapabilities {
  access: 'allowed' | 'sign_in' | 'premium' | 'setup';
  cloud: boolean;
  local: boolean;
  background: boolean;
  openhands: boolean;
  agenta: boolean;
  message: string | null;
}
export interface WorkSnapshot { task: WorkTask; files: WorkFile[]; activity: WorkActivity[]; traces: WorkTrace[] }
const id = z.uuid();
const source = z.object({ path: workPathSchema, kind: workFileKindSchema, content: z.string().max(80000) }).strict();
export const workRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), sessionId: id, requestId: id, goal: z.string().trim().min(1).max(12000), instructions: z.string().max(4000).default(''), persona: workPersonaSchema, files: z.array(source).max(8).default([]) }).strict(),
  z.object({ action: z.literal('approve'), taskId: id, revision: z.number().int().nonnegative(), runtime: z.enum(['native','openhands']).optional() }).strict(),
  z.object({ action: z.literal('cancel'), taskId: id }).strict(),
  z.object({ action: z.literal('steer'), taskId: id, revision: z.number().int().nonnegative(), message: z.string().trim().min(1).max(4000) }).strict(),
  z.object({ action: z.literal('save_file'), taskId: id, path: workPathSchema, revision: z.number().int().positive(), content: z.string().max(80000) }).strict(),
]).superRefine((body, ctx) => {
  if (body.action === 'create') {
    if (new Set(body.files.map(file => file.path)).size !== body.files.length) ctx.addIssue({ code: 'custom', message: 'Duplicate source paths' });
    if (body.files.reduce((total, file) => total + new TextEncoder().encode(file.content).length, 0) > 200000) ctx.addIssue({ code: 'custom', message: 'Source files exceed the task limit' });
  }
});
export type WorkRequest = z.infer<typeof workRequestSchema>;
export const workActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('search'), query: z.string().min(1).max(500) }).strict(),
  z.object({ action: z.literal('fetch'), url: z.url().max(2048) }).strict(),
  z.object({ action: z.literal('read_file'), path: workPathSchema }).strict(),
  z.object({ action: z.literal('analyze_csv'), path: workPathSchema }).strict(),
  z.object({ action: z.literal('write_file'), path: workPathSchema, kind: workFileKindSchema, content: z.string().min(1).max(60000) }).strict(),
  z.object({ action: z.literal('finish_step'), summary: z.string().min(1).max(1800) }).strict(),
]);
export type WorkAction = z.infer<typeof workActionSchema>;

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  queued: 'Queued', planning: 'Making a plan', review: 'Ready for review', running: 'Working',
  completed: 'Completed', failed: 'Needs attention', cancelled: 'Stopped',
};
