import { type ReactNode, useState } from 'react';
import { Bot, CalendarClock, Home, Layers, MessagesSquare, Plug, Plus, Search, Settings } from 'lucide-react';
import { WORK_STATUS_LABELS, type WorkTask } from '../../../shared/work';

export type WorkSection = 'home' | 'agents' | 'automations' | 'skills' | 'sessions' | 'connections';
const navigation = [
  { id: 'home', label: 'Home', icon: Home }, { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'automations', label: 'Automations', icon: CalendarClock }, { id: 'skills', label: 'Skills', icon: Layers },
  { id: 'sessions', label: 'Sessions', icon: MessagesSquare },
] as const;
export function WorkSidebar({ brand, section, open, tasks, selected, busy, onSection, onTask, onNew, onClose, onSettings }: {
  brand: ReactNode;
  section: WorkSection; open: boolean; tasks: WorkTask[]; selected?: string; busy: boolean;
  onSection: (section: WorkSection) => void; onTask: (task: WorkTask) => void;
  onNew: () => void; onClose: () => void; onSettings: () => void;
}) {
  const [search, setSearch] = useState('');
  const recent = tasks.filter(task => task.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const groups = [{ id: 'default', name: 'TimeMachine Air' }, { id: 'girlie', name: 'TimeMachine Girlie' }, { id: 'pro', name: 'TimeMachine PRO' }] as const;
  return <aside id="work-sidebar" className="tm-work-sidebar" hidden={!open} aria-label="Work navigation" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
    <div className="tm-work-sidebar-top">{brand}</div>
    <nav aria-label="Work sections">{navigation.map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-current={section === id ? 'page' : undefined} onClick={() => onSection(id)}><Icon size={17} aria-hidden="true" />{label}</button>)}<button type="button" className="tm-work-new-task" onClick={onNew} disabled={busy}><Plus size={16} aria-hidden="true" />New task</button></nav>
    <div className="tm-work-recent"><div className="tm-work-recent-heading"><h2>Sessions</h2><span>{tasks.length}</span></div>
      {tasks.length > 0 && <label className="tm-work-session-search"><Search size={14} aria-hidden="true" /><input aria-label="Search Work sessions" placeholder="Find a session…" value={search} onChange={event => setSearch(event.target.value)} maxLength={120} /></label>}
      {groups.map(group => { const items = recent.filter(task => task.persona === group.id); return items.length > 0 && <details key={group.id} className="tm-work-session-group" open><summary>{group.name}<span>{items.length}</span></summary>{items.map(task => <button type="button" key={task.id} disabled={busy} aria-current={task.id === selected ? 'true' : undefined} onClick={() => onTask(task)}><span className="tm-work-session-dot" data-status={task.status} /><span>{task.title}<small>{WORK_STATUS_LABELS[task.status]}</small></span></button>)}</details>; })}
      {tasks.length === 0 && <p>No sessions yet.<br />Start a task to keep its plan and files here.</p>}
      {tasks.length > 0 && recent.length === 0 && <p>No sessions match “{search}”.</p>}
    </div>
    <div className="tm-work-sidebar-bottom"><button type="button" aria-current={section === 'connections' ? 'page' : undefined} onClick={() => onSection('connections')}><Plug size={16} aria-hidden="true" />Connections</button><button type="button" onClick={onSettings}><Settings size={16} aria-hidden="true" />Settings & theme</button><div className="tm-work-workspace-label"><span aria-hidden="true">TM</span><p>TimeMachine workspace<br /><span>Air · Girlie · PRO</span></p></div></div>
  </aside>;
}
