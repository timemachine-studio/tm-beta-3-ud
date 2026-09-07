import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';
import { cleanupProcessingData } from './_lib/retention/cleanup.js';

// Configure a platform scheduler only after staging cleanup is verified. No
// schedule is silently installed and this endpoint defaults to disabled.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const secret = process.env.RETENTION_CLEANUP_SECRET;
  const expected = Buffer.from(`Bearer ${secret ?? ''}`);
  const supplied = Buffer.from(typeof req.headers.authorization === 'string' ? req.headers.authorization : '');
  if (!secret || secret.length < 32 || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (process.env.RETENTION_CLEANUP_ENABLED !== 'true') return res.status(503).json({ error: 'Cleanup is not enabled in this environment' });
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: 'Cleanup storage is not configured' });
  try {
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    await cleanupProcessingData(client);
    return res.status(200).json({ completed: true });
  } catch {
    console.error('retention_cleanup_failed');
    return res.status(503).json({ error: 'Cleanup failed; retry and alert the operator' });
  }
}
