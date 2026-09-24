/**
 * The product-level contract for anything TimeMachine can do.
 *
 * Tool schemas, Contour actions and future MCP/app adapters may expose the
 * capability differently, but they all describe the same facts here: effects,
 * execution location, persistence and background guarantees. Keeping these
 * facts beside the schema prevents a router from promising more than its
 * executor can deliver.
 *
 * This file is shared by browser and server code, so it has no runtime
 * dependencies.
 */

export type CapabilityEffect =
  | 'pure'
  | 'read'
  | 'local-write'
  | 'external-write'
  | 'destructive';

export type CapabilityRuntime = 'browser' | 'server' | 'mcp' | 'native' | 'isolated-cloud';
export type CapabilityPersistence = 'none' | 'device' | 'cloud';
export type CapabilityBackground = 'none' | 'while-open' | 'durable';

export interface CapabilityManifest {
  /** Stable product identity. Tool names are adapters and may change. */
  id: string;
  /** Immutable contract version. */
  version: number;
  name: string;
  title: string;
  description: string;
  examples: readonly string[];
  effect: CapabilityEffect;
  runtime: CapabilityRuntime;
  persistence: CapabilityPersistence;
  background: CapabilityBackground;
  /** Product capability/grant names, never credentials. */
  requiredGrants: readonly string[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

const objectSchema = (
  properties: Record<string, unknown>,
  required: readonly string[],
): Record<string, unknown> => ({
  type: 'object',
  properties,
  required: [...required],
  additionalProperties: false,
});

export const TIMER_START_CAPABILITY: CapabilityManifest = {
  id: 'tm.timer.start',
  version: 1,
  name: 'timer_start',
  title: 'Start timer',
  description: 'Start a countdown timer on this device now.',
  examples: ['set a timer for 2 minutes', 'start a 30 second countdown', 'timer for one hour'],
  effect: 'local-write',
  runtime: 'browser',
  persistence: 'device',
  // A persisted deadline survives refresh, but a web tab cannot promise an OS
  // alarm after the browser has been closed.
  background: 'while-open',
  requiredGrants: ['timer'],
  inputSchema: objectSchema({
    amount: { type: 'number', exclusiveMinimum: 0, description: 'The timer duration.' },
    unit: { type: 'string', enum: ['seconds', 'minutes', 'hours'], description: 'The duration unit.' },
    label: { type: 'string', description: 'A short label, or "Timer" when none was requested.' },
  }, ['amount', 'unit', 'label']),
  outputSchema: objectSchema({
    timer_id: { type: 'string' },
    status: { type: 'string', enum: ['running'] },
    deadline_at: { type: 'string' },
  }, ['timer_id', 'status', 'deadline_at']),
};

export const TIMER_CONTROL_CAPABILITY: CapabilityManifest = {
  id: 'tm.timer.control',
  version: 1,
  name: 'timer_control',
  title: 'Control timer',
  description: 'Pause, resume or cancel a timer on this device.',
  examples: ['pause the timer', 'resume my timer', 'cancel that countdown'],
  effect: 'local-write',
  runtime: 'browser',
  persistence: 'device',
  background: 'while-open',
  requiredGrants: ['timer'],
  inputSchema: objectSchema({
    timer_id: { type: 'string', description: 'Timer id, or empty to use the most recent active timer.' },
    action: { type: 'string', enum: ['pause', 'resume', 'cancel'], description: 'The requested control.' },
  }, ['timer_id', 'action']),
  outputSchema: objectSchema({
    timer_id: { type: 'string' },
    status: { type: 'string', enum: ['running', 'paused', 'cancelled', 'completed'] },
  }, ['timer_id', 'status']),
};

