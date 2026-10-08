import { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import type { WorkIntegrationName, WorkIntegrationSnapshot } from '../../../shared/workIntegrations';
import { useWorkConnectionCheck } from '../../hooks/useWorkConnectionCheck';
import { getWorkIntegration } from '../../services/work/workService';

function ServiceMonitor({ taskId, service, active }: { taskId: string; service: WorkIntegrationName; active: boolean }) {
  const { result, error, checking, check } = useWorkConnectionCheck<WorkIntegrationSnapshot>();
  const [browsingHistory, setBrowsingHistory] = useState(false);
  const running = service === 'openhands' && result?.connected
    && ['running', 'waiting_for_confirmation'].includes(result.conversation?.status ?? '');
  useEffect(() => {
    if (!active || !running || checking || error || browsingHistory) return;
    const timer = setTimeout(() => void check(signal => getWorkIntegration(taskId, service, signal), true), 12000);
    return () => clearTimeout(timer);
  }, [active, running, checking, error, browsingHistory, check, taskId, service]);
  return <section className="tm-work-service-monitor" aria-label={(service === 'openhands' ? 'OpenHands' : 'Agenta') + ' connection'}>
    <div className="tm-work-service-heading"><h3>{service === 'openhands' ? 'OpenHands' : 'Agenta'}</h3><button type="button" disabled={checking} onClick={() => { setBrowsingHistory(false); void check(signal => getWorkIntegration(taskId, service, signal)); }}>
      {checking ? <Loader2 size={14} className="tm-work-spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}{checking ? 'Checking…' : 'Check connection'}
    </button></div>
    <p className="tm-work-muted" role="status">{checking ? result ? 'Refreshing assigned remote data…' : 'Reading this task’s assigned remote data…' : result ? result.connected ? running ? 'Remote response received · updates while this panel is open' : 'Remote response received · monitoring only' : 'Not connected' : 'Not checked'}</p>
    {error && <p className="tm-work-task-error" role="alert">{error}</p>}
    <p>{result?.message ?? (service === 'openhands' ? 'Read an assigned conversation’s status and event metadata. This cannot start or resume execution.' : 'Read metadata-only model traces for this task. Private prompts, file contents and reasoning are excluded.')}</p>
    {result?.conversation && <dl className="tm-work-remote-status"><div><dt>Conversation</dt><dd>{result.conversation.status.replace(/_/g, ' ')}</dd></div><div><dt>Runtime</dt><dd>{result.conversation.runtimeStatus?.replace(/_/g, ' ') ?? 'Unavailable'}</dd></div></dl>}
    {result?.conversation?.status === 'waiting_for_confirmation' && <p role="status">OpenHands is waiting for human authorization. Tool approval is not connected yet. Use the task’s Stop control to cancel.</p>}
    {result?.connected && service === 'openhands' && (result.events.length ? <ol className="tm-work-remote-events">{result.events.map(event => <li key={event.id}><span>{event.kind}</span><time dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></li>)}</ol> : <p>No remote event metadata returned.</p>)}
    {result?.eventPage?.nextCursor && <button type="button" disabled={checking} onClick={() => { setBrowsingHistory(true); void check(signal => getWorkIntegration(taskId, service, signal, result.eventPage?.nextCursor ?? undefined)); }}>Earlier events</button>}
    {result?.eventPage?.hasMore && !result.eventPage.nextCursor && <p>More event history exists. Paging is unavailable or this browse limit was reached. Check the connection again to return to current events.</p>}
    {result?.connected && service === 'agenta' && (result.traces.length ? <div className="tm-work-remote-traces">{result.traces.map(trace => <div key={trace.id}><strong>{trace.model}</strong><span>{trace.phase} · {trace.outcome.replace(/_/g, ' ')}</span><small>{trace.provider} · {trace.configVersion}</small></div>)}</div> : <p>No exported model traces returned for this task.</p>)}
  </section>;
}
export function WorkIntegrationPane({ taskId, taskVersion = '' }: { taskId: string; taskVersion?: string }) {
  const [open, setOpen] = useState(false);
  return <details className="tm-work-traces tm-work-upstream" onToggle={event => setOpen(event.currentTarget.open)}><summary>Upstream connections</summary><p>Read-only monitoring. Checks do not start tasks or enable sandbox execution.</p>
    <ServiceMonitor key={taskId + '-openhands-' + taskVersion} taskId={taskId} service="openhands" active={open} />
    <ServiceMonitor key={taskId + '-agenta-' + taskVersion} taskId={taskId} service="agenta" active={open} />
  </details>;
}
