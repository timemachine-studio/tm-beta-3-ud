import { describe, expect, it } from 'vitest';
import { executeTool, createToolPolicy, selectToolSet, type UserSkill } from './tools.js';
import type { ProviderTool } from './providerTypes.js';

const silent = { emitText: () => {}, emitMarker: () => {} };
const names = (tools: ProviderTool[]) => tools.map(t => t.function.name);

const latex: UserSkill = {
  slug: 'latex_formatting',
  name: 'LaTeX formatting',
  description: 'Formats mathematics properly.',
  content: '# LaTeX\nUse $$ for display maths.',
};

const custom: UserSkill = {
  slug: 'company_tone',
  name: 'Company tone',
  description: "Writes in the company's house voice.",
  content: '# Tone\nShort sentences.',
};

async function listSkills(ctx: Parameters<typeof executeTool>[1]) {
  const result = await executeTool(
    { id: '1', function: { name: 'list_skills', arguments: '{}' } },
    ctx,
    silent,
  );
  return (JSON.parse(result) as Array<{ name: string }>).map(s => s.name);
}

describe('Flight Controls skills reaching the model', () => {
  const base = { persona: 'pro', policy: createToolPolicy({ offered: ['list_skills', 'read_skill'] }) };

  it('falls back to the built-in library when no catalog reached us', async () => {
    // Anonymous users, and any path where Supabase was unavailable. This is
    // exactly the behaviour from before Flight Controls was wired in.
    const listed = await listSkills(base);
    expect(listed).toContain('frontend_design');
    expect(listed).toContain('latex_formatting');
  });

  it('drops a governed built-in the user switched off', async () => {
    // The half that did not work before: the catalog defines latex_formatting
    // and the user has not enabled it, so it must not come back through
    // SKILLS_DATA. Without this the toggle only works one way.
    const listed = await listSkills({
      ...base,
      userSkills: [],
      governedSkillSlugs: ['frontend_design', 'human_writing_style', 'latex_formatting'],
    });
    expect(listed).not.toContain('latex_formatting');
    expect(listed).not.toContain('frontend_design');
  });

  it('keeps a governed built-in the user switched on', async () => {
    const listed = await listSkills({
      ...base,
      userSkills: [latex],
      governedSkillSlugs: ['frontend_design', 'human_writing_style', 'latex_formatting'],
    });
    expect(listed).toContain('latex_formatting');
    expect(listed).not.toContain('frontend_design');
  });

  it('keeps a built-in the catalog does not know about', async () => {
    const listed = await listSkills({
      ...base,
      userSkills: [],
      governedSkillSlugs: ['latex_formatting'],
    });
    // Governed and off.
    expect(listed).not.toContain('latex_formatting');
    // Not in the catalog at all, so not the user's decision to have made.
    expect(listed).toContain('frontend_design');
  });

  it('serves the catalog copy of a skill, not the hardcoded one', async () => {
    const content = await executeTool(
      { id: '1', function: { name: 'read_skill', arguments: JSON.stringify({ name: 'latex_formatting' }) } },
      { ...base, userSkills: [latex], governedSkillSlugs: ['latex_formatting'] },
      silent,
    );
    expect(content).toBe(latex.content);
  });

  it('serves a skill that exists only in the catalog', async () => {
    const listed = await listSkills({ ...base, userSkills: [custom], governedSkillSlugs: ['company_tone'] });
    expect(listed).toContain('company_tone');

    const content = await executeTool(
      { id: '1', function: { name: 'read_skill', arguments: JSON.stringify({ name: 'company_tone' }) } },
      { ...base, userSkills: [custom], governedSkillSlugs: ['company_tone'] },
      silent,
    );
    expect(content).toBe(custom.content);
  });
});

describe('who gets the skills tools at all', () => {
  it('gives them to PRO unconditionally', () => {
    const set = selectToolSet({ messages: [{ content: 'hi', isAI: false }], includeSkills: true, surface: 'pro' });
    expect(names(set.tools)).toEqual(expect.arrayContaining(['list_skills', 'read_skill']));
  });

  it('keeps them off an Air message from a user who enabled nothing', () => {
    // Two schemas on every message to reach a library the user never opted
    // into is a per-message tax for nothing.
    const set = selectToolSet({ messages: [{ content: 'hi', isAI: false }], includeSkills: false });
    expect(names(set.tools)).not.toContain('list_skills');
  });

  it('gives them to Air once the user has enabled a skill', () => {
    const set = selectToolSet({ messages: [{ content: 'hi', isAI: false }], includeSkills: true });
    expect(names(set.tools)).toEqual(expect.arrayContaining(['list_skills', 'read_skill']));
  });
});
