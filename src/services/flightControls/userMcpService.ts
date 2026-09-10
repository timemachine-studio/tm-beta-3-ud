/**
 * The user's own MCP servers, and searching the public registry for more.
 *
 * Both go through API routes rather than Supabase directly, because
 * `user_mcp_servers` deliberately has no browser policies — a policy granting
 * row access would grant access to the encrypted credential column with it.
 * Nothing here ever receives a token back; `hasCredential` is all the client
 * is told.
 */

import { supabase } from '../../lib/supabase';

export interface UserMcpServer {
  id: string;
  slug: string;
  name: string;
  description: string;
  serverUrl: string;
  /** Whether a credential is stored. Never the credential itself. */
  hasCredential: boolean;
  allowedTools: string[];
  autoApproveTools: string[];
  enabled: boolean;
  createdAt: string;
}

export interface RegistryServerResult {
  name: string;
  title: string;
  description: string;
  version: string;
  remoteUrl: string | null;
  requiresAuth: boolean;
  repositoryUrl: string | null;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
  };
}

/** Read the API's own error message, which is written to be shown to a user. */
async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return body?.error?.message || body?.error || fallback;
  } catch {
    return fallback;
  }
}

export async function listUserMcpServers(): Promise<{ servers: UserMcpServer[]; credentialsSupported: boolean }> {
  const response = await fetch('/api/mcp-servers', { headers: await authHeaders() });
  if (!response.ok) throw new Error(await readError(response, 'Could not load your servers'));
  return response.json();
}

export interface AddUserMcpServerInput {
  name: string;
  serverUrl: string;
  description?: string;
  /** Sent once. Encrypted server-side and never returned. */
  bearerToken?: string;
  autoApproveTools?: string[];
}

export async function addUserMcpServer(input: AddUserMcpServerInput): Promise<UserMcpServer> {
  const response = await fetch('/api/mcp-servers', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await readError(response, 'Could not add that server'));
  return (await response.json()).server;
}

export async function updateUserMcpServer(
  id: string,
  changes: { enabled?: boolean; autoApproveTools?: string[] },
): Promise<UserMcpServer> {
  const response = await fetch('/api/mcp-servers', {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ id, ...changes }),
  });
  if (!response.ok) throw new Error(await readError(response, 'Could not update that server'));
  return (await response.json()).server;
}

export async function removeUserMcpServer(id: string): Promise<void> {
  const response = await fetch('/api/mcp-servers', {
    method: 'DELETE',
    headers: await authHeaders(),
    body: JSON.stringify({ id }),
  });
  if (!response.ok) throw new Error(await readError(response, 'Could not remove that server'));
}

/**
 * Search the public MCP registry.
 *
 * Results are written by whoever published each server: treat every field as
 * untrusted text, and never render a description as markup.
 */
export async function searchMcpRegistry(query: string, signal?: AbortSignal): Promise<RegistryServerResult[]> {
  // Same route as the server list: registry search is a sub-action of
  // /api/mcp-servers so the two capabilities cost one Vercel Function.
  const params = new URLSearchParams({ discover: query.trim() });
  const response = await fetch(`/api/mcp-servers?${params}`, { headers: await authHeaders(), signal });
  if (!response.ok) throw new Error(await readError(response, 'The registry could not be reached'));
  return (await response.json()).servers ?? [];
}
