// Synthetic UI-only fixture. Run manually in an isolated QA browser.
// Intercepts only /api/work. Does not create accounts, tasks or provider calls.
(() => {
  const id = '11111111-1111-4111-8111-111111111111';
  const at = '2026-09-27T10:00:00Z';
  const task = { id, user_id: '22222222-2222-4222-8222-222222222222', session_id: '33333333-3333-4333-8333-333333333333', title: 'Research brief · UI sample', goal: 'Turn source notes into a reviewable brief (synthetic sample).', instructions: 'Use concise sections.', persona: 'default', status: 'review', step_index: 0, revision: 3, generation: 0, summary: null, error: null, worker_id: null, created_at: at, updated_at: at,
    plan: { title: 'Research brief', approach: 'Review the supplied notes, organize the main findings, and save a Markdown brief with next steps.', steps: [{ title: 'Review source notes', description: 'Identify the main question, known facts and any gaps.' }, { title: 'Write the brief', description: 'Save an editable Markdown deliverable with findings and next steps.' }], deliverables: ['research-brief.md'], limitations: ['This is synthetic UI test data, not a real AI task.'] },
    thread: [{ role: 'user', content: 'Turn these notes into a brief. This is a synthetic UI test.', at }, { role: 'assistant', content: 'I’ll organize the notes and create a brief you can review. Approve the plan to begin.', at }] };
  const files = [{ id: '44444444-4444-4444-8444-444444444444', task_id: id, path: 'source-notes.md', kind: 'markdown', content: '# Source notes\n\nSynthetic source notes for interface testing.', source: true, revision: 1, updated_at: at }, { id: '55555555-5555-4555-8555-555555555555', task_id: id, path: 'research-brief.md', kind: 'markdown', content: '# Research brief\n\nThis is a synthetic artifact used to test the interface, not a generated research finding.\n\n## Next steps\n\n- Review the scope.\n- Verify the sources.\n- Choose an action.', source: false, revision: 1, updated_at: at }];
  const snapshot = { task, files, activity: [{ task_id: id, sequence: 1, type: 'permission.required', title: 'Sample plan ready for review', created_at: at }], traces: [] };
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
    if (url.pathname !== '/api/work') return original(input, init);
    let payload;
    if (url.searchParams.has('capabilities')) payload = { access: 'allowed', cloud: true, local: true, background: true, openhands: false, agenta: false, message: null };
    else if (url.searchParams.has('connections')) payload = { connections: ['openhands', 'agenta'].map(service => ({ service, configured: false, monitoringEnabled: false, exportEnabled: false, executionEnabled: false, message: 'Synthetic UI sample: no upstream service is connected.' })) };
    else if (url.searchParams.has('integration')) payload = { service: url.searchParams.get('integration'), connected: false, executionEnabled: false, message: 'Synthetic UI sample: no upstream service is connected.', conversation: null, events: [], traces: [] };
    else if (init?.method === 'POST') {
      const body = JSON.parse(init.body);
      if (body.action === 'save_file') { const file = files.find(file => file.path === body.path); if (file) { file.content = body.content; file.revision++; } task.revision++; }
      else if (body.action === 'approve') { task.status = 'running'; task.revision++; }
      else if (body.action === 'cancel') { task.status = 'cancelled'; task.revision++; }
      else if (body.action === 'steer') { task.thread.push({ role: 'user', content: body.message, at }); task.revision++; }
      payload = snapshot;
    } else payload = url.searchParams.has('taskId') ? snapshot : { tasks: [task] };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  return 'Synthetic Work UI fixture installed; backend calls are intercepted.';
})();
