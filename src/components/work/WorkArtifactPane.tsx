import { useEffect, useRef, useState } from 'react';
import { Copy, Download, FileText, Save, Pencil, Eye } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { WorkFile, WorkStatus } from '../../../shared/work';
import { workFileDownload } from './workFiles';

export function WorkMarkdown({ children }: { children: string }) {
  return <div className="tm-work-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
    img: ({ alt }) => <span>{alt || 'Image reference (not loaded automatically)'}</span>,
  }}>{children}</ReactMarkdown></div>;
}
function FileEditor({ file, status, busy, onSave, onNotice }: {
  file: WorkFile; status: WorkStatus; busy: boolean;
  onSave: (file: WorkFile, content: string) => Promise<boolean>; onNotice: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(file.content);
  const [base, setBase] = useState(file);
  const [exporting, setExporting] = useState(false);
  const dirty = draft !== base.content;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const editable = !file.source && !['queued', 'planning', 'running'].includes(status);
  const copy = async () => {
    try { await navigator.clipboard.writeText(dirty ? draft : file.content); onNotice('Copied ' + file.path); }
    catch { onNotice('Clipboard access was blocked. Select the text to copy it.'); }
  };
  const download = () => {
    const { content, mime } = workFileDownload(dirty ? { ...file, content: draft } : file);
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const link = document.createElement('a'); link.href = url; link.download = file.path.split('/').pop() || 'deliverable.txt';
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportWord = async () => {
    setExporting(true);
    try {
      const { markdownToDocx } = await import('../../services/convert/markdownToDocx');
      const blob = await markdownToDocx(dirty ? draft : file.content, file.path);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = (file.path.split('/').pop() || 'deliverable').replace(/\.md$/i, '') + '.docx';
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { onNotice('Word export could not finish. Your Markdown file is still available to download.'); }
    finally { setExporting(false); }
  };
  return <section className="tm-work-file-view" data-work-dirty={dirty} aria-label={'File: ' + file.path}>
    <div className="tm-work-file-heading"><div><FileText size={17} aria-hidden="true" /><span>{file.path}</span></div><span className="tm-work-muted">{file.source ? 'Original · read only' : 'Version ' + file.revision}</span></div>
    <div className="tm-work-file-actions">
      <button type="button" onClick={copy}><Copy size={15} aria-hidden="true" />Copy</button>
      <button type="button" onClick={download}><Download size={15} aria-hidden="true" />Download</button>
      {file.kind === 'markdown' && <button type="button" disabled={exporting} onClick={() => void exportWord()}><FileText size={15} aria-hidden="true" />{exporting ? 'Exporting…' : 'Export Word'}</button>}
      {editable && <button type="button" aria-pressed={editing} onClick={() => {
        if (!editing && !dirty) { setDraft(file.content); setBase(file); }
        setEditing(!editing);
      }}>{editing ? <Eye size={15} aria-hidden="true" /> : <Pencil size={15} aria-hidden="true" />}{editing ? 'Preview' : 'Edit'}</button>}
      {editing && <button type="button" disabled={!dirty || busy || !editable} onClick={async () => {
        if (await onSave(base, draft)) { setBase({ ...base, content: draft, revision: base.revision + 1 }); onNotice('Saved ' + file.path); }
      }}><Save size={15} aria-hidden="true" />Save</button>}
    </div>
    {dirty && <p className="tm-work-edit-notice">Unsaved edits. Copy or download includes your draft. Save to keep it in your workspace.</p>}
    {editing ? <textarea className="tm-work-code-editor" aria-label={'Edit ' + file.path} value={draft} onChange={event => setDraft(event.target.value)} spellCheck={false} maxLength={80000} />
      : file.kind === 'markdown' ? <div className="tm-work-file-content"><WorkMarkdown>{dirty ? draft : file.content}</WorkMarkdown></div>
      : <pre className="tm-work-file-content tm-work-plain"><code>{dirty ? draft : file.content}</code></pre>}
  </section>;
}
export function WorkArtifactPane({ files, status, busy, taskId, onSave, onNotice }: {
  files: WorkFile[]; status: WorkStatus; busy: boolean; taskId: string; onSave: (file: WorkFile, content: string) => Promise<boolean>; onNotice: (message: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = files.find(file => file.path === selected) ?? files.find(file => !file.source) ?? files[0];
  const exportAll = async () => {
    if (root.current?.querySelector('[data-work-dirty="true"]')) {
      onNotice('Save your edits before downloading all deliverables. Individual downloads include your unsaved draft.');
      return;
    }
    setExporting(true);
    try {
      const { workDeliverablesBundle } = await import('./workBundle');
      const url = URL.createObjectURL(workDeliverablesBundle(files));
      const link = document.createElement('a'); link.href = url; link.download = `timemachine-work-${taskId}.zip`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      onNotice('Saved deliverables downloaded. Original uploads were excluded.');
    } catch { onNotice('The deliverables archive could not be created. Your files are still available individually.'); }
    finally { setExporting(false); }
  };
  return <div className="tm-work-artifacts" ref={root}>
    {files.length === 0 ? <div className="tm-work-pane-empty"><FileText size={24} aria-hidden="true" /><h3>Your work lands here.</h3><p>Saved deliverables appear as the task progresses. Preview, edit, copy or download them here.</p></div> : <>
      <div className="tm-work-file-toolbar"><nav className="tm-work-file-list" aria-label="Workspace files">{files.map(file => <button type="button" key={file.id} aria-current={current?.id === file.id ? 'true' : undefined} onClick={() => setSelected(file.path)}><FileText size={14} aria-hidden="true" /><span>{file.path}</span><small>{file.source ? 'Source' : 'Output'}</small></button>)}</nav>
        {files.some(file => !file.source) && <button type="button" className="tm-work-export-all" disabled={busy || exporting} onClick={() => void exportAll()}><Download size={15} aria-hidden="true" />{exporting ? 'Preparing…' : 'Download all'}</button>}
      </div>
      {files.map(file => <div key={file.id} hidden={current?.id !== file.id}><FileEditor file={file} status={status} busy={busy} onSave={onSave} onNotice={onNotice} /></div>)}
    </>}
  </div>;
}
