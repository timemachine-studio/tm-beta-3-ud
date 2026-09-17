/**
 * The bottom half of the Skills tab in Flight Controls: skills the user
 * installed from a directory, and finding more.
 *
 * Two directories — skills.sh and SkillsMP — searched one at a time from the
 * same box. A result installs with one press: the server fetches the
 * SKILL.md from GitHub and stores it, and the card that appears shows the
 * name and description the file itself declares, with a link to the
 * directory page it came from.
 *
 * Everything a directory returns is text a stranger wrote, so it is rendered
 * as text — no markup, and the only links are to the directory's own page.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Switch from '@radix-ui/react-switch';
import { Download, ExternalLink, Loader2, Search, Sparkles, Trash2 } from 'lucide-react';
import {
  formatPopularity,
  installSkill,
  listInstalledSkills,
  removeInstalledSkill,
  searchSkills,
  setInstalledSkillEnabled,
  type InstalledSkill,
  type SkillDirectory,
  type SkillSearchResult,
} from '../../services/flightControls/userSkillsService';

const DIRECTORIES: { id: SkillDirectory; label: string }[] = [
  { id: 'skills.sh', label: 'skills.sh' },
  { id: 'skillsmp', label: 'SkillsMP' },
];

interface UserSkillsPanelProps {
  signedIn: boolean;
}

export function UserSkillsPanel({ signedIn }: UserSkillsPanelProps) {
  const [skills, setSkills] = useState<InstalledSkill[]>([]);
  const [limit, setLimit] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [directory, setDirectory] = useState<SkillDirectory>('skills.sh');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SkillSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const searchAbort = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!signedIn) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listInstalledSkills();
      setSkills(data.skills);
      setLimit(data.limit);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your skills');
    } finally {
      setLoading(false);
    }
  }, [signedIn]);

  // Same deferral UserServersPanel uses: `load` sets state synchronously,
  // which Hooks 7 flags as a cascading render inside an effect body.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void load(); });
    return () => { cancelled = true; };
  }, [load]);

  useEffect(() => () => searchAbort.current?.abort(), []);

  const runSearch = async (source = directory) => {
    if (!query.trim()) return;
    searchAbort.current?.abort();
    const controller = new AbortController();
    searchAbort.current = controller;
    setSearching(true);
    setError(null);
    try {
      setResults(await searchSkills(source, query.trim(), controller.signal));
    } catch (searchError) {
      if (controller.signal.aborted) return;
      setError(searchError instanceof Error ? searchError.message : 'Search failed');
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  };

  const switchDirectory = (source: SkillDirectory) => {
    setDirectory(source);
    // A query already typed re-runs against the other directory.
    if (results !== null && query.trim()) void runSearch(source);
  };

  const install = async (result: SkillSearchResult) => {
    setInstallingId(result.id);
    setError(null);
    try {
      const skill = await installSkill(result);
      setSkills(current => [...current, skill]);
    } catch (installError) {
      setError(installError instanceof Error ? installError.message : 'Could not install that skill');
    } finally {
      setInstallingId(null);
    }
  };

  const toggle = async (skill: InstalledSkill, enabled: boolean) => {
    setBusyId(skill.id);
    setError(null);
    const previous = skill.enabled;
    setSkills(current => current.map(s => s.id === skill.id ? { ...s, enabled } : s));
    try {
      await setInstalledSkillEnabled(skill.id, enabled);
    } catch (toggleError) {
      setSkills(current => current.map(s => s.id === skill.id ? { ...s, enabled: previous } : s));
      setError(toggleError instanceof Error ? toggleError.message : 'Could not update that skill');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (skill: InstalledSkill) => {
    setBusyId(skill.id);
    setError(null);
    try {
      await removeInstalledSkill(skill.id);
      setSkills(current => current.filter(s => s.id !== skill.id));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove that skill');
    } finally {
      setBusyId(null);
    }
  };

  const installedIds = new Set(skills.map(skill => skill.sourceId));
  const atLimit = skills.length >= limit;

  return (
    <section className="space-y-3 border-t border-white/8 pt-5" aria-label="Your skills">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white/85">Your skills</h3>
          <p className="text-[11px] text-white/40">
            {signedIn ? `Installed from a directory. ${skills.length} of ${limit}.` : 'Sign in to install skills from skills.sh and SkillsMP.'}
          </p>
        </div>
        <div className="flex gap-1 rounded-full bg-white/5 p-0.5 ring-1 ring-white/10" role="tablist" aria-label="Skill directory">
          {DIRECTORIES.map(item => (
            <button
              key={item.id}
              role="tab"
              aria-selected={directory === item.id}
              onClick={() => switchDirectory(item.id)}
              className={`rounded-full px-3 py-1 text-[11px] transition ${directory === item.id ? 'bg-cyan-400/15 text-cyan-200' : 'text-white/50 hover:text-white/80'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={event => { event.preventDefault(); void runSearch(); }}
        className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 ring-1 ring-white/10"
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-white/40" />
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          disabled={!signedIn}
          placeholder={`Search ${directory === 'skills.sh' ? 'skills.sh' : 'SkillsMP'} — e.g. frontend design, SEO, testing`}
          aria-label={`Search ${directory}`}
          className="min-w-0 flex-1 bg-transparent text-xs text-white/85 outline-none placeholder:text-white/30 disabled:opacity-50"
        />
        {searching
          ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-white/40" />
          : (
            <button
              type="submit"
              disabled={!signedIn || !query.trim()}
              className="shrink-0 rounded-full px-2 py-0.5 text-[11px] text-white/50 transition hover:bg-white/10 hover:text-white/80 disabled:opacity-40"
            >
              Search
            </button>
          )}
      </form>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs leading-relaxed text-rose-200/90">{error}</p>
      )}

      {results && (
        <div className="space-y-2 rounded-2xl border border-white/8 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider text-white/35">
              {directory === 'skills.sh' ? 'skills.sh' : 'SkillsMP'} results
            </p>
            <button onClick={() => setResults(null)} className="text-[11px] text-white/40 hover:text-white/70">Clear</button>
          </div>
          {results.length === 0 ? (
            <p className="py-3 text-center text-xs text-white/35">Nothing matched.</p>
          ) : results.map(result => {
            const installed = installedIds.has(result.id);
            const installing = installingId === result.id;
            return (
              <div key={`${result.source}:${result.id}`} className="rounded-xl bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-xs font-semibold text-white/85">{result.name}</h4>
                  <span className="font-mono text-[10px] text-white/35">{result.repository}</span>
                  <span className="text-[10px] text-white/35">{formatPopularity(result)}</span>
                  <a
                    href={result.pageUrl} target="_blank" rel="noopener noreferrer nofollow"
                    className="flex items-center gap-1 text-[10px] text-white/35 hover:text-white/60"
                  >
                    <ExternalLink className="h-2.5 w-2.5" /> page
                  </a>
                </div>
                {result.description && (
                  <p className="mt-1 text-[11px] leading-relaxed text-white/45">{result.description}</p>
                )}
                <button
                  onClick={() => install(result)}
                  disabled={installed || installing || atLimit}
                  className="mt-2 flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 text-[11px] text-white/70 hover:bg-white/12 disabled:opacity-45"
                >
                  {installing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                  {installed ? 'Installed' : installing ? 'Fetching SKILL.md…' : 'Install'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!signedIn ? null : loading ? (
        <div className="space-y-3">{[0, 1].map(index => <div key={index} className="h-20 animate-pulse rounded-2xl bg-white/5" />)}</div>
      ) : skills.length === 0 ? (
        <p className="py-3 text-center text-xs text-white/35">Nothing installed yet. Search above to find one.</p>
      ) : (
        <div className="space-y-3">
          {skills.map(skill => (
            <div key={skill.id} className="flex items-start gap-4 rounded-2xl border border-white/8 bg-white/[0.035] p-4">
              <div className="mt-0.5 rounded-xl bg-cyan-400/10 p-2.5 text-cyan-300"><Sparkles className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-white/90">{skill.name}</h3>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/45">
                    {skill.source === 'skillsmp' ? 'SkillsMP' : skill.source}
                  </span>
                  {skill.pageUrl && (
                    <a
                      href={skill.pageUrl} target="_blank" rel="noopener noreferrer nofollow"
                      className="flex items-center gap-1 text-[10px] text-white/35 hover:text-white/60"
                    >
                      <ExternalLink className="h-2.5 w-2.5" /> page
                    </a>
                  )}
                </div>
                {skill.description && <p className="mt-1 text-xs leading-relaxed text-white/48">{skill.description}</p>}
                <p className="mt-1 text-[10px] text-white/30">{Math.round(skill.contentLength / 1000)}k characters · read on request, never pasted into every prompt</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => remove(skill)} disabled={busyId === skill.id}
                  aria-label={`Remove ${skill.name}`}
                  className="rounded-full p-1.5 text-white/35 transition hover:bg-rose-400/10 hover:text-rose-300 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <Switch.Root
                  checked={skill.enabled} disabled={busyId === skill.id}
                  onCheckedChange={enabled => toggle(skill, enabled)}
                  aria-label={`${skill.enabled ? 'Disable' : 'Enable'} ${skill.name}`}
                  className="relative h-6 w-11 rounded-full bg-white/10 transition data-[state=checked]:bg-cyan-400/45 disabled:opacity-45"
                >
                  <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[22px]" />
                </Switch.Root>
              </div>
            </div>
          ))}
        </div>
      )}

    </section>
  );
}
