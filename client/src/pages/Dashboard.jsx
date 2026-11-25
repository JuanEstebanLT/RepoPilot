import { useAsync } from '../hooks/useAsync.js';
import { api } from '../services/api.js';
import { ErrorPanel, Loading, PageHeader } from '../components/Feedback.jsx';
import { Icon } from '../components/Icons.jsx';

export function Dashboard({ onNavigate }) {
  const state = useAsync(api.dashboard, []);
  if (state.loading) return <Loading label="Preparando el panel con datos reales…"/>;
  if (state.error) return <><PageHeader eyebrow="Resumen" title="Dashboard" description="Estado de su conexión local con GitHub."/><ErrorPanel error={state.error} retry={() => state.run()}/></>;
  const data = state.data;
  const cards = [
    ['Repositorios accesibles', data.repositories.total, 'repo'], ['Repositorios públicos', data.repositories.public, 'dashboard'],
    ['Repositorios privados', data.repositories.private, 'repo'], ['Issues abiertos visibles', data.openIssues, 'issue'],
  ];
  const percentage = Math.round((data.rateLimit.remaining / data.rateLimit.limit) * 100);
  return <>
    <PageHeader eyebrow="Resumen" title={`Hola, ${data.user.name || data.user.login}`} description="Información consultada en tiempo real a través de la API REST de GitHub." action={<button className="button primary" onClick={() => onNavigate('analyzer')}><Icon name="scan"/>Analizar repositorio</button>}/>
    <div className="metric-grid">{cards.map(([label, value, icon]) => <article className="metric-card" key={label}><div className="metric-icon"><Icon name={icon}/></div><span>{label}</span><strong>{value}</strong></article>)}</div>
    <div className="dashboard-grid">
      <section className="panel connection-card"><div className="panel-heading"><div><span className="eyebrow">Cuenta activa</span><h2>Conexión con GitHub</h2></div><span className="badge success"><Icon name="check" size={14}/>Autenticado</span></div><div className="account-row"><img src={data.user.avatarUrl} alt={`Avatar de ${data.user.login}`}/><div><strong>{data.user.name || data.user.login}</strong><a href={data.user.htmlUrl} target="_blank" rel="noreferrer">@{data.user.login}<Icon name="external" size={14}/></a></div></div><p className="muted">El token permanece exclusivamente en el proceso del backend local.</p></section>
      <section className="panel rate-card"><div className="panel-heading"><div><span className="eyebrow">API REST</span><h2>Rate Limit</h2></div><strong>{percentage}%</strong></div><div className="progress"><span style={{ width: `${percentage}%` }}/></div><div className="rate-numbers"><span><strong>{data.rateLimit.remaining}</strong> restantes</span><span><strong>{data.rateLimit.used}</strong> usadas</span><span><strong>{data.rateLimit.limit}</strong> límite</span></div><p className="muted">Reinicio: {new Date(data.rateLimit.resetAt).toLocaleString('es-CO')}</p></section>
    </div>
  </>;
}
