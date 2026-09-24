import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PrivateSkillCloud } from './privateSkillCloud';
import type { PrivateSkill } from './privateSkillRepository';

const skill: PrivateSkill = {
  id: 'run:one:meeting_brief', slug: 'meeting_brief', title: 'Meeting brief',
  description: 'Write a concise meeting brief from selected source material.',
  instructions: 'Read the selected notes, separate decisions from questions, then summarize the next actions.',
  toolDependencies: ['notes_read', 'mcp__calendar__events'],
  steps: [{ title: 'Read sources', capability: 'notes_read', instruction: 'Read only the selected notes.' }],
  version: 2, createdAt: '2026-09-23T00:00:00.000Z', updatedAt: '2026-09-23T01:00:00.000Z',
};

const row = {
  id: skill.id, user_id: 'account-1', slug: skill.slug, title: skill.title,
  description: skill.description, instructions: skill.instructions,
  tool_dependencies: skill.toolDependencies, steps: skill.steps, version: skill.version,
  created_at: skill.createdAt, updated_at: skill.updatedAt,
};

describe('private cloud workflow queries', () => {
  it('scopes metadata reads to the account without fetching instructions', async () => {
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [
        Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'instructions' && key !== 'steps')),
      ], error: null }),
    };
    const from = vi.fn().mockReturnValue(query);
    const cloud = new PrivateSkillCloud({ from } as unknown as SupabaseClient);
    const found = await cloud.listMetadata('account-1');

    expect(from).toHaveBeenCalledWith('private_workflows');
    expect(query.select.mock.calls[0][0]).not.toContain('instructions');
    expect(query.select.mock.calls[0][0]).not.toContain('steps');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'account-1');
    expect(found[0]).not.toHaveProperty('instructions');
    expect(found[0].steps).toEqual([]);
  });

  it('uses the expected version in a cloud update and reports a conflict', async () => {
    const query = {
      update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const cloud = new PrivateSkillCloud({ from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient);
    await expect(cloud.update('account-1', skill, 1)).rejects.toThrow(/conflict/i);
    expect(query.eq).toHaveBeenCalledWith('user_id', 'account-1');
    expect(query.eq).toHaveBeenCalledWith('id', skill.id);
    expect(query.eq).toHaveBeenCalledWith('version', 1);
    expect(query.update.mock.calls[0][0].steps).toEqual(skill.steps);
  });
});
