import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { privateSkillCloud } from './privateSkillCloud';
import {
  clearPrivateSkillsForTests,
  privateSkillRepository,
  resetPrivateSkillRepositoryForTests,
  type PrivateSkill,
} from './privateSkillRepository';

const input = {
  slug: 'school_essay',
  title: 'School essay workflow',
  description: 'Writes a clear school assignment from cited source conversations.',
  instructions: 'Find the relevant source conversations, read them, draft an age-appropriate essay, and save one note with source links.',
  toolDependencies: ['chats.search', 'chats.read', 'notes.write'],
};

describe('privateSkillRepository', () => {
  const accounts = new Map<string, PrivateSkill[]>();
  beforeEach(async () => {
    accounts.clear();
    vi.spyOn(privateSkillCloud, 'list').mockImplementation(async userId => [...(accounts.get(userId) ?? [])]);
    vi.spyOn(privateSkillCloud, 'listMetadata').mockImplementation(async userId =>
      (accounts.get(userId) ?? []).map(({ instructions: _instructions, steps: _steps, ...skill }) => ({ ...skill, steps: [] })));
    vi.spyOn(privateSkillCloud, 'read').mockImplementation(async (userId, idOrSlug) =>
      (accounts.get(userId) ?? []).find(skill => skill.id === idOrSlug || skill.slug === idOrSlug) ?? null);
    vi.spyOn(privateSkillCloud, 'count').mockImplementation(async userId => (accounts.get(userId) ?? []).length);
    vi.spyOn(privateSkillCloud, 'create').mockImplementation(async (userId, skill) => {
      accounts.set(userId, [...(accounts.get(userId) ?? []), skill]);
      return skill;
    });
    vi.spyOn(privateSkillCloud, 'update').mockImplementation(async (userId, skill, expectedVersion) => {
      const current = accounts.get(userId) ?? [];
      const index = current.findIndex(item => item.id === skill.id && item.version === expectedVersion);
      if (index < 0) throw new Error('Skill conflict');
      current[index] = skill;
      return skill;
    });
    resetPrivateSkillRepositoryForTests();
    await clearPrivateSkillsForTests();
  });
  afterEach(() => vi.restoreAllMocks());

  it('creates, searches, reads and updates a versioned private skill', async () => {
    privateSkillRepository.setUserId('alice');
    const created = await privateSkillRepository.create(input, 'run-1');
    expect(created.reused).toBe(false);
    expect(created.skill.version).toBe(1);

    expect((await privateSkillRepository.search('assignment'))[0]).not.toHaveProperty('instructions');
    expect((await privateSkillRepository.read('school_essay'))?.instructions).toContain('source conversations');

    const updated = await privateSkillRepository.update(created.skill.id, {
      ...input,
      expectedVersion: 1,
      instructions: `${input.instructions} Verify the final structure before saving.`,
    });
    expect(updated.version).toBe(2);
    await expect(privateSkillRepository.update(updated.id, { ...input, expectedVersion: 1 }))
      .rejects.toThrow(/conflict/i);
  });

  it('stores a private multi-tool workflow without granting its dependencies', async () => {
    privateSkillRepository.setUserId('alice');
    const steps = [
      { title: 'Find source notes', capability: 'notes_search', instruction: 'Search only the notes relevant to the request.' },
      { title: 'Check the calendar', capability: 'mcp__calendar__list', instruction: 'Read the connected calendar only if it is available and authorized.' },
    ];
    await privateSkillRepository.create({ ...input, slug: 'research_brief', steps });
    expect((await privateSkillRepository.read('research_brief'))?.steps).toEqual(steps);
    expect((await privateSkillRepository.search('research'))[0].steps).toEqual([]);
  });

  it('reuses one create receipt on a retried run', async () => {
    privateSkillRepository.setUserId('alice');
    const first = await privateSkillRepository.create(input, 'stable-run');
    const replay = await privateSkillRepository.create(input, 'stable-run');
    expect(replay.reused).toBe(true);
    expect(replay.skill.id).toBe(first.skill.id);
    expect(await privateSkillRepository.list()).toHaveLength(1);
  });

  it('isolates account workspaces on a shared browser profile', async () => {
    privateSkillRepository.setUserId('alice');
    await privateSkillRepository.create(input);
    privateSkillRepository.setUserId('bob');
    expect(await privateSkillRepository.list()).toEqual([]);
    privateSkillRepository.setUserId(null);
    expect(await privateSkillRepository.list()).toEqual([]);
  });

  it('rejects invalid or oversized reusable instructions', async () => {
    privateSkillRepository.setUserId('alice');
    await expect(privateSkillRepository.create({ ...input, slug: 'Bad Slug' })).rejects.toThrow();
    await expect(privateSkillRepository.create({ ...input, instructions: 'too short' })).rejects.toThrow();
  });
});
