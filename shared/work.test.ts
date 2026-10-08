import { describe, expect, it } from 'vitest';
import { isWorkActive, isWorkExecuting, workActionSchema, workPathSchema, workRequestSchema } from './work';
const uuid = '11111111-1111-4111-8111-111111111111';
const create = { action: 'create', sessionId: uuid, requestId: uuid, goal: 'Create a brief', instructions: '', persona: 'pro', files: [] };
describe('Work boundaries', () => {
  it('requires review but does not treat it as executing', () => { expect(isWorkActive('review')).toBe(true); expect(isWorkExecuting('review')).toBe(false); expect(isWorkActive('cancelled')).toBe(false); });
  it.each(['../secret', '/etc/passwd', 'foo/../secret', 'C:\\secret', 'a//b', './a', 'a/ /b', 'a\u0000b'])('rejects unsafe path %s', path => expect(workPathSchema.safeParse(path).success).toBe(false));
  it('allows bounded relative output paths', () => expect(workPathSchema.parse('deliverables/Research brief.md')).toBe('deliverables/Research brief.md'));
  it('rejects forged owner fields and unsupported personas', () => {
    expect(workRequestSchema.safeParse({ ...create, user_id: uuid }).success).toBe(false);
    expect(workRequestSchema.safeParse({ ...create, persona: 'claude' }).success).toBe(false);
  });
  it('rejects duplicate and oversized source files by UTF-8 bytes', () => {
    const file = { path: 'notes.md', kind: 'markdown', content: 'Hi' };
    expect(workRequestSchema.safeParse({ ...create, files: [file, file] }).success).toBe(false);
    expect(workRequestSchema.safeParse({ ...create, files: [{ ...file, content: '🔥'.repeat(60000) }] }).success).toBe(false);
  });
  it('forbids command execution and unknown actions', () => {
    expect(workActionSchema.safeParse({ action: 'execute_command', command: 'curl attacker' }).success).toBe(false);
    expect(workActionSchema.safeParse({ action: 'write_file', path: 'file.txt', kind: 'text', content: 'Hi', overwriteOriginal: true }).success).toBe(false);
  });
  it('requires optimistic versions for approval and user edits', () => {
    expect(workRequestSchema.safeParse({ action: 'approve', taskId: uuid }).success).toBe(false);
    expect(workRequestSchema.safeParse({ action: 'save_file', taskId: uuid, path: 'a.txt', content: 'hi', revision: 0 }).success).toBe(false);
  });
  it('requires explicit upstream selection, never accepts a client-supplied runtime target', () => {
    const approve = { action: 'approve', taskId: uuid, revision: 7 };
    expect(workRequestSchema.parse(approve)).not.toHaveProperty('runtime');
    expect(workRequestSchema.parse({ ...approve, runtime: 'openhands' })).toHaveProperty('runtime', 'openhands');
    expect(workRequestSchema.safeParse({ ...approve, runtime: 'agenta' }).success).toBe(false);
    expect(workRequestSchema.safeParse({ ...approve, runtime: 'openhands', base_url: 'https://attacker.example' }).success).toBe(false);
  });
});
