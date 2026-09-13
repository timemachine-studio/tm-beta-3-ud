import { describe, expect, it } from 'vitest';
import { pendingPublication, requestPublicationApproval } from './publicationApproval';
const proposal = { repository: 'o/r', base: 'main', branch: 'tm/test', title: 'Fix', body: 'Tested', changes: [{ path: 'a.ts', content: 'new' }] };

describe('publication approval', () => {
  it('requires a fresh decision for each proposal', async () => {
    const first = requestPublicationApproval('s', proposal);
    pendingPublication('s')!.settle(true);
    expect(await first).toBe(true);
    const second = requestPublicationApproval('s', proposal);
    expect(pendingPublication('s')).not.toBeNull();
    pendingPublication('s')!.settle(false);
    expect(await second).toBe(false);
  });
  it('cancellation clears the dialog and denies the pending publication', async () => {
    const controller = new AbortController();
    const decision = requestPublicationApproval('s', proposal, controller.signal);
    controller.abort();
    expect(await decision).toBe(false);
    expect(pendingPublication('s')).toBeNull();
  });
});
