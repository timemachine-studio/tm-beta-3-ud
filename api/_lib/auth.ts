import type { VercelRequest } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrlFromEnv = process.env.VITE_SUPABASE_URL;
if (!supabaseUrlFromEnv) {
  // Fail fast rather than falling back to a hardcoded project URL: a stale
  // fallback silently points production at the wrong database.
  throw new Error('VITE_SUPABASE_URL is not set.');
}
const supabaseUrl: string = supabaseUrlFromEnv;
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

/** The raw bearer token, or null when the request carries none. */
export function getRequestAccessToken(req: VercelRequest): string | null {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  return token || null;
}

/**
 * A Supabase client that acts *as the user*, so Row Level Security applies.
 *
 * Prefer this over the service-role client for anything user-scoped: the
 * service-role key bypasses RLS entirely, which is what turned a client-supplied
 * userId into a cross-user read (production-check.md 0.2).
 */
export function createUserScopedClient(accessToken: string): SupabaseClient | null {
  if (!supabaseAnonKey) return null;
  return createClient(supabaseUrl as string, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/**
 * Guard against a user id that did not come from the verified token.
 * Throws rather than returning false: there is no safe way to continue.
 */
export function assertOwnUserId(requestedUserId: string, authenticatedUserId: string | null): void {
  if (!authenticatedUserId || requestedUserId !== authenticatedUserId) {
    throw new Error('user_id_mismatch: refusing to read data for a different user');
  }
}
