import { useEffect, useRef, useState } from 'react';
import { Activity, Check, Circle, FileText, ListChecks, Loader2, ShieldCheck, Square } from 'lucide-react';
import { isWorkActive, isWorkExecuting, WORK_STATUS_LABELS, type WorkFile, type WorkSnapshot } from '../../../shared/work';
import { WorkArtifactPane, WorkMarkdown } from './WorkArtifactPane';
import { WorkIntegrationPane } from './WorkIntegrationPane';

type Tab = 'overview' | 'files' | 'activity';
export function WorkTaskPanel({ snapshot, busy, onApprove, onStop, onSave, onNotice }: {
  snapshot: WorkSnapshot; busy: boolean; onApprove: () => void; onStop: () => void;
  onSave: (file: WorkFile, content: string) => Promise<boolean>; onNotice: (message: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const [mobilePane, setMobilePane] = useState<'conversation' | 'workspace'>('conversation');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { task, activity, files, traces } = snapshot;
  const executing = isWorkExecuting(task.status);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 180) el.scrollTop = el.scrollHeight;
  }, [task.thread.length]);
  return <div className="tm-work-task">
    <div className="tm-work-task-top"><div><h1>{task.title}</h1><span className="tm-work-state" data-status={task.status}>{executing && <Loader2 size={13} className="tm-work-spin" aria-hidden="true" />}{WORK_STATUS_LABELS[task.status]}</span></div>
      {isWorkActive(task.status) && <button type="button" onClick={onStop} disabled={busy}><Square size={13} aria-hidden="true" />Stop task</button>}
    </div>
    <div className="tm-work-mobile-panes" role="group" aria-label="Work panel">
      <button type="button" aria-pressed={mobilePane === 'conversation'} onClick={() => setMobilePane('conversation')}>Conversation</button>
      <button type="button" aria-pressed={mobilePane === 'workspace'} onClick={() => setMobilePane('workspace')}>Workspace{files.filter(file => !file.source).length > 0 && <span>{files.filter(file => !file.source).length}</span>}</button>
    </div>
    <div className="tm-work-task-columns" data-mobile-pane={mobilePane}>
      <div className="tm-work-thread" ref={scrollRef} aria-label="Task conversation">
        {task.thread.map((turn, index) => <article key={`${index}-${turn.at}`} className={'tm-work-turn tm-work-turn-' + turn.role}>
          <p className="tm-work-turn-name">{turn.role === 'user' ? 'You' : 'TimeMachine ' + (task.persona === 'default' ? 'Air' : task.persona === 'pro' ? 'PRO' : 'Girlie')}</p>
          <WorkMarkdown>{turn.content}</WorkMarkdown>
        </article>)}
        {executing && <div className="tm-work-progress-line" role="status"><Loader2 size={15} className="tm-work-spin" aria-hidden="true" />{task.status === 'running' ? task.plan?.steps[task.step_index]?.title ?? 'Finishing your task' : 'Putting together a reviewable plan…'}</div>}
        {task.status === 'review' && <div className="tm-work-inline-review"><ShieldCheck size={19} aria-hidden="true" /><p>Review the plan in your workspace. Nothing will execute until you approve.</p><button type="button" className="tm-work-primary" disabled={busy} onClick={onApprove}>Approve & start</button></div>}
        {task.error && <p className="tm-work-task-error">{task.error === 'WORK_BUDGET_EXHAUSTED' ? 'This task reached its action limit. Review any saved files, then narrow the task and make a new plan.' : 'The task did not complete. Any saved files are preserved. Add instructions below to make a new plan.'}</p>}
      </div>
      <section className="tm-work-panel" aria-label="Task workspace">
        <div className="tm-work-tabs" role="tablist" aria-label="Workspace view">
          {([{ id: 'overview', label: 'Overview', icon: ListChecks }, { id: 'files', label: 'Files', icon: FileText }, { id: 'activity', label: 'Activity', icon: Activity }] as const).map(({ id, label, icon: Icon }) => <button type="button" key={id} role="tab" id={'work-tab-' + id} aria-selected={tab === id} aria-controls={'work-pane-' + id} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={event => {
            const order: Tab[] = ['overview', 'files', 'activity'];
            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); const next = order[(order.indexOf(id) + (event.key === 'ArrowRight' ? 1 : 2)) % 3]; setTab(next); document.getElementById('work-tab-' + next)?.focus(); }
            if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); const next = event.key === 'Home' ? 'overview' : 'activity'; setTab(next); document.getElementById('work-tab-' + next)?.focus(); }
          }}><Icon size={15} aria-hidden="true" />{label}{id === 'files' && files.length > 0 && <span>{files.length}</span>}</button>)}
        </div>
        <div className="tm-work-panel-body" hidden={tab === 'files'} role="tabpanel" id={tab === 'files' ? undefined : 'work-pane-' + tab} aria-labelledby={'work-tab-' + tab} tabIndex={0}>
          {tab === 'overview' && (task.plan ? <div className="tm-work-overview">
            <h2>{task.status === 'review' ? 'Your plan, before we start.' : 'The plan'}</h2><p>{task.plan.approach}</p>
            <ol className="tm-work-steps">{task.plan.steps.map((step, index) => <li key={index} data-complete={index < task.step_index}>
              <span className="tm-work-step-icon">{index < task.step_index ? <Check size={16} aria-hidden="true" /> : index === task.step_index && task.status === 'running' ? <Loader2 size={16} className="tm-work-spin" aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}</span>
              <div><h3>{step.title}</h3><p>{step.description}</p></div>
            </li>)}</ol>
            <h3>What you’ll get</h3><ul className="tm-work-deliverables">{task.plan.deliverables.map((item, index) => <li key={index}><FileText size={15} aria-hidden="true" />{item}</li>)}</ul>
            {task.plan.limitations.length > 0 && <><h3>Boundaries</h3><ul>{task.plan.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
            {task.status === 'review' && <div className="tm-work-plan-footer"><p>Only research and drafts in this workspace. No publishing, sending or changes to your original files.</p><button type="button" className="tm-work-primary" disabled={busy} onClick={onApprove}><ShieldCheck size={16} aria-hidden="true" />Approve & start</button></div>}
          </div> : <div className="tm-work-pane-empty"><ListChecks size={24} aria-hidden="true" /><h2>A clear plan comes first.</h2><p>TimeMachine is working out the steps and deliverables. You’ll review them before execution begins.</p></div>)}
          {tab === 'activity' && <div className="tm-work-activity"><h2>What happened</h2>{activity.length ? <ol>{activity.map(event => <li key={event.sequence}><span className="tm-work-event-dot" /><div><p>{event.title}</p><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div></li>)}</ol> : <p>Activity appears when the worker starts.</p>}
            <details className="tm-work-traces"><summary>Model calls · {traces.length}</summary><p>Prompt version and actual provider routes are recorded. Token counts and costs stay unavailable when the provider doesn’t report them.</p>{traces.map(trace => <div key={trace.id}><strong>{trace.model}</strong><span>{trace.provider} · {trace.phase} · {trace.latency_ms === null ? 'Latency unavailable' : (trace.latency_ms / 1000).toFixed(1) + 's'}</span><small>{trace.config_version}</small></div>)}</details>
            <WorkIntegrationPane taskId={task.id} taskVersion={`${task.generation}:${task.revision}:${task.status}`} />
          </div>}
        </div>
        <div className="tm-work-panel-body" hidden={tab !== 'files'} role="tabpanel" id="work-pane-files" aria-labelledby="work-tab-files" tabIndex={0}>
          <WorkArtifactPane files={files} status={task.status} busy={busy} taskId={task.id} onSave={onSave} onNotice={onNotice} />
        </div>
      </section>
    </div>
  </div>;
}
