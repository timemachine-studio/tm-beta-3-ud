// The server and browser validate the same envelope. Authentication and grant
// construction belong to the broker, never to deserialization of this data.
export { parseAgentEventFrame, agentEventSchema } from '../../../shared/agent/events';
export type { TrustedExecutionContext, ToolExecutor, ChatRepository, ModelAdapter, RunRepository } from '../../../shared/agent/interfaces';
export type { AppDescriptor } from '../../../shared/apps/contracts';
