import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createHarnessBridge, recallHarnessResume } from './harnessBridge';
import { getWorkspaceMeta, updateWorkspaceMeta } from './workspaceStore';
const checkpoint = { content: 'Read files', deviceRounds: 1, toolTranscript: [] };

describe('checkpoint ownership', () => {
  it('persists the prompt before the first model call and matches retries by turn', async () => {
    const bridge = createHarnessBridge({ sessionId: 'journal', mode: 'auto', userContent: 'same prompt', turnId: 'turn-1' });
    await bridge.onStart!();
    expect((await getWorkspaceMeta('journal'))?.resume?.userContent).toBe('same prompt');
    await bridge.onCheckpoint!(checkpoint);
    expect(await recallHarnessResume('journal', 'same prompt', 'turn-1')).toEqual(checkpoint);
    expect(await recallHarnessResume('journal', 'same prompt', 'turn-2')).toBeNull();
  });
  it('late callbacks from a stopped task cannot replace or clear the newer checkpoint', async () => {
    const old = createHarnessBridge({ sessionId: 'journal-race', mode: 'auto', userContent: 'old task', turnId: 'old' });
    const current = createHarnessBridge({ sessionId: 'journal-race', mode: 'edit', userContent: 'new task', turnId: 'new' });
    await old.onStart!();
    await current.onStart!();
    await current.onCheckpoint!(checkpoint);
    await expect(old.onCheckpoint!({ ...checkpoint, content: 'stale' })).rejects.toThrow('superseded');
    await updateWorkspaceMeta('journal-race', { resume: undefined }, 'old');
    expect((await getWorkspaceMeta('journal-race'))?.resume).toMatchObject({ userContent: 'new task', content: 'Read files' });
  });
});
