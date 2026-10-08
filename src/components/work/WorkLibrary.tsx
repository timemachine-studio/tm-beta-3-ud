import { Bot, CalendarClock, FileSearch, FileText, Table2 } from 'lucide-react';
import { WORK_STATUS_LABELS, type WorkPersona, type WorkTask } from '../../../shared/work';
import type { WorkSection } from './WorkSidebar';
import { WorkHermesPanel } from './WorkHermesPanel';

const agents = [
  { id: 'default', name: 'TimeMachine Air', description: 'Fast everyday intelligence for research, writing and clear next steps.' },
  { id: 'girlie', name: 'TimeMachine Girlie', description: 'The same capable tools, with a warmer, more expressive voice.' },
  { id: 'pro', name: 'TimeMachine PRO', description: 'TM’s reasoning route for demanding analysis, planning and code.' },
] as const;
const skills = [
  { name: 'Research brief', icon: FileSearch, goal: 'Research a topic and write a sourced brief', instructions: 'Separate verified facts from inference. Cite sources with links. End with findings, gaps and next steps.' },
  { name: 'Document planning', icon: FileText, goal: 'Turn my notes into an actionable plan', instructions: 'Use the attached notes as source data. Group actions by priority, define deliverables, and preserve uncertainties.' },
  { name: 'Table analysis', icon: Table2, goal: 'Analyze a CSV and summarize the findings', instructions: 'Use deterministic table statistics. Explain missing values and limitations. Do not invent data or execute spreadsheet formulas.' },
] as const;
export function WorkLibrary({ section, persona, tasks, busy, allowed, onPersona, onSkill, onTask }: {
  section: Exclude<WorkSection, 'home' | 'connections'>; persona: WorkPersona; tasks: WorkTask[]; busy: boolean; allowed: boolean;
  onPersona: (persona: WorkPersona) => void; onSkill: (goal: string, instructions: string) => void; onTask: (task: WorkTask) => void;
}) {
  return <div className="tm-work-library">
    {section === 'agents' && <><h1>Agents</h1><p>Choose the TimeMachine mind for your next task. Existing sessions keep their original mind.</p><div className="tm-work-agent-list">{agents.map(agent => <button type="button" key={agent.id} aria-pressed={persona === agent.id} onClick={() => onPersona(agent.id)}><Bot size={20} aria-hidden="true" /><span><strong>{agent.name}</strong><small>{agent.description}</small></span><span>{persona === agent.id ? 'Selected' : 'Choose'}</span></button>)}</div><p className="tm-work-library-note">These use TM’s existing routes. Custom Agenta agent configuration requires the hosted Agenta connection.</p></>}
    {section === 'skills' && <><h1>Skills</h1><p>Start with a focused workflow. You review the plan before the worker begins.</p><div className="tm-work-agent-list">{skills.map(skill => <button type="button" key={skill.name} onClick={() => onSkill(skill.goal, skill.instructions)}><skill.icon size={20} aria-hidden="true" /><span><strong>{skill.name}</strong><small>{skill.instructions}</small></span><span>Use</span></button>)}</div><p className="tm-work-library-note">Built-in task templates for the native worker—not imported OpenHands extensions or Agenta skills.</p></>}
    {section === 'automations' && <><h1>Automations</h1><p>Scheduled and event-triggered work belongs here.</p><div className="tm-work-unavailable"><CalendarClock size={28} aria-hidden="true" /><h2>Connect the automation service first.</h2><p>The current worker runs tasks you start. Recurring schedules and external triggers are not connected yet; no automation has been created.</p></div></>}
    {section === 'sessions' && <><h1>Sessions</h1><p>Your cloud tasks, plans and saved files.</p>{tasks.length ? <div className="tm-work-agent-list">{tasks.map(task => <button type="button" key={task.id} disabled={busy} onClick={() => onTask(task)}><FileText size={18} aria-hidden="true" /><span><strong>{task.title}</strong><small>{new Date(task.updated_at).toLocaleDateString()}</small></span><span>{WORK_STATUS_LABELS[task.status]}</span></button>)}</div> : <div className="tm-work-unavailable"><FileText size={28} aria-hidden="true" /><h2>No Work sessions yet.</h2><p>Start a task from Home. Its progress and deliverables will stay together here once cloud Work is configured for your account.</p></div>}</>}
    {section === 'skills' && <WorkHermesPanel allowed={allowed} catalog />}
  </div>;
}
