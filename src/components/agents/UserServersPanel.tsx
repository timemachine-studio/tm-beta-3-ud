/**
 * The "Your servers" tab of Flight Controls.
 *
 * Three things happen here: adding an MCP server by URL, finding one in the
 * public registry, and turning the ones you have on and off.
 *
 * Everything the registry returns is text a stranger wrote, so it is rendered
 * as text — no markup, no links that are not the repository URL, and the
 * server URL is shown so a user can see where they are about to send a token.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Switch from '@radix-ui/react-switch';
import { ExternalLink, KeyRound, Loader2, Plus, Search, Server, Trash2, X } from 'lucide-react';
import {
  addUserMcpServer,
  listUserMcpServers,
  removeUserMcpServer,
  searchMcpRegistry,
  updateUserMcpServer,
  type RegistryServerResult,
  type UserMcpServer,
} from '../../services/flightControls/userMcpService';

interface UserServersPanelProps {
  /** Disables everything and explains why, rather than failing on submit. */
  signedIn: boolean;
}

export function UserServersPanel({ signedIn }: UserServersPanelProps) {
  const [servers, setServers] = useState<UserMcpServer[]>([]);
  const [credentialsSupported, setCredentialsSupported] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [adding, setAdding] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RegistryServerResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchAbort = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!signedIn) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listUserMcpServers();
      setServers(data.servers);
      setCredentialsSupported(data.credentialsSupported);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your servers');
    } finally {
      setLoading(false);
    }
  }, [signedIn]);

  // Deferred to a microtask rather than called in the effect body: `load`
  // sets state synchronously, which Hooks 7 flags as a cascading render. Same
  // pattern AgentsModal already uses for the same reason.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void load(); });
    return () => { cancelled = true; };
  }, [load]);

  // Abort an in-flight search when the component goes away, so a late reply
  // cannot set state on an unmounted panel.
  useEffect(() => () => searchAbort.current?.abort(), []);

  const runSearch = async () => {
    searchAbort.current?.abort();
    const controller = new AbortController();
    searchAbort.current = controller;
    setSearching(true);
    setError(null);
    try {
      setResults(await searchMcpRegistry(query, controller.signal));
    } catch (searchError) {
      if (controller.signal.aborted) return;
      setError(searchError instanceof Error ? searchError.message : 'Search failed');
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  };

  const submitAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (adding) return;
    setAdding(true);
    setError(null);
    try {
      const server = await addUserMcpServer({
        name: name.trim(),
        serverUrl: url.trim(),
        ...(token.trim() ? { bearerToken: token.trim() } : {}),
      });
      setServers(current => [...current, server]);
      setName(''); setUrl(''); setToken(''); setShowAdd(false);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Could not add that server');
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (server: UserMcpServer, enabled: boolean) => {
    setBusyId(server.id);
    setError(null);
    const previous = server.enabled;
    setServers(current => current.map(s => s.id === server.id ? { ...s, enabled } : s));
    try {
      await updateUserMcpServer(server.id, { enabled });
    } catch (toggleError) {
      setServers(current => current.map(s => s.id === server.id ? { ...s, enabled: previous } : s));
      setError(toggleError instanceof Error ? toggleError.message : 'Could not update that server');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (server: UserMcpServer) => {
    setBusyId(server.id);
    setError(null);
    try {
      await removeUserMcpServer(server.id);
      setServers(current => current.filter(s => s.id !== server.id));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove that server');
    } finally {
      setBusyId(null);
    }
  };

  if (!signedIn) {
    return (
      <div className="flex min-h-[230px] items-center justify-center text-center text-sm text-white/45">
        Sign in to add your own MCP servers.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowAdd(value => !value)}
          className="flex items-center gap-1.5 rounded-full bg-cyan-300/15 px-3.5 py-1.5 text-xs text-cyan-100 ring-1 ring-cyan-200/20 hover:bg-cyan-300/20"
        >
          {showAdd ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showAdd ? 'Cancel' : 'Add a server'}
        </button>
        {/* A form, not a bare input: Enter inside a Radix dialog does not reach
            a keydown handler reliably, and a submit button is what makes the
            search discoverable anyway. */}
        <form
          onSubmit={event => { event.preventDefault(); void runSearch(); }}
          className="flex flex-1 items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 ring-1 ring-white/10"
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-white/40" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search the public MCP registry"
            aria-label="Search the public MCP registry"
            className="min-w-0 flex-1 bg-transparent text-xs text-white/85 outline-none placeholder:text-white/30"
          />
          {searching
            ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-white/40" />
            : (
              <button
                type="submit"
                className="shrink-0 rounded-full px-2 py-0.5 text-[11px] text-white/50 transition hover:bg-white/10 hover:text-white/80"
              >
                Search
              </button>
            )}
        </form>
      </div>

      {showAdd && (
        <form onSubmit={submitAdd} className="space-y-2.5 rounded-2xl border border-white/8 bg-white/[0.035] p-4">
          <input
            value={name} onChange={event => setName(event.target.value)} required maxLength={80}
            placeholder="Name" aria-label="Server name"
            className="w-full rounded-lg bg-white/5 px-3 py-2 text-xs text-white/85 outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-cyan-300/30"
          />
          <input
            value={url} onChange={event => setUrl(event.target.value)} required type="url" inputMode="url"
            placeholder="https://example.com/mcp" aria-label="Server URL"
            className="w-full rounded-lg bg-white/5 px-3 py-2 text-xs text-white/85 outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-cyan-300/30"
          />
          {credentialsSupported ? (
            <input
              value={token} onChange={event => setToken(event.target.value)} type="password"
              autoComplete="off" maxLength={4000}
              placeholder="Bearer token (optional)" aria-label="Bearer token, optional"
              className="w-full rounded-lg bg-white/5 px-3 py-2 text-xs text-white/85 outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-cyan-300/30"
            />
          ) : (
            <p className="text-[11px] text-amber-200/70">
              This deployment cannot store credentials yet, so only servers that need no token can be added.
            </p>
          )}
          <p className="text-[11px] leading-relaxed text-white/40">
            TimeMachine connects once to list the server&rsquo;s tools. Those become the only tools it may ever
            offer, and each one asks before it runs.
          </p>
          <button
            type="submit" disabled={adding}
            className="flex items-center gap-1.5 rounded-full bg-cyan-300/15 px-3.5 py-1.5 text-xs text-cyan-100 ring-1 ring-cyan-200/20 hover:bg-cyan-300/20 disabled:opacity-50"
          >
            {adding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {adding ? 'Connecting…' : 'Add server'}
          </button>
        </form>
      )}

      {results && (
        <div className="space-y-2 rounded-2xl border border-white/8 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider text-white/35">Registry results</p>
            <button onClick={() => setResults(null)} className="text-[11px] text-white/40 hover:text-white/70">Clear</button>
          </div>
          {results.length === 0 ? (
            <p className="py-3 text-center text-xs text-white/35">Nothing matched, or the matches need a local install.</p>
          ) : results.map(result => (
            <div key={result.name} className="rounded-xl bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-xs font-semibold text-white/85">{result.title}</h4>
                {result.requiresAuth && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-300/10 px-1.5 py-0.5 text-[10px] text-amber-200/80">
                    <KeyRound className="h-2.5 w-2.5" /> token needed
                  </span>
                )}
                {result.repositoryUrl && (
                  <a
                    href={result.repositoryUrl} target="_blank" rel="noopener noreferrer nofollow"
                    className="flex items-center gap-1 text-[10px] text-white/35 hover:text-white/60"
                  >
                    <ExternalLink className="h-2.5 w-2.5" /> source
                  </a>
                )}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-white/45">{result.description}</p>
              <p className="mt-1 break-all font-mono text-[10px] text-white/30">{result.remoteUrl}</p>
              <button
                onClick={() => {
                  setName(result.title);
                  setUrl(result.remoteUrl || '');
                  setShowAdd(true);
                }}
                className="mt-2 rounded-full bg-white/8 px-3 py-1 text-[11px] text-white/70 hover:bg-white/12"
              >
                Use this one
              </button>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[0, 1].map(index => <div key={index} className="h-20 animate-pulse rounded-2xl bg-white/5" />)}</div>
      ) : servers.length === 0 ? (
        <div className="flex min-h-[140px] items-center justify-center text-center text-xs text-white/35">
          You haven&rsquo;t added any servers yet.
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map(server => (
            <div key={server.id} className="flex items-start gap-4 rounded-2xl border border-white/8 bg-white/[0.035] p-4">
              <div className="mt-0.5 rounded-xl bg-violet-400/10 p-2.5 text-violet-300"><Server className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-white/90">{server.name}</h3>
                  <span className="text-[10px] text-white/35">
                    {server.allowedTools.length} tool{server.allowedTools.length === 1 ? '' : 's'}
                  </span>
                  {server.hasCredential && (
                    <span className="flex items-center gap-1 text-[10px] text-white/35">
                      <KeyRound className="h-2.5 w-2.5" /> token stored
                    </span>
                  )}
                </div>
                <p className="mt-1 break-all font-mono text-[10px] text-white/30">{server.serverUrl}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => remove(server)} disabled={busyId === server.id}
                  aria-label={`Remove ${server.name}`}
                  className="rounded-full p-1.5 text-white/35 transition hover:bg-rose-400/10 hover:text-rose-300 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <Switch.Root
                  checked={server.enabled} disabled={busyId === server.id}
                  onCheckedChange={enabled => toggle(server, enabled)}
                  aria-label={`${server.enabled ? 'Disable' : 'Enable'} ${server.name}`}
                  className="relative h-6 w-11 rounded-full bg-white/10 transition data-[state=checked]:bg-cyan-400/45 disabled:opacity-45"
                >
                  <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[22px]" />
                </Switch.Root>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-center text-xs text-rose-300/80">{error}</p>}
    </div>
  );
}
