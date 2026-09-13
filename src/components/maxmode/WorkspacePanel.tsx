import { PublicationApproval } from './PublicationApproval';
/**
 * The workspace half of the Max Mode screen.
 *
 * Files (tree + editor), Preview and Terminal tabs over the chat's own
 * workspace, with GitHub, zip import/export and reset along the top. The
 * harness works the same store the editor does, so an edit the model makes
 * appears in the tree and in an open editor as it lands; the panel is a view
 * of the workspace, not a copy of it.
 *
 * Tabs follow the work: a preview the harness opens switches to Preview, a
 * command it runs switches to Terminal, and a file it edits opens in the
 * editor — unless the user has pinned a tab by clicking one themselves.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Eye, FolderTree, FolderGit2, Loader2, RotateCcw, TerminalSquare, Upload, X } from 'lucide-react';
import { MAX_MODE_LABELS, type MaxModeKind } from '../../../shared/maxMode';
import { useAuth } from '../../context/AuthContext';
import {
  clearWorkspace,
  exportWorkspaceZip,
  getWorkspaceMeta,
  importWorkspaceZip,
  subscribeWorkspace,
  type WorkspaceMeta,
} from '../../services/workspace/workspaceStore';
import { previewController } from '../../services/workspace/previewController';
import { nodeRuntime, nodeRuntimeSupported } from '../../services/workspace/nodeRuntime';
import { useWorkspaceFiles } from './useWorkspaceFiles';
import { FileTree } from './FileTree';
import { CodeEditor } from './CodeEditor';
import { PreviewPane } from './PreviewPane';
import { TerminalPane } from './TerminalPane';
import { GithubPanel } from './GithubPanel';

type Tab = 'files' | 'preview' | 'terminal';

const EMPTY_PATHS: ReadonlySet<string> = new Set();

interface WorkspacePanelProps {
  sessionId: string;
  mode: MaxModeKind | null;
  isGenerating: boolean;
  onResume: () => Promise<void>;
  className?: string;
  onBackToChat: () => void;
}

export function WorkspacePanel({ sessionId, mode, isGenerating, onResume, className, onBackToChat }: WorkspacePanelProps) {
  const { user } = useAuth();
  const { entries, error: filesError, refresh } = useWorkspaceFiles(sessionId);
  const [tab, setTab] = useState<Tab>('files');
  const pinnedRef = useRef(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [meta, setMeta] = useState<WorkspaceMeta | null>(null);
  const [showGithub, setShowGithub] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Paths the harness touched, tagged with the turn they belong to so a new
  // turn starts a fresh set without an effect having to clear the old one.
  const turnRef = useRef(0);
  const [recent, setRecent] = useState<{ turn: number; paths: Set<string> }>({ turn: 0, paths: new Set() });
  const importRef = useRef<HTMLInputElement>(null);

  const loadMeta = useCallback(() => {
    getWorkspaceMeta(sessionId).then(setMeta).catch(() => setMeta(null));
  }, [sessionId]);
  useEffect(loadMeta, [loadMeta, isGenerating]);

  // Follow the harness: a file it writes opens, and gets a dot in the tree
  // for the rest of the turn.
  useEffect(() => { if (isGenerating) turnRef.current += 1; }, [isGenerating]);
  useEffect(() => subscribeWorkspace((changedSession, path) => {
    if (changedSession !== sessionId || !path) return;
    setRecent(previous => previous.turn === turnRef.current
      ? { turn: previous.turn, paths: new Set(previous.paths).add(path) }
      : { turn: turnRef.current, paths: new Set([path]) });
    if (!pinnedRef.current) {
      setSelectedPath(path);
      setTab('files');
    }
  }), [sessionId]);
  const activePaths = isGenerating ? recent.paths : EMPTY_PATHS;

  // A preview always comes to the front, pinned tab or not: open_preview
  // exists to show the user something, and its console is only captured
  // while the frame is mounted.
  useEffect(() => previewController.subscribe((target) => {
    if (target && target.sessionId === sessionId) setTab('preview');
  }), [sessionId]);
  useEffect(() => {
    if (!nodeRuntimeSupported()) return;
    return nodeRuntime().onOutput((_chunk, source) => {
      if (source === 'command' && !pinnedRef.current) setTab('terminal');
    });
  }, []);

  // A file the user selected that has since been deleted shows nothing.
  const openPath = selectedPath && entries.some(entry => entry.path === selectedPath) ? selectedPath : null;

  const choose = (next: Tab) => { pinnedRef.current = true; setTab(next); };

  const exportZip = async () => {
    setBusy('export');
    try {
      const bytes = await exportWorkspaceZip(sessionId);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${meta?.repo?.name ?? 'workspace'}.zip`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Export failed.');
    } finally {
      setBusy(null);
    }
  };

  const importZip = async (file: File) => {
    setBusy('import');
    try {
      const result = await importWorkspaceZip(sessionId, new Uint8Array(await file.arrayBuffer()));
      setNotice(`Imported ${result.written.length} file${result.written.length === 1 ? '' : 's'}${result.skipped.length ? `, skipped ${result.skipped.length}` : ''}.`);
      refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Import failed.');
    } finally {
      setBusy(null);
      if (importRef.current) importRef.current.value = '';
    }
  };

  const reset = async () => {
    if (!window.confirm('Delete every file in this workspace? This cannot be undone.')) return;
    setBusy('reset');
    try {
      await clearWorkspace(sessionId);
      previewController.clear();
      setSelectedPath(null);
      loadMeta();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Reset failed.');
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6_000);
    return () => clearTimeout(timer);
  }, [notice]);

  const title = useMemo(() => meta?.repo ? `${meta.repo.owner}/${meta.repo.name}` : 'Workspace', [meta]);

  const tabs: Array<{ id: Tab; label: string; icon: typeof FolderTree }> = [
    { id: 'files', label: 'Files', icon: FolderTree },
    { id: 'preview', label: 'Preview', icon: Eye },
    { id: 'terminal', label: 'Terminal', icon: TerminalSquare },
  ];

  return (
    <aside className={`relative flex-col border-l border-white/10 bg-black/20 backdrop-blur-xl ${className ?? ''}`} aria-label="Workspace">
      <PublicationApproval sessionId={sessionId} />
      <header className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <button type="button" onClick={onBackToChat} className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 text-white/60" aria-label="Back to chat">
          <X className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-white/90 truncate">{title}</div>
          <div className="text-[11px] text-white/40">
            {mode ? `${MAX_MODE_LABELS[mode].name} mode` : 'Max Mode'} · {entries.length} file{entries.length === 1 ? '' : 's'}
            {meta?.repo ? ` · ${meta.repo.branch}` : ''}
          </div>
        </div>
        <button type="button" onClick={() => setShowGithub(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs bg-white/5 border border-white/10 hover:bg-white/10 text-white/80" title="GitHub">
          <FolderGit2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{meta?.repo ? 'Pull request' : 'GitHub'}</span>
        </button>
        <button type="button" onClick={() => importRef.current?.click()} disabled={!!busy || isGenerating} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 disabled:opacity-40" title="Import a zip" aria-label="Import a zip">
          {busy === 'import' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        </button>
        <input ref={importRef} type="file" accept=".zip,application/zip" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) importZip(file); }} />
        <button type="button" onClick={exportZip} disabled={!!busy || isGenerating || entries.length === 0} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 disabled:opacity-40" title="Download as zip" aria-label="Download as zip">
          {busy === 'export' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        </button>
        <button type="button" onClick={reset} disabled={!!busy || isGenerating || entries.length === 0} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 disabled:opacity-40" title="Reset the workspace" aria-label="Reset the workspace">
          <RotateCcw className="w-4 h-4" />
        </button>
      </header>

      <nav className="flex items-center gap-1 px-2 py-1.5 border-b border-white/10" aria-label="Workspace tabs">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => choose(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${tab === id ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5'}`}
            aria-current={tab === id ? 'page' : undefined}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </nav>

      {meta?.resume && !isGenerating && (
        <div className="border-b border-white/10 px-3 py-2 text-xs text-white/70">
          <p className="mb-2 truncate">Saved task: {meta.resume.userContent}</p>
          <button type="button" disabled={busy === 'resume'} className="rounded-lg border border-cyan-400/30 bg-cyan-500/15 px-3 py-1.5 text-cyan-100 disabled:opacity-50"
            onClick={async () => {
              setBusy('resume');
              try { await onResume(); }
              catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Could not resume the saved task.'); }
              finally { setBusy(null); loadMeta(); }
            }}>
            Resume {meta.resume.mode ? MAX_MODE_LABELS[meta.resume.mode].name : ''} task
          </button>
        </div>
      )}

      {(notice || filesError) && (
        <div className="px-3 py-1.5 text-xs border-b border-white/10 text-amber-200/90">{filesError ?? notice}</div>
      )}

      <div className="flex-1 min-h-0 relative">
        {tab === 'files' && (
          <div className="h-full flex min-h-0">
            <div className="w-52 xl:w-60 shrink-0 border-r border-white/10 overflow-y-auto">
              <FileTree entries={entries} selectedPath={openPath} onSelect={path => { setSelectedPath(path); }} activePaths={activePaths} />
            </div>
            <div className="flex-1 min-w-0 min-h-0">
              {openPath
                ? <CodeEditor key={`${sessionId}:${openPath}`} sessionId={sessionId} path={openPath} />
                : <div className="h-full flex items-center justify-center text-sm text-white/30">Select a file to open it.</div>}
            </div>
          </div>
        )}
        {tab === 'preview' && <PreviewPane />}
        {tab === 'terminal' && <TerminalPane sessionId={sessionId} />}

        {showGithub && (
          <GithubPanel
            sessionId={sessionId}
            meta={meta}
            signedIn={!!user}
            onClose={() => setShowGithub(false)}
            onChanged={() => { loadMeta(); refresh(); }}
          />
        )}
      </div>
    </aside>
  );
}
