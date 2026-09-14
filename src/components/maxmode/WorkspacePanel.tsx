/**
 * The workspace half of the Max Mode screen: one rounded glass card, like
 * every other surface in the app.
 *
 * Files (tree + editor), Preview and Terminal tabs over the chat's own
 * workspace, with GitHub, zip import/export and reset along the top. The
 * harness works the same store the editor does, so an edit the model makes
 * appears in the tree and in an open editor as it lands; the panel is a view
 * of the workspace, not a copy of it.
 *
 * The card's width and the tree/editor split are both draggable and
 * remembered per browser. The card can also be collapsed; the header's
 * workspace pill brings it back. Collapsing hides rather than unmounts it —
 * the preview's console is only captured while its frame is mounted.
 *
 * Tabs follow the work: a preview the harness opens switches to Preview, a
 * command it runs switches to Terminal, and a file it edits opens in the
 * editor — unless the user has pinned a tab by clicking one themselves.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Download, Eye, FolderTree, FolderGit2, Loader2, PanelRightClose, RotateCcw, TerminalSquare, Upload } from 'lucide-react';
import { MAX_MODE_LABELS } from '../../../shared/maxMode';
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
import { PublicationApproval } from './PublicationApproval';
import { GlassPill, ResizeHandle } from './glass';
import { glassCardStyle, glassPillStyle } from './glassStyles';
import { useResizable } from './useResizable';

type Tab = 'files' | 'preview' | 'terminal';

const EMPTY_PATHS: ReadonlySet<string> = new Set();

/** The chat keeps at least this much of the window; the card takes the rest. */
const CHAT_MIN_WIDTH = 420;
const PANEL_MIN_WIDTH = 360;
const TREE_MIN_WIDTH = 140;
const TREE_MAX_WIDTH = 480;

const panelCeiling = () => window.innerWidth - CHAT_MIN_WIDTH;

interface WorkspacePanelProps {
  sessionId: string;
  isGenerating: boolean;
  onResume: () => Promise<void>;
  className?: string;
  onCollapse: () => void;
}

export function WorkspacePanel({ sessionId, isGenerating, onResume, className, onCollapse }: WorkspacePanelProps) {
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

  const panel = useResizable({ storageKey: 'maxModePanelWidth', fallback: 720, min: PANEL_MIN_WIDTH, max: panelCeiling, invert: true });
  const tree = useResizable({ storageKey: 'maxModeTreeWidth', fallback: 220, min: TREE_MIN_WIDTH, max: TREE_MAX_WIDTH });

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
  // exists to show the user something. A remembered one (a reload, or the
  // chat reopened) is put back first; a stale dev server stays where it is
  // rather than pulling the user off the files they came for.
  useEffect(() => previewController.subscribe((target) => {
    if (target && target.sessionId === sessionId && target.kind !== 'stale') setTab('preview');
  }), [sessionId]);
  useEffect(() => { void previewController.restore(sessionId); }, [sessionId]);
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

  const tabs: Array<{ id: Tab; label: string; icon: typeof FolderTree }> = [
    { id: 'files', label: 'Files', icon: FolderTree },
    { id: 'preview', label: 'Preview', icon: Eye },
    { id: 'terminal', label: 'Terminal', icon: TerminalSquare },
  ];

  return (
    <div
      className={`relative h-full shrink-0 w-full lg:w-(--ws-w) p-2 lg:py-3 lg:pr-3 lg:pl-1 ${className ?? ''}`}
      style={{ '--ws-w': `${panel.width}px` } as CSSProperties}
    >
      <ResizeHandle handleProps={panel.handleProps} label="Resize the workspace" edge="left" className="hidden lg:block" />
      <aside className="@container relative flex h-full flex-col overflow-hidden rounded-3xl" style={glassCardStyle} aria-label="Workspace">
        <PublicationApproval sessionId={sessionId} />
        <header className="flex items-center gap-2 px-3 py-2.5">
          <GlassPill onClick={onCollapse} className="h-8 w-8" aria-label="Hide the workspace" title="Hide the workspace">
            <PanelRightClose className="w-4 h-4" />
          </GlassPill>

          <nav className="flex items-center gap-0.5 p-1" style={glassPillStyle()} aria-label="Workspace tabs">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => choose(id)}
                className={`flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors ${tab === id ? 'bg-white/15 text-white shadow-[inset_0_1px_0_rgb(var(--tm-edge-rgb)/0.15)]' : 'text-white/55 hover:text-white/85'}`}
                aria-current={tab === id ? 'page' : undefined}
                title={label}
              >
                <Icon className="w-3.5 h-3.5" /> <span className="hidden @lg:inline">{label}</span>
              </button>
            ))}
          </nav>

          <div className="flex-1" />

          <GlassPill onClick={() => setShowGithub(true)} className="h-8 max-w-48 px-3" title={meta?.repo ? `${meta.repo.owner}/${meta.repo.name} · ${meta.repo.branch}` : 'GitHub'}>
            <FolderGit2 className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden @2xl:inline truncate">{meta?.repo ? meta.repo.name : 'GitHub'}</span>
          </GlassPill>
          <GlassPill onClick={() => importRef.current?.click()} disabled={!!busy || isGenerating} className="h-8 w-8" title="Import a zip" aria-label="Import a zip">
            {busy === 'import' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          </GlassPill>
          <input ref={importRef} type="file" accept=".zip,application/zip" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) importZip(file); }} />
          <GlassPill onClick={exportZip} disabled={!!busy || isGenerating || entries.length === 0} className="h-8 w-8" title="Download as zip" aria-label="Download as zip">
            {busy === 'export' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          </GlassPill>
          <GlassPill onClick={reset} disabled={!!busy || isGenerating || entries.length === 0} className="h-8 w-8" title="Reset the workspace" aria-label="Reset the workspace">
            <RotateCcw className="w-4 h-4" />
          </GlassPill>
        </header>

        {meta?.resume && !isGenerating && (
          <div className="mx-3 mb-2 flex items-center gap-3 rounded-2xl px-3 py-2 text-xs text-white/70" style={glassPillStyle()}>
            <p className="min-w-0 flex-1 truncate">Saved task: {meta.resume.userContent}</p>
            <GlassPill tone="accent" disabled={busy === 'resume'} className="h-7 px-3"
              onClick={async () => {
                setBusy('resume');
                try { await onResume(); }
                catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Could not resume the saved task.'); }
                finally { setBusy(null); loadMeta(); }
              }}>
              Resume {meta.resume.mode ? MAX_MODE_LABELS[meta.resume.mode].name : ''} task
            </GlassPill>
          </div>
        )}

        {(notice || filesError) && (
          <div className="mx-3 mb-2 rounded-2xl px-3 py-1.5 text-xs text-amber-200/90" style={glassPillStyle()}>{filesError ?? notice}</div>
        )}

        {/* Every tab stays mounted: the terminal keeps its shell and scrollback
            across a switch, and the preview frame keeps running. */}
        <div className="relative min-h-0 flex-1 border-t border-white/[0.06]">
          <div className={`h-full ${tab === 'files' ? '' : 'hidden'}`}>
            <div className="flex h-full min-h-0">
              <div className="shrink-0 overflow-y-auto w-(--tree-w)" style={{ '--tree-w': `${tree.width}px` } as CSSProperties}>
                <FileTree entries={entries} selectedPath={openPath} onSelect={path => { setSelectedPath(path); }} activePaths={activePaths} />
              </div>
              <div className="relative w-px shrink-0 bg-white/[0.06]">
                <ResizeHandle handleProps={tree.handleProps} label="Resize the file tree" edge="left" />
              </div>
              <div className="min-w-0 min-h-0 flex-1">
                {openPath
                  ? <CodeEditor key={`${sessionId}:${openPath}`} sessionId={sessionId} path={openPath} />
                  : <div className="flex h-full items-center justify-center text-sm text-white/30">Select a file to open it.</div>}
              </div>
            </div>
          </div>
          <div className={`h-full ${tab === 'preview' ? '' : 'hidden'}`}><PreviewPane sessionId={sessionId} /></div>
          <div className={`h-full ${tab === 'terminal' ? '' : 'hidden'}`}><TerminalPane sessionId={sessionId} active={tab === 'terminal'} /></div>

          {showGithub && (
            <GithubPanel
              sessionId={sessionId}
              meta={meta}
              fileCount={entries.length}
              signedIn={!!user}
              onClose={() => setShowGithub(false)}
              onChanged={() => { loadMeta(); refresh(); }}
            />
          )}
        </div>
      </aside>
    </div>
  );
}
