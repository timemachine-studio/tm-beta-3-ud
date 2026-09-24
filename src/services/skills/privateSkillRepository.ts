import { z } from 'zod';
import { privateSkillCloud } from './privateSkillCloud';

const DB_NAME = 'tm-private-skills';
const DB_VERSION = 1;
const STORE = 'skills';
const MAX_SKILLS = 100;

const slugSchema = z.string().trim().toLowerCase()
  .min(2).max(64).regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/);
const titleSchema = z.string().trim().min(2).max(120);
const descriptionSchema = z.string().trim().min(8).max(500);
const instructionsSchema = z.string().trim().min(20).max(20_000);
const toolsSchema = z.array(z.string().trim().min(1).max(100)).max(32);
const stepsSchema = z.array(z.object({
  title: z.string().trim().min(2).max(120),
  capability: z.string().trim().max(120),
  instruction: z.string().trim().min(5).max(1000),
})).max(16);

export type WorkflowStep = z.infer<typeof stepsSchema>[number];

export interface PrivateSkill {
  id: string;
  slug: string;
  title: string;
  description: string;
  instructions: string;
  toolDependencies: string[];
  steps: WorkflowStep[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface StoredPrivateSkill extends PrivateSkill {
  key: string;
  workspace: string;
}

export interface PrivateSkillInput {
  slug: string;
  title: string;
  description: string;
  instructions: string;
  toolDependencies?: string[];
  steps?: WorkflowStep[];
}

function idbRequest<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    source.onsuccess = () => resolve(source.result);
    source.onerror = () => reject(source.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

let opening: Promise<IDBDatabase> | null = null;
function database(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Private skills require IndexedDB on this device.'));
      return;
    }
    const source = indexedDB.open(DB_NAME, DB_VERSION);
    source.onupgradeneeded = () => {
      if (source.result.objectStoreNames.contains(STORE)) return;
      const store = source.result.createObjectStore(STORE, { keyPath: 'key' });
      store.createIndex('workspace', 'workspace', { unique: false });
      store.createIndex('workspaceSlug', ['workspace', 'slug'], { unique: true });
      store.createIndex('workspaceUpdated', ['workspace', 'updatedAt'], { unique: false });
    };
    source.onsuccess = () => resolve(source.result);
    source.onerror = () => reject(source.error ?? new Error('IndexedDB open failed'));
  }).catch((error: unknown) => {
    opening = null;
    throw error;
  });
  return opening;
}

const workspaceFor = (userId: string | null): string => userId ? `account:${userId}` : 'guest';
const recordKey = (workspace: string, id: string): string => `${workspace}:${id}`;

function publicSkill(record: StoredPrivateSkill): PrivateSkill {
  const { key: _key, workspace: _workspace, ...skill } = record;
  void _key;
  void _workspace;
  return { ...skill, steps: skill.steps ?? [] };
}

function parseInput(input: PrivateSkillInput, fallbackSteps: WorkflowStep[] = []): Omit<PrivateSkillInput, 'toolDependencies' | 'steps'> & { toolDependencies: string[]; steps: WorkflowStep[] } {
  return {
    slug: slugSchema.parse(input.slug),
    title: titleSchema.parse(input.title),
    description: descriptionSchema.parse(input.description),
    instructions: instructionsSchema.parse(input.instructions),
    toolDependencies: toolsSchema.parse(input.toolDependencies ?? []),
    steps: stepsSchema.parse(input.steps ?? fallbackSteps),
  };
}

class PrivateSkillRepository {
  private userId: string | null = null;
  private migratedAccounts = new Set<string>();

  setUserId(userId: string | null): void {
    this.userId = userId;
  }

  private workspace(): string {
    return workspaceFor(this.userId);
  }

  storageLabel(): 'account_private_cloud' | 'guest_device_private' {
    return this.userId ? 'account_private_cloud' : 'guest_device_private';
  }

  private async listLocal(workspace: string): Promise<PrivateSkill[]> {
    const db = await database();
    const rows = await idbRequest(
      db.transaction(STORE, 'readonly').objectStore(STORE).index('workspace').getAll(workspace),
    ) as StoredPrivateSkill[];
    return rows.map(publicSkill).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  private async prepareCloud(userId: string): Promise<void> {
    if (this.migratedAccounts.has(userId)) return;
    // Earlier builds saved signed-in workflows to this device. Copy them to
    // the owner-scoped cloud table once, but leave the local copy as recovery.
    // IndexedDB is only the legacy source for signed-in accounts. A browser
    // that blocks it must still be able to use the account's cloud workflows.
    let local: PrivateSkill[] = [];
    let localAvailable = typeof indexedDB === 'undefined';
    if (typeof indexedDB !== 'undefined') {
      try {
        local = await this.listLocal(workspaceFor(userId));
        localAvailable = true;
      } catch (error) {
        console.warn('[Private workflows] Legacy device copy unavailable; continuing with account cloud store', error);
      }
    }
    if (local.length > 0) {
      const remote = await privateSkillCloud.list(userId);
      const existing = new Set(remote.map(skill => skill.slug));
      for (const skill of local) {
        if (existing.has(skill.slug)) continue;
        try {
          await privateSkillCloud.create(userId, skill);
        } catch (error) {
          const raced = await privateSkillCloud.list(userId);
          if (!raced.some(candidate => candidate.slug === skill.slug)) throw error;
        }
        existing.add(skill.slug);
      }
    }
    // Retry the legacy import if IndexedDB becomes available later. The cloud
    // read itself must not depend on that recovery path.
    if (localAvailable) this.migratedAccounts.add(userId);
  }

  async list(): Promise<PrivateSkill[]> {
    const userId = this.userId;
    if (!userId) return this.listLocal(this.workspace());
    await this.prepareCloud(userId);
    return privateSkillCloud.list(userId);
  }

  async search(query: string, limit = 10): Promise<Array<Omit<PrivateSkill, 'instructions'>>> {
    const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const userId = this.userId;
    if (userId) await this.prepareCloud(userId);
    const skills = userId
      ? await privateSkillCloud.listMetadata(userId)
      : await this.listLocal(this.workspace());
    const ranked = skills.map(skill => {
      const haystack = `${skill.slug} ${skill.title} ${skill.description}`.toLocaleLowerCase();
      const score = words.length === 0 ? 1 : words.reduce((sum, word) => sum + (haystack.includes(word) ? 1 : 0), 0);
      return { skill, score };
    }).filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score || b.skill.updatedAt.localeCompare(a.skill.updatedAt))
      .slice(0, Math.min(Math.max(limit, 1), 25));
    return ranked.map(({ skill }) => ({
      id: skill.id, slug: skill.slug, title: skill.title, description: skill.description,
      toolDependencies: skill.toolDependencies, version: skill.version,
      steps: skill.steps,
      createdAt: skill.createdAt, updatedAt: skill.updatedAt,
    }));
  }

  async read(idOrSlug: string): Promise<PrivateSkill | null> {
    const userId = this.userId;
    if (userId) {
      await this.prepareCloud(userId);
      return privateSkillCloud.read(userId, idOrSlug);
    }
    const skills = await this.listLocal(this.workspace());
    return skills.find(skill => skill.id === idOrSlug || skill.slug === idOrSlug) ?? null;
  }

  async create(input: PrivateSkillInput, runId?: string): Promise<{ skill: PrivateSkill; reused: boolean }> {
    const userId = this.userId;
    const value = parseInput(input);
    const existing = await this.read(value.slug);
    if (userId !== this.userId) throw new Error('private_workflow_account_changed');
    if (existing) {
      if (runId && existing.id === `run:${runId}:${value.slug}`) return { skill: existing, reused: true };
      throw new Error(`A private skill named ${value.slug} already exists. Update it instead.`);
    }
    const count = userId ? await privateSkillCloud.count(userId) : (await this.listLocal(this.workspace())).length;
    if (count >= MAX_SKILLS) throw new Error(`This account already has ${MAX_SKILLS} private workflows.`);
    const now = new Date().toISOString();
    const skill: PrivateSkill = {
      ...value,
      id: runId ? `run:${runId}:${value.slug}` : crypto.randomUUID(),
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    if (userId) {
      const saved = await privateSkillCloud.create(userId, skill);
      return { skill: saved, reused: false };
    }
    const workspace = this.workspace();
    const transaction = (await database()).transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put({ ...skill, key: recordKey(workspace, skill.id), workspace });
    await transactionDone(transaction);
    return { skill, reused: false };
  }

  async update(idOrSlug: string, input: PrivateSkillInput & { expectedVersion: number }): Promise<PrivateSkill> {
    const userId = this.userId;
    const current = await this.read(idOrSlug);
    if (userId !== this.userId) throw new Error('private_workflow_account_changed');
    if (!current) throw new Error('That private skill no longer exists. Search again for a current id.');
    if (current.version !== input.expectedVersion) {
      throw new Error(`Skill conflict: expected version ${input.expectedVersion}, but the current version is ${current.version}. Read it again before updating.`);
    }
    const value = parseInput(input, current.steps);
    const sameSlug = await this.read(value.slug);
    if (sameSlug && sameSlug.id !== current.id) throw new Error(`Another private skill already uses ${value.slug}.`);
    const updated: PrivateSkill = {
      ...current,
      ...value,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    };
    if (userId) return privateSkillCloud.update(userId, updated, input.expectedVersion);
    const workspace = this.workspace();
    const transaction = (await database()).transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put({ ...updated, key: recordKey(workspace, updated.id), workspace });
    await transactionDone(transaction);
    return updated;
  }

  async hasSkills(): Promise<boolean> {
    if (this.userId) {
      await this.prepareCloud(this.userId);
      return (await privateSkillCloud.count(this.userId)) > 0;
    }
    const db = await database();
    const count = await idbRequest(
      db.transaction(STORE, 'readonly').objectStore(STORE).index('workspace').count(this.workspace()),
    );
    return count > 0;
  }

  resetForTests(): void {
    this.migratedAccounts.clear();
    this.userId = null;
  }
}

export const privateSkillRepository = new PrivateSkillRepository();

export function resetPrivateSkillRepositoryForTests(): void {
  opening = null;
  privateSkillRepository.resetForTests();
}

export async function clearPrivateSkillsForTests(): Promise<void> {
  const db = await database();
  const transaction = db.transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).clear();
  await transactionDone(transaction);
}
