import { describe, expect, it } from 'vitest';
import { prepareHarnessRecovery } from './harnessRecovery';
import type { Message } from '../../types/chat';
const checkpoint = { userContent: 'Fix login', turnId: '2026-09-12T12:00:00.000Z', content: 'Read files.', deviceRounds: 2, toolTranscript: [] };
const user = (content: string, createdAt: string): Message => ({ id: createdAt, content, createdAt, isAI: false });

describe('browser-only task recovery', () => {
  it('restores the interrupted turn after the chat message id changes on reload', () => {
    const restored = user(checkpoint.userContent, checkpoint.turnId);
    restored.id = 'new-database-id';
    const result = prepareHarnessRecovery([restored, { id: 'partial', content: 'Partial', isAI: true }], checkpoint, 'auto');
    expect(result.history).toEqual([restored]);
    expect(result.context.maxMode).toBe('auto');
  });
  it('recovers a prompt that never reached chat history before the tab closed', () => {
    const older = user('Previous task', '2026-09-12T11:00:00.000Z');
    const result = prepareHarnessRecovery([older], checkpoint, 'edit');
    expect(result.history).toHaveLength(2);
    expect(result.user.content).toBe('Fix login');
    expect(result.user.createdAt).toBe(checkpoint.turnId);
  });
  it('does not confuse repeated prompts or erase newer work', () => {
    const newer = user(checkpoint.userContent, '2026-09-12T13:00:00.000Z');
    expect(() => prepareHarnessRecovery([newer], checkpoint, 'auto')).toThrow('cannot replace newer');
  });
});
