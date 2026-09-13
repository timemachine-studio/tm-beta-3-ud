/**
 * The editor half of the Files tab.
 *
 * CodeMirror 6, loaded lazily with the panel. Each edit is queued for saving to
 * the store immediately, through the same write the harness uses,
 * so the model's next read sees it. A change that arrives from the store
 * while the user is not typing — the harness editing the open file — is
 * shown in place, which is how the user watches an edit land.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { readWorkspaceFile, subscribeWorkspace, writeWorkspaceFile } from '../../services/workspace/workspaceStore';


function languageFor(path: string) {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'ts': return javascript({ typescript: true });
    case 'tsx': return javascript({ typescript: true, jsx: true });
    case 'js': case 'mjs': case 'cjs': return javascript();
    case 'jsx': return javascript({ jsx: true });
    case 'html': case 'htm': case 'vue': case 'svelte': return html();
    case 'css': case 'scss': return css();
    case 'json': return json();
    case 'md': case 'mdx': return markdown();
    case 'py': return python();
    default: return null;
  }
}

const theme = EditorView.theme({
  '&': { backgroundColor: 'transparent', color: 'rgb(var(--tm-ink-rgb) / 0.9)', fontSize: '13px', height: '100%' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: '1.55' },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'rgb(var(--tm-ink-rgb) / 0.3)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'rgb(var(--tm-ink-rgb) / 0.04)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  '.cm-content': { caretColor: '#22d3ee' },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#22d3ee' },
  '&.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(34, 211, 238, 0.25)' },
  '.cm-selectionMatch': { backgroundColor: 'rgba(34, 211, 238, 0.15)' },
}, { dark: true });

interface CodeEditorProps {
  sessionId: string;
  path: string;
}

export function CodeEditor({ sessionId, path }: CodeEditorProps) {
  const [value, setValue] = useState<string | null>(null);
  const [binary, setBinary] = useState(false);
  const [missing, setMissing] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const typingRef = useRef(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const editVersionRef = useRef(0);
  const generationRef = useRef(0);

  const load = useMemo(() => async () => {
    const generation = generationRef.current;
    const file = await readWorkspaceFile(sessionId, path);
    if (generation !== generationRef.current || typingRef.current) return;
    if (!file) { setMissing(true); setValue(null); return; }
    setMissing(false);
    setBinary(file.text === null);
    if (file.text !== null) { setValue(file.text); }
  }, [sessionId, path]);

  useEffect(() => {
    typingRef.current = false;
    const generation = generationRef.current;
    // Deferred a tick: the read is async anyway, and the store is an
    // external system this effect subscribes to rather than state it sets.
    let cancelled = false;
    Promise.resolve().then(() => (cancelled ? undefined : load()))
      .catch((error: unknown) => console.error('Could not open the file:', error instanceof Error ? error.message : error));
    const unsubscribe = subscribeWorkspace((changedSession, changedPath) => {
      if (changedSession !== sessionId) return;
      if (changedPath !== null && changedPath !== path) return;
      // The harness (or a sync) changed this file. Show it unless the user is
      // mid-keystroke, in which case their save is about to win anyway.
      if (!typingRef.current) load().catch(() => undefined);
    });
    return () => { cancelled = true; generationRef.current = generation + 1; unsubscribe(); };
  }, [sessionId, path, load]);

  const onChange = (next: string) => {
    typingRef.current = true;
    const version = ++editVersionRef.current;
    const generation = generationRef.current;
    setValue(next);
    setSaveState('saving');
    // Capture the path and contents now; switching tabs must not cancel a save
    // or write a later file's text into this one.
    saveQueueRef.current = saveQueueRef.current.catch(() => undefined).then(async () => {
      try {
        await writeWorkspaceFile(sessionId, path, next);
        if (version === editVersionRef.current && generation === generationRef.current) setSaveState('saved');
      } catch (error) {
        console.error('Could not save the file:', error instanceof Error ? error.message : error);
        if (version === editVersionRef.current && generation === generationRef.current) setSaveState('error');
      } finally {
        if (version === editVersionRef.current) typingRef.current = false;
      }
    });
  };

  const extensions = useMemo(() => {
    const language = languageFor(path);
    return language ? [theme, language, EditorView.lineWrapping] : [theme, EditorView.lineWrapping];
  }, [path]);

  if (missing) return <div className="p-4 text-sm text-white/40">{path} no longer exists.</div>;
  if (binary) return <div className="p-4 text-sm text-white/40">{path} is a binary file.</div>;
  if (value === null) return <div className="p-4 text-sm text-white/40">Opening…</div>;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 text-xs">
        <span className="font-mono text-white/60 truncate">{path}</span>
        <span className={saveState === 'error' ? 'text-rose-300' : 'text-white/30'}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Not saved' : 'Saved'}
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <CodeMirror
          value={value}
          onChange={onChange}
          extensions={extensions}
          theme="none"
          height="100%"
          basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, autocompletion: false }}
        />
      </div>
    </div>
  );
}
