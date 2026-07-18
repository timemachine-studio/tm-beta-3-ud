import type { VercelRequest } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://etpehiyzlkhknzceizar.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

export interface AuthenticatedRequestUser {
  id: string;
  email?: string;
}

export async function getAuthenticatedRequestUser(req: VercelRequest): Promise<AuthenticatedRequestUser | null> {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ') || !supabaseAnonKey) return null;

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) return null;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;

  return { id: data.user.id, email: data.user.email };
}
