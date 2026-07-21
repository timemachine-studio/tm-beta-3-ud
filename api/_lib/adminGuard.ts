import type { VercelRequest } from '@vercel/node';
import { getAuthenticatedRequestUser, type AuthenticatedRequestUser } from './auth.js';

export interface AdminUser extends AuthenticatedRequestUser {
  email: string;
}

function adminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || '';
  return new Set(
    raw
      .split(/[\s,;]+/)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isConfiguredAdminEmail(email: string): boolean {
  const set = adminEmails();
  if (set.size === 0) return false;
  return set.has(email.trim().toLowerCase());
}

export async function resolveAdminUser(req: VercelRequest): Promise<AdminUser | null> {
  const user = await getAuthenticatedRequestUser(req);
  if (!user || !user.email) return null;
  if (!isConfiguredAdminEmail(user.email)) return null;
  return { id: user.id, email: user.email };
}