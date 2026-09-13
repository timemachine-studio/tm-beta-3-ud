import { memo, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, File, FileCode2, FileImage, FileJson, FileText, Folder, FolderOpen } from 'lucide-react';
import type { WorkspaceEntry } from '../../services/workspace/workspaceStore';

interface TreeNode {
  name: string;
  path: string;
  children?: TreeNode[];
  entry?: WorkspaceEntry;
}

function buildTree(entries: readonly WorkspaceEntry[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', children: [] };
  for (const entry of entries) {
    const parts = entry.path.split('/');
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const path = parts.slice(0, i + 1).join('/');
      const last = i === parts.length - 1;
      node.children ??= [];
      let child = node.children.find(candidate => candidate.name === name);
      if (!child) {
        child = last ? { name, path, entry } : { name, path, children: [] };
        node.children.push(child);
      }
      node = child;
    }
  }
  const sort = (nodes: TreeNode[]): TreeNode[] => nodes
    .sort((a, b) => (Number(!!b.children) - Number(!!a.children)) || a.name.localeCompare(b.name))
    .map(node => (node.children ? { ...node, children: sort(node.children) } : node));
  return sort(root.children ?? []);
}

function FileIcon({ name, className }: { name: string; className: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(ext)) return <FileImage className={className} />;
  if (ext === 'json') return <FileJson className={className} />;
  if (['md', 'txt', 'mdx'].includes(ext)) return <FileText className={className} />;
  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'html', 'css', 'scss', 'vue', 'svelte', 'rs', 'go', 'java', 'rb', 'sh', 'yml', 'yaml', 'toml'].includes(ext)) return <FileCode2 className={className} />;
  return <File className={className} />;
}

interface FileTreeProps {
  entries: readonly WorkspaceEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  /** Paths the harness touched this turn, highlighted so the user can follow. */
  activePaths?: ReadonlySet<string>;
}

function Row({ node, depth, selectedPath, onSelect, activePaths, openDirs, toggle }: {
  node: TreeNode; depth: number; selectedPath: string | null; onSelect: (path: string) => void;
  activePaths?: ReadonlySet<string>; openDirs: Set<string>; toggle: (path: string) => void;
}) {
  const isDir = !!node.children;
  const open = isDir && (openDirs.has(node.path) || depth === 0 && !openDirs.has(`!${node.path}`));
  const selected = node.path === selectedPath;
  const active = activePaths?.has(node.path);
  return (
    <>
      <button
        type="button"
        onClick={() => (isDir ? toggle(node.path) : onSelect(node.path))}
        className={`w-full flex items-center gap-1.5 pr-2 py-[3px] text-left text-[13px] rounded-md transition-colors ${selected ? 'bg-cyan-500/15 text-cyan-200' : active ? 'text-cyan-200/90 hover:bg-white/5' : 'text-white/75 hover:bg-white/5'}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        title={node.path}
      >
        {isDir
          ? (open ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-white/40" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-white/40" />)
          : <span className="w-3.5 shrink-0" />}
        {isDir
          ? (open ? <FolderOpen className="w-3.5 h-3.5 shrink-0 text-amber-200/70" /> : <Folder className="w-3.5 h-3.5 shrink-0 text-amber-200/70" />)
          : <FileIcon name={node.name} className="w-3.5 h-3.5 shrink-0 text-white/40" />}
        <span className="truncate">{node.name}</span>
        {active && !isDir && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />}
      </button>
      {isDir && open && node.children!.map(child => (
        <Row key={child.path} node={child} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} activePaths={activePaths} openDirs={openDirs} toggle={toggle} />
      ))}
    </>
  );
}

function FileTreeComponent({ entries, selectedPath, onSelect, activePaths }: FileTreeProps) {
  const tree = useMemo(() => buildTree(entries), [entries]);
  // Top-level folders start open; "!path" records one the user closed.
  const [openDirs, setOpenDirs] = useState<Set<string>>(() => new Set());
  const toggle = (path: string) => setOpenDirs(previous => {
    const next = new Set(previous);
    const isTop = !path.includes('/');
    const currentlyOpen = next.has(path) || (isTop && !next.has(`!${path}`));
    if (currentlyOpen) { next.delete(path); if (isTop) next.add(`!${path}`); }
    else { next.add(path); next.delete(`!${path}`); }
    return next;
  });

  if (entries.length === 0) {
    return (
      <div className="px-3 py-6 text-xs text-white/40 leading-relaxed">
        Nothing here yet. Ask PRO to build something, import a zip, or connect a GitHub repository.
      </div>
    );
  }
  return (
    <div className="py-1">
      {tree.map(node => (
        <Row key={node.path} node={node} depth={0} selectedPath={selectedPath} onSelect={onSelect} activePaths={activePaths} openDirs={openDirs} toggle={toggle} />
      ))}
    </div>
  );
}

export const FileTree = memo(FileTreeComponent);
