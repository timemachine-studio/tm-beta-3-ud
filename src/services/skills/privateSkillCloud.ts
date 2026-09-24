import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import type { PrivateSkill, WorkflowStep } from './privateSkillRepository';

const stepSchema = z.object({
  title: z.string(), capability: z.string(), instruction: z.string(),
});

const rowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  instructions: z.string(),
  tool_dependencies: z.array(z.string()),
  steps: z.array(stepSchema).default([]),
  version: z.number().int().positive(),
  created_at: z.string(),
  updated_at: z.string(),
});
const metadataSchema = rowSchema.omit({ instructions: true, steps: true });
const METADATA_COLUMNS = 'id,user_id,slug,title,description,tool_dependencies,version,created_at,updated_at';

function skillFromRow(value: unknown): PrivateSkill {
  const row = rowSchema.parse(value);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    instructions: row.instructions,
    toolDependencies: row.tool_dependencies,
    steps: row.steps as WorkflowStep[],
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PrivateSkillCloud {
  constructor(private readonly client: SupabaseClient = supabase as unknown as SupabaseClient) {}

  async list(userId: string): Promise<PrivateSkill[]> {
    const { data, error } = await this.client.from('private_workflows')
      .select('*').eq('user_id', userId).order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(skillFromRow);
  }

  async listMetadata(userId: string): Promise<Array<Omit<PrivateSkill, 'instructions'>>> {
    const { data, error } = await this.client.from('private_workflows')
      .select(METADATA_COLUMNS).eq('user_id', userId).order('updated_at', { ascending: false }).limit(100);
    if (error) throw error;
    return (data ?? []).map(value => {
      const row = metadataSchema.parse(value);
      return {
        id: row.id, slug: row.slug, title: row.title, description: row.description,
        toolDependencies: row.tool_dependencies, version: row.version,
        steps: [],
        createdAt: row.created_at, updatedAt: row.updated_at,
      };
    });
  }

  async read(userId: string, idOrSlug: string): Promise<PrivateSkill | null> {
    const byId = await this.client.from('private_workflows').select('*')
      .eq('user_id', userId).eq('id', idOrSlug).maybeSingle();
    if (byId.error) throw byId.error;
    if (byId.data) return skillFromRow(byId.data);
    const bySlug = await this.client.from('private_workflows').select('*')
      .eq('user_id', userId).eq('slug', idOrSlug).maybeSingle();
    if (bySlug.error) throw bySlug.error;
    return bySlug.data ? skillFromRow(bySlug.data) : null;
  }

  async count(userId: string): Promise<number> {
    const { count, error } = await this.client.from('private_workflows')
      .select('id', { count: 'exact', head: true }).eq('user_id', userId);
    if (error) throw error;
    return count ?? 0;
  }

  async create(userId: string, skill: PrivateSkill): Promise<PrivateSkill> {
    const { data, error } = await this.client.from('private_workflows').insert({
      id: skill.id,
      user_id: userId,
      slug: skill.slug,
      title: skill.title,
      description: skill.description,
      instructions: skill.instructions,
      tool_dependencies: skill.toolDependencies,
      steps: skill.steps,
      version: skill.version,
      created_at: skill.createdAt,
      updated_at: skill.updatedAt,
    }).select('*').single();
    if (error) throw error;
    return skillFromRow(data);
  }

  async update(userId: string, skill: PrivateSkill, expectedVersion: number): Promise<PrivateSkill> {
    const { data, error } = await this.client.from('private_workflows').update({
      slug: skill.slug,
      title: skill.title,
      description: skill.description,
      instructions: skill.instructions,
      tool_dependencies: skill.toolDependencies,
      steps: skill.steps,
      version: skill.version,
      updated_at: skill.updatedAt,
    }).eq('user_id', userId).eq('id', skill.id).eq('version', expectedVersion)
      .select('*').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Skill conflict: another device changed or removed this workflow. Read it again before updating.');
    return skillFromRow(data);
  }
}

export const privateSkillCloud = new PrivateSkillCloud();
