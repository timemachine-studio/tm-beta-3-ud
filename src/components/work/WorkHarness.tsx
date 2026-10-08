import { type ReactNode, useRef, useState } from 'react';
import { ArrowUp, BriefcaseBusiness, Cloud, FileText, Laptop, Loader2, PanelLeft, Paperclip, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWork } from '../../hooks/useWork';
import { newId } from '../../utils/id';
import { workPathSchema, type WorkPersona, type WorkRequest, type WorkTask } from '../../../shared/work';
import { WorkTaskPanel } from './WorkTaskPanel';
import { getWorkCapabilities } from '../../services/work/workService';
import { WorkSidebar, type WorkSection } from './WorkSidebar';
import { WorkLibrary } from './WorkLibrary';
import { WorkConnections } from './WorkConnections';

type SourceFile = Extract<WorkRequest, { action: 'create' }>['files'][number];
const minds: { id: WorkPersona; label: string }[] = [{ id: 'default', label: 'Air' }, { id: 'girlie', label: 'Girlie' }, { id: 'pro', label: 'PRO' }];
export function WorkHarness({ brand, sessionId, persona, visible, onPersonaChange, onOpenAuth, onOpenSettings, beforeStart, onLocalWork }: {
  brand: ReactNode;
  sessionId: string; persona: WorkPersona; visible: boolean; onPersonaChange: (persona: WorkPersona) => void;
  onOpenAuth: () => void; onOpenSettings: () => void; beforeStart: () => Promise<void>; onLocalWork: () => Promise<void>;
}) {
  const { user } = useAuth();
  const work = useWork(sessionId, user?.id ?? null, visible);
  const [environment, setEnvironment] = useState<'cloud' | 'local'>('cloud');
  const [goal, setGoal] = useState('');
  const [instructions, setInstructions] = useState('');
  const [steering, setSteering] = useState('');
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [section, setSection] = useState<WorkSection>('home');
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 901px)').matches);
  const [notice, setNotice] = useState('');
  const [starting, setStarting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLElement>(null);
  const navigationToggle = useRef<HTMLButtonElement>(null);
  const requestId = useRef(newId());
  const startingRef = useRef(false);
  const task = work.snapshot?.task;
  const remoteTask = Boolean(task?.worker_id?.startsWith('openhands:'));
  const allowed = work.capabilities?.access === 'allowed';
  const busy = work.busy || starting;
  const canLeave = () => !root.current?.querySelector('[data-work-dirty="true"]') || window.confirm('You have unsaved file edits. Leave this task and discard them?');
  const closeSidebar = () => { setSidebarOpen(false); navigationToggle.current?.focus(); };
  const chooseSection = (next: WorkSection) => {
    setSection(next);
    if (window.matchMedia('(max-width: 900px)').matches) closeSidebar();
  };
  const chooseTask = (next: WorkTask) => { if (canLeave()) { void work.select(next.id); chooseSection('home'); setEnvironment('cloud'); } };
  const newTask = () => { if (canLeave()) { work.clear(); requestId.current = newId(); setSteering(''); chooseSection('home'); } };
  const attach = async (selected: FileList | null) => {
    if (!selected) return;
    try {
      const next = [...files];
      for (const file of Array.from(selected)) {
        if (next.length >= 8) throw new Error('Attach up to 8 source files.');
        if (file.size > 80000) throw new Error('Each source file must be under 80 KB.');
        if (!/\.(txt|md|csv|tsv|json|js|ts|tsx|jsx|html|css|py|yaml|yml)$/i.test(file.name) || !workPathSchema.safeParse(file.name).success) throw new Error('Use a text, Markdown, CSV, code or JSON file with a simple filename.');
        if (next.some(source => source.path === file.name)) throw new Error('A file named ' + file.name + ' is already attached.');
        const content = await file.text();
        if (content.includes('\0')) throw new Error('Binary files cannot be read in this workspace.');
        next.push({ path: file.name, content, kind: /\.md$/i.test(file.name) ? 'markdown' : /\.(csv|tsv)$/i.test(file.name) ? 'csv' : /\.txt$/i.test(file.name) ? 'text' : 'code' });
      }
      if (next.reduce((sum, file) => sum + new TextEncoder().encode(file.content).length, 0) > 200000) throw new Error('Combined source files must be under 200 KB.');
      setFiles(next); setNotice('Source files attached. Originals remain read only.');
    } catch (cause) { work.setError(cause instanceof Error ? cause.message : 'Files could not be attached.'); }
    finally { if (fileInput.current) fileInput.current.value = ''; }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (startingRef.current || busy || work.checking || !allowed || !work.capabilities?.cloud) return;
    if (remoteTask) return;
    if (task) {
      if (await work.mutate({ action: 'steer', taskId: task.id, revision: task.revision, message: steering })) setSteering('');
      return;
    }
    startingRef.current = true; setStarting(true); work.setError(null);
    try {
      await beforeStart();
      if (await work.mutate({ action: 'create', sessionId, requestId: requestId.current, goal, instructions, persona, files })) {
        setGoal(''); setFiles([]); requestId.current = newId();
      }
    } catch { work.setError('Your chat could not be saved. Nothing was started; your draft is still here.'); }
    finally { startingRef.current = false; setStarting(false); }
  };
  const openLocal = async () => {
    if (startingRef.current) return;
    startingRef.current = true; setStarting(true); work.setError(null);
    try {
      const access = await getWorkCapabilities();
      if (access.access !== 'allowed' || !access.local) throw new Error(access.message || 'Local Work is not available for this account.');
      await onLocalWork();
    } catch (cause) { work.setError(cause instanceof Error ? cause.message : 'Local workspace could not open.'); }
    finally { startingRef.current = false; setStarting(false); }
  };
  return <section className="tm-work" ref={root} hidden={!visible} aria-label="TimeMachine Work" data-section={section} data-layout="agenta">
    <button ref={navigationToggle} type="button" className="tm-work-sidebar-toggle" data-open={sidebarOpen} aria-label={sidebarOpen ? 'Hide Work sidebar' : 'Show Work sidebar'} title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'} aria-expanded={sidebarOpen} aria-controls="work-sidebar" onClick={() => sidebarOpen ? closeSidebar() : setSidebarOpen(true)}><X className="tm-work-sidebar-toggle-close" size={18} aria-hidden="true" /><PanelLeft className="tm-work-sidebar-toggle-panel" size={18} aria-hidden="true" /></button>
    <div className="tm-work-shell" data-sidebar-open={sidebarOpen}>
    <WorkSidebar brand={sidebarOpen ? brand : null} section={section} open={sidebarOpen} tasks={work.history} selected={task?.id} busy={busy} onSection={chooseSection} onTask={chooseTask} onNew={newTask} onClose={closeSidebar} onSettings={onOpenSettings} />
    <div className="tm-work-content">
      <div className="tm-work-toolbar">
        <div className="tm-work-toolbar-start">{!sidebarOpen && brand}<span className="tm-work-location">{section === 'home' ? task ? 'Session' : 'Home' : section[0].toUpperCase() + section.slice(1)}</span></div>
        <div className="tm-work-toolbar-end">
        <div className="tm-work-environments" role="group" aria-label="Work environment"><button type="button" aria-pressed={environment === 'cloud'} onClick={() => setEnvironment('cloud')}><Cloud size={15} aria-hidden="true" />Cloud</button><button type="button" aria-pressed={environment === 'local'} onClick={() => setEnvironment('local')}><Laptop size={15} aria-hidden="true" />Local</button></div>
        <div className="tm-work-toolbar-actions"><button type="button" onClick={() => void work.refresh()} disabled={busy || work.checking} aria-label="Refresh Work"><RefreshCw size={16} aria-hidden="true" /></button></div>
        </div>
      </div>
      {work.checking && <p className="tm-work-connection" role="status"><Loader2 size={16} className="tm-work-spin" aria-hidden="true" />Checking your Work access…</p>}
      {work.error && <div className="tm-work-error" role="alert"><p>{work.error}</p><button type="button" onClick={() => void work.refresh()} disabled={busy}>Reconnect</button></div>}
      {section === 'connections' && <WorkConnections capabilities={work.capabilities} />}
      {section !== 'home' && section !== 'connections' && <WorkLibrary section={section} persona={persona} tasks={work.history} busy={busy} allowed={allowed} onPersona={onPersonaChange} onSkill={(nextGoal, nextInstructions) => { if (task && !canLeave()) return; work.clear(); setGoal(nextGoal); setInstructions(nextInstructions); requestId.current = newId(); chooseSection('home'); setEnvironment('cloud'); }} onTask={chooseTask} />}
      <div hidden={section !== 'home'}>
      <div hidden={environment !== 'local'} className="tm-work-local"><Laptop size={32} aria-hidden="true" /><h1>Your device. Your workspace.</h1><p>Use TimeMachine’s existing PRO Max Mode for a browser-local code editor, terminal and preview. Your device needs to stay open while it runs.</p><p>Cloud task files are not copied here automatically. This is a separate execution environment—not unrestricted access to your computer.</p><button type="button" className="tm-work-primary" disabled={!allowed || busy || persona !== 'pro'} onClick={() => { if (canLeave()) void openLocal(); }}>{starting && <Loader2 size={16} className="tm-work-spin" aria-hidden="true" />}Open local workspace</button>{persona !== 'pro' && <button type="button" onClick={() => onPersonaChange('pro')}>Choose PRO for local Work</button>}</div><div hidden={environment !== 'cloud'} className={task ? 'tm-work-active' : 'tm-work-home'}>
        {work.snapshot ? <WorkTaskPanel key={work.snapshot.task.id} snapshot={work.snapshot} busy={busy} onApprove={() => void work.mutate({ action: 'approve', taskId: task!.id, revision: task!.revision })} onStop={() => void work.mutate({ action: 'cancel', taskId: task!.id })} onSave={(file, content) => work.mutate({ action: 'save_file', taskId: task!.id, path: file.path, revision: file.revision, content })} onNotice={setNotice} /> : <div className="tm-work-empty"><h1>What should we work on?</h1><p>A clear goal. A plan you review. Files you can use.</p></div>}
        {remoteTask ? <p className="tm-work-footnote" role="status">Remote task direction is unavailable. Stop this task before starting a new one; the saved plan and files remain here.</p> : <form className="tm-work-composer" onSubmit={submit}>
          <label className="tm-work-sr" htmlFor="work-goal">{task ? 'Steer this task' : 'Describe your task'}</label>
          <textarea id="work-goal" placeholder={task ? 'Add direction, or ask for a revision…' : 'Describe the outcome you want…'} value={task ? steering : goal} onChange={event => task ? setSteering(event.target.value) : setGoal(event.target.value)} maxLength={task ? 4000 : 12000} rows={task ? 2 : 3} />
          {!task && files.length > 0 && <div className="tm-work-attachments">{files.map(file => <span key={file.path}><FileText size={13} aria-hidden="true" />{file.path}<button type="button" aria-label={'Remove ' + file.path} disabled={busy} onClick={() => setFiles(files.filter(item => item.path !== file.path))}><X size={13} aria-hidden="true" /></button></span>)}</div>}
          <div className="tm-work-composer-footer"><div>{!task && <><input ref={fileInput} type="file" multiple hidden accept=".txt,.md,.csv,.tsv,.json,.js,.ts,.tsx,.jsx,.html,.css,.py,.yaml,.yml" onChange={event => void attach(event.target.files)} /><button type="button" disabled={busy} aria-label="Attach source files" onClick={() => fileInput.current?.click()}><Paperclip size={18} aria-hidden="true" /></button></>}<label className="tm-work-mind-label">Mind<select aria-label={task ? 'Mind for new tasks' : 'Work mind'} value={persona} onChange={event => onPersonaChange(event.target.value as WorkPersona)}>{minds.map(mind => <option key={mind.id} value={mind.id}>{mind.label}</option>)}</select></label></div><button type="submit" className="tm-work-send" disabled={busy || work.checking || !allowed || !work.capabilities?.cloud || !(task ? steering : goal).trim()} aria-label={task ? 'Send task direction' : 'Create a plan'}>{busy ? <Loader2 size={20} className="tm-work-spin" aria-hidden="true" /> : <ArrowUp size={21} aria-hidden="true" />}</button></div>
          {!task && <details className="tm-work-instructions"><summary>Task instructions</summary><label htmlFor="work-instructions">Preferences and constraints for this task</label><textarea id="work-instructions" value={instructions} onChange={event => setInstructions(event.target.value)} maxLength={4000} rows={3} placeholder="Audience, format, sources, tone, constraints…" /></details>}
        </form>}{!task && <div className="tm-work-starters">{['Research a topic', 'Make a plan from my notes', 'Analyze a CSV'].map(example => <button type="button" key={example} onClick={() => setGoal(example)}>{example}</button>)}</div>}<p className="tm-work-footnote">{task ? remoteTask ? `This remote task uses ${minds.find(mind => mind.id === task.persona)?.label}.` : `This task uses ${minds.find(mind => mind.id === task.persona)?.label}. Changes to the mind selector apply to new tasks. Direction is applied at the next step.` : 'Original files stay read only. Cloud execution requires an enabled backend.'}</p>
      </div>
      </div>
      {!work.checking && work.capabilities && (!allowed || !work.capabilities.cloud) && <div className="tm-work-access"><BriefcaseBusiness size={15} aria-hidden="true" /><div><h2>{work.capabilities.access === 'sign_in' ? 'Sign in to use Work' : work.capabilities.access === 'premium' ? 'Premium access required' : 'Cloud setup required'}</h2><p>{work.capabilities.message}</p><button type="button" onClick={work.capabilities.access === 'sign_in' ? onOpenAuth : () => chooseSection('connections')}>{work.capabilities.access === 'sign_in' ? 'Sign in' : 'View connections'}</button></div></div>}
      <p className="tm-work-notice" role="status" aria-live="polite">{notice}</p>
    </div>
    </div>
  </section>;
}
