import { describe, expect, it } from 'vitest';
import {
  MAX_MODE_ROUND_BUDGET,
  MAX_MODE_TOOLS,
  isWorkspaceToolName,
  maxModeOffersPython,
  normalizeWorkspacePath,
  workspaceToolsFor,
  type MaxModeRequest,
} from '../../shared/maxMode.js';
import { isDeviceToolName } from '../../shared/deviceTools.js';
import { aiProxyBodySchema } from './validation.js';
import { buildMaxModePrompt } from './maxModePrompt.js';
import { selectMaxModeToolSet } from './tools.js';

const request = (overrides: Partial<MaxModeRequest> = {}, workspace: Partial<MaxModeRequest['workspace']> = {}): MaxModeRequest => ({
  mode: 'auto',
  workspace: { paths: ['package.json', 'src/index.ts'], truncated: false, runtimes: ['node', 'python'], ...workspace },
  ...overrides,
});

const names = (tools: Array<{ function: { name: string } }>) => tools.map(tool => tool.function.name);

describe('mode gate', () => {
  it('Plan mode is read-only', () => {
    const offered = names(workspaceToolsFor(request({ mode: 'plan' })));
    expect(offered).toEqual(['list_files', 'read_file', 'grep_files']);
  });

  it('Edit mode writes but never runs', () => {
    const offered = names(workspaceToolsFor(request({ mode: 'edit' })));
    expect(offered).toContain('edit_file');
    expect(offered).not.toContain('run_command');
    expect(offered).not.toContain('open_preview');
  });

  it('Auto mode has the whole loop', () => {
    const offered = names(workspaceToolsFor(request({ mode: 'auto' }, { repo: { owner: 'o', name: 'r', branch: 'main' } })));
    expect(offered).toEqual([...MAX_MODE_TOOLS.auto]);
  });

  it('keeps plain HTML previews available without the Node runtime', () => {
    // Static HTML previews do not need a WebContainer.
    const offered = names(workspaceToolsFor(request({ mode: 'auto' }, { runtimes: ['python'] })));
    expect(offered).not.toContain('run_command');
    expect(offered).toContain('open_preview');
    expect(offered).toContain('edit_file');
  });

  it('offers open_pull_request only with a connected repository', () => {
    expect(names(workspaceToolsFor(request()))).not.toContain('open_pull_request');
    expect(names(workspaceToolsFor(request({}, { repo: { owner: 'o', name: 'r', branch: 'main' } })))).toContain('open_pull_request');
  });

  it('gives Python to Auto only', () => {
    expect(maxModeOffersPython(request({ mode: 'auto' }))).toBe(true);
    expect(maxModeOffersPython(request({ mode: 'edit' }))).toBe(false);
    expect(maxModeOffersPython(request({ mode: 'auto' }, { runtimes: ['node'] }))).toBe(false);
  });
});

describe('workspace tools are device tools', () => {
  it('the bridge recognises every workspace tool name', () => {
    for (const name of MAX_MODE_TOOLS.auto) {
      expect(isWorkspaceToolName(name)).toBe(true);
      expect(isDeviceToolName(name)).toBe(true);
    }
    expect(isWorkspaceToolName('web_search')).toBe(false);
  });
});

describe('selectMaxModeToolSet', () => {
  it('is a closed set: workspace tools, Python, and the web pair — no catalogue', () => {
    const set = selectMaxModeToolSet({ request: request(), deviceApps: ['workspace', 'python', 'node'], deviceRoundsUsed: 0 });
    const offered = names(set.tools);
    expect(offered).toEqual(expect.arrayContaining(['read_file', 'edit_file', 'run_command', 'run_python', 'web_search', 'web_fetch']));
    expect(offered).not.toContain('find_tools');
    expect(offered).not.toContain('notes_search');
    expect(offered).not.toContain('generate_image');
    expect(set.canFindTools).toBe(false);
  });

  it('withholds the workspace tools from a client that did not declare the workspace', () => {
    const offered = names(selectMaxModeToolSet({ request: request(), deviceApps: ['python'], deviceRoundsUsed: 0 }).tools);
    expect(offered).toEqual(['web_search', 'web_fetch']);
  });

  it('stops offering workspace tools past the mode budget', () => {
    const budget = MAX_MODE_ROUND_BUDGET.plan;
    const before = names(selectMaxModeToolSet({ request: request({ mode: 'plan' }), deviceApps: ['workspace'], deviceRoundsUsed: budget - 1 }).tools);
    const after = names(selectMaxModeToolSet({ request: request({ mode: 'plan' }), deviceApps: ['workspace'], deviceRoundsUsed: budget }).tools);
    expect(before).toContain('read_file');
    expect(after).not.toContain('read_file');
    expect(after).toContain('web_search');
  });
});

describe('buildMaxModePrompt', () => {
  it('describes exactly the tools in the request and the mode', () => {
    const prompt = buildMaxModePrompt({ request: request({ mode: 'plan' }), toolNames: ['list_files', 'read_file', 'grep_files', 'web_search'], roundsUsed: 0 });
    expect(prompt).toContain('Mode: Plan');
    expect(prompt).toContain('- read_file');
    expect(prompt).not.toContain('Mode: Auto');
    // No runtime section without a runtime tool.
    expect(prompt).not.toContain('## The runtime');
    expect(prompt).toContain('src/index.ts');
  });

  it('tells the model when the budget is spent rather than letting tools vanish silently', () => {
    const prompt = buildMaxModePrompt({ request: request(), toolNames: ['web_search'], roundsUsed: MAX_MODE_ROUND_BUDGET.auto });
    expect(prompt).toContain('used every tool round');
  });

  it('mentions the repository only when one is connected', () => {
    expect(buildMaxModePrompt({ request: request(), toolNames: [], roundsUsed: 0 })).not.toContain('Connected repository');
    expect(buildMaxModePrompt({ request: request({}, { repo: { owner: 'o', name: 'r', branch: 'dev' } }), toolNames: [], roundsUsed: 0 })).toContain('o/r');
  });
});

describe('request schema', () => {
  it('accepts a Max Mode body and ignores the retired heatLevel', () => {
    const parsed = aiProxyBodySchema.safeParse({
      messages: [{ content: 'hi', isAI: false }],
      persona: 'pro',
      stream: true,
      heatLevel: 4,
      maxMode: request(),
      deviceApps: ['workspace', 'python', 'node'],
      deviceRounds: 30,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.maxMode?.mode).toBe('auto');
      expect(parsed.data.deviceApps).toContain('workspace');
    }
  });

  it('rejects a mode it does not know', () => {
    const parsed = aiProxyBodySchema.safeParse({
      messages: [{ content: 'hi', isAI: false }],
      persona: 'pro',
      maxMode: { mode: 'yolo', workspace: { paths: [], truncated: false, runtimes: [] } },
    });
    expect(parsed.success).toBe(false);
  });
});

describe('normalizeWorkspacePath', () => {
  it('collapses dots and slashes, refuses escapes', () => {
    expect(normalizeWorkspacePath('./src//a.ts')).toBe('src/a.ts');
    expect(normalizeWorkspacePath('/src/a.ts')).toBe('src/a.ts');
    expect(normalizeWorkspacePath('src\\a.ts')).toBe('src/a.ts');
    expect(normalizeWorkspacePath('../etc/passwd')).toBeNull();
    expect(normalizeWorkspacePath('src/../../x')).toBeNull();
  });
});
