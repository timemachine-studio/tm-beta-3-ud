// The server and browser validate the same envelope. Authentication and grant
// construction belong to the broker, never to deserialization of this data.
export { parseAgentEventFrame, agentEventSchema } from '../../../shared/agent/events.js';
export type { TrustedExecutionContext, ToolExecutor, ChatRepository, ModelAdapter, RunRepository } from '../../../shared/agent/interfaces.js';
export type { AppDescriptor } from '../../../shared/apps/contracts.js';
