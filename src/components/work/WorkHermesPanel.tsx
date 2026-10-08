import { useState } from 'react';
import { Bot, Loader2, RefreshCw, Search } from 'lucide-react';
import { HERMES_FEATURES, type WorkHermesSnapshot } from '../../../shared/workHermes';
import { useWorkConnectionCheck } from '../../hooks/useWorkConnectionCheck';
import { getWorkHermes } from '../../services/work/workService';

export function WorkHermesPanel({ allowed, catalog = false }: { allowed: boolean; catalog?: boolean }) {
  const state = useWorkConnectionCheck<WorkHermesSnapshot>();
  const [search, setSearch] = useState('');
  const result = state.result;
  const skills = result?.connected ? result.skills.filter(skill => `${skill.name} ${skill.description} ${skill.category ?? ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())) : [];
  return <section className="tm-work-hermes" aria-label={catalog ? 'Hermes skill catalog' : 'Hermes connection'}>
    <div className="tm-work-hermes-heading"><div><Bot size={19} aria-hidden="true" /><h2>{catalog ? 'Hermes skill catalog' : 'Hermes Agent'}</h2><span>Read only</span></div>
      <button type="button" disabled={!allowed || state.checking} onClick={() => void state.check(signal => getWorkHermes(signal))}>
        {state.checking ? <Loader2 size={15} className="tm-work-spin" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}{state.checking ? 'Checking Hermes…' : 'Check Hermes'}
      </button></div>
    <p className="tm-work-library-note">{catalog ? 'Discover skill names and descriptions from your assigned Hermes server. They are not installed or executable in TM yet.' : 'Inspect your assigned Hermes server’s advertised capabilities. A source checkout or remote response does not enable execution.'}</p>
    {!allowed && <p className="tm-work-library-note">Premium Work access is required to check an account’s private Hermes connection.</p>}
    {state.error && <p className="tm-work-task-error" role="alert">{state.error}</p>}
    <p className="tm-work-hermes-status" role="status">{state.checking ? 'Reading metadata. No task is being started.' : result ? result.message : 'Not checked. No remote request has been made.'}</p>
    {result?.connected && <>
      {!catalog && <dl className="tm-work-hermes-features">{Object.entries(HERMES_FEATURES).map(([id, label]) => <div key={id}><dt>{label}</dt><dd>{result.features.includes(id as keyof typeof HERMES_FEATURES) ? 'Advertised by server' : 'Not advertised'}</dd></div>)}</dl>}
      {catalog && (result.features.includes('skills_api') ? <>
        <label className="tm-work-hermes-search"><Search size={15} aria-hidden="true" /><input aria-label="Search Hermes skills" placeholder="Find a skill…" value={search} onChange={event => setSearch(event.target.value)} maxLength={120} /></label>
        {skills.length ? <ul className="tm-work-hermes-skills">{skills.map(skill => <li key={skill.name}><div><strong>{skill.name}</strong><span>{skill.category ?? 'Uncategorized'}</span></div><p>{skill.description || 'No description provided.'}</p></li>)}</ul> : <p className="tm-work-library-note">{result.skills.length ? 'No skills match your search.' : 'The server returned an empty skill catalog.'}</p>}
        {result.skillCatalogTruncated && <p className="tm-work-library-note">Showing the first 50 skills. This is a partial catalog; search covers only these results.</p>}
      </> : <p className="tm-work-library-note">This server does not advertise the skill-catalog API.</p>)}
      <p className="tm-work-library-note">Hermes task launch, tool approval, memory writes, skill installation and schedules remain disconnected.</p>
    </>}
  </section>;
}
