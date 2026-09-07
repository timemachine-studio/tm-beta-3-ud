import type { SupabaseClient } from '@supabase/supabase-js';

/** Delete a user's storage prefix in bounded pages. Re-read page zero after
 * deletion so shrinking listings cannot skip objects. Preserve auth on failure
 * so the user can retry. This is invoked only by explicit account deletion. */
export async function purgeUserStorage(client: SupabaseClient, bucket: string, userId: string): Promise<void> {
  const storage = client.storage.from(bucket);
  let requests = 0;
  async function purge(prefix: string, depth: number): Promise<void> {
    if (depth > 10) throw new Error('storage_depth_exceeded');
    while (true) {
      if (++requests > 1000) throw new Error('storage_cleanup_incomplete');
      const { data, error } = await storage.list(prefix, { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } });
      if (error || !data) throw new Error('storage_list_failed');
      if (data.length === 0) return;
      const files: string[] = [];
      for (const entry of data) {
        if (!entry.name || entry.name.includes('/') || entry.name === '..' || entry.name === '.') throw new Error('storage_path_invalid');
        const path = `${prefix}/${entry.name}`;
        if (entry.id === null) await purge(path, depth + 1);
        else files.push(path);
      }
      if (files.length) {
        const result = await storage.remove(files);
        if (result.error) throw new Error('storage_remove_failed');
      }
      // Empty folders are virtual and vanish once their objects are removed.
    }
  }
  await purge(userId, 0);
}
