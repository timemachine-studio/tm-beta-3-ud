import { Cloud, Laptop, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import type { WorkCapabilities } from '../../../shared/work';
import { useWorkConnectionCheck } from '../../hooks/useWorkConnectionCheck';
import { getWorkConnectionStatuses } from '../../services/work/workService';
import type { WorkConnectionStatus } from '../../../shared/workIntegrations';
import { WorkHermesPanel } from './WorkHermesPanel';

// Inherited Operate surface: sidebar → compact content, not a new visual world.
// Glass structural layers and TM persona accents stay in work.css. This page
// distinguishes installed code, account configuration and live remote checks.
export function WorkConnections({ capabilities }: { capabilities: WorkCapabilities | null }) {
  const state = useWorkConnectionCheck<WorkConnectionStatus[]>();
  const allowed = capabilities?.access === 'allowed';
  return <div className="tm-work-library tm-work-connections">
    <div className="tm-work-connections-heading"><div><h1>Connections</h1><p>Your execution environment and upstream services.</p></div>
      <button type="button" disabled={!allowed || state.checking} onClick={() => void state.check(signal => getWorkConnectionStatuses(signal))}>
        {state.checking ? <Loader2 size={15} className="tm-work-spin" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}{state.checking ? 'Checking…' : 'Check configuration'}
      </button>
    </div>
    {!allowed && <p className="tm-work-library-note">{capabilities?.access === 'sign_in' ? 'Sign in with a premium TM account to check its private connections.' : capabilities?.message ?? 'Checking your Work access…'}</p>}
    {state.error && <p className="tm-work-task-error" role="alert">{state.error}</p>}
    <dl className="tm-work-connection-list">
      <div><dt><Cloud size={19} aria-hidden="true" />Native cloud</dt><dd><strong>{allowed && capabilities.cloud ? 'Worker enabled' : 'Not available'}</strong><p>Plan review, research, text and CSV analysis, editable draft files, steering and stop. No cloud terminal or browser-control tools.</p></dd></div>
      <div><dt><Laptop size={19} aria-hidden="true" />Local workspace</dt><dd><strong>{allowed && capabilities.local ? 'PRO browser workspace' : 'Premium access required'}</strong><p>The existing TM code editor, terminal and preview run in your browser. This is separate from cloud Work and requires your device to stay open.</p></dd></div>
      {(['openhands', 'agenta'] as const).map(service => {
        const connection = state.result?.find(item => item.service === service);
        return <div key={service}><dt><ShieldCheck size={19} aria-hidden="true" />{service === 'openhands' ? 'OpenHands' : 'Agenta'}</dt><dd>
          <strong>{connection ? connection.configured ? 'Configured · remote not checked' : 'Not connected' : state.checking ? 'Checking configuration…' : 'Not checked'}</strong>
          <p>{connection?.message ?? 'Check the server-assigned connection for this account. Keys and service URLs never appear in the browser.'}</p>
          <p>{service === 'openhands' ? 'Current adapter: assigned conversation and event monitoring only. Sandbox execution is not enabled.' : 'Current adapter: model-call metadata export and query. Agent management, schedules and evaluations are not enabled.'}</p>
          {connection?.configured && service === 'agenta' && <p>Metadata export: {connection.exportEnabled ? 'enabled' : 'disabled'}.</p>}
        </dd></div>;
      })}
    </dl>
    <WorkHermesPanel allowed={allowed} />
    <p className="tm-work-library-note" role="status">{state.checking ? 'Checking account configuration. No task will be started.' : 'Configuration is not a live health check. For a saved task, open Activity → Upstream connections to read its assigned remote data.'}</p>
  </div>;
}
