import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { Empty, ErrorPanel, Loading, PageHeader } from '../components/Feedback.jsx';
import { Icon } from '../components/Icons.jsx';

const initialFilters = { q: '', language: '', topics: '', sort: 'best-match', page: 1, perPage: 12 };

function RepositoryDetail({ data, onClose, onAnalyze }) {
  const { repository: repo } = data;
  return <div className="explore-detail">
    <section className="panel repo-summary"><div className="owner-title"><img src={repo.avatarUrl} alt=""/><div><span className={`badge ${repo.private ? 'private' : ''}`}>{repo.visibility}</span><h2>{repo.fullName}</h2><p>{repo.description || 'Sin descripción'}</p></div></div><div className="stack-actions"><button className="button secondary" onClick={onClose}>Volver</button><button className="button primary" onClick={() => onAnalyze(repo.fullName)}>Analizar</button><a className="icon-button" href={repo.htmlUrl} target="_blank" rel="noreferrer" aria-label="Abrir en GitHub"><Icon name="external"/></a></div></section>
    {data.access.mode === 'read-only' && <div className="notice readonly"><Icon name="alert"/><div><strong>Modo solo lectura</strong><span>GitHub no informó permisos de escritura para el token. Las consultas y el análisis siguen disponibles.</span></div></div>}
    <div className="metric-grid compact-metrics">{[['Stars', repo.stars], ['Forks', repo.forks], ['Watchers', repo.watchers], ['Issues abiertos', repo.openIssues]].map(([label, value]) => <article className="metric-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
    <div className="explore-columns">
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Metadatos</span><h2>Repositorio</h2></div></div><dl className="details-list">
        <div><dt>Owner</dt><dd>{repo.owner} · {repo.ownerType}</dd></div><div><dt>Homepage</dt><dd>{repo.homepage ? <a href={repo.homepage} target="_blank" rel="noreferrer">{repo.homepage}</a> : 'No definida'}</dd></div><div><dt>Lenguaje principal</dt><dd>{repo.language || 'No determinado'}</dd></div><div><dt>Topics</dt><dd>{repo.topics.join(', ') || 'Sin topics'}</dd></div><div><dt>Rama predeterminada</dt><dd>{repo.defaultBranch}</dd></div><div><dt>Tamaño</dt><dd>{repo.size.toLocaleString('es-CO')} KB</dd></div><div><dt>Licencia</dt><dd>{repo.license?.name || 'No detectada'}</dd></div><div><dt>Estado</dt><dd>{[repo.archived && 'archivado', repo.fork && 'fork', repo.template && 'template'].filter(Boolean).join(', ') || 'activo'}</dd></div><div><dt>Creado</dt><dd>{new Date(repo.createdAt).toLocaleString('es-CO')}</dd></div><div><dt>Actualizado / push</dt><dd>{new Date(repo.updatedAt).toLocaleDateString('es-CO')} / {new Date(repo.pushedAt).toLocaleDateString('es-CO')}</dd></div>
      </dl></section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Lenguajes</span><h2>Distribución por bytes</h2></div></div><div className="language-list">{data.languages.items.map((item) => <div key={item.name}><span><strong>{item.name}</strong><small>{item.percentage}%</small></span><div className="progress"><span style={{ width: `${item.percentage}%` }}/></div></div>)}</div><h3 className="subheading">Dependencias detectadas</h3><p className="muted">{data.dependencyFiles.join(', ') || 'Ningún archivo de dependencias en la raíz.'}</p></section>
    </div>
    <div className="explore-columns">
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Documentación</span><h2>README</h2></div></div>{data.readme ? <pre className="file-preview">{data.readme.content}</pre> : <p className="muted">No se encontró README.</p>}</section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Raíz limitada</span><h2>Estructura</h2></div><span className="badge">máx. {data.limits.root}</span></div><div className="file-list">{data.root.map((item) => <a href={item.htmlUrl} target="_blank" rel="noreferrer" key={item.path}><span>{item.type === 'dir' ? '▸' : '·'}</span>{item.name}</a>)}</div></section>
    </div>
    <div className="explore-grid">{[
      ['Ramas', data.branches.map((item) => item.name)], ['Tags', data.tags.map((item) => item.name)],
      ['Releases', data.releases.map((item) => item.name)], ['Issues públicos', data.issues.map((item) => `#${item.number} ${item.title}`)],
      ['Pull requests abiertos', data.pullRequests.map((item) => `#${item.number} ${item.title}`)],
      ['Workflows', data.workflows.items.map((item) => item.name)],
    ].map(([title, items]) => <section className="panel mini-list" key={title}><h2>{title}</h2>{items.length ? items.slice(0, 10).map((item) => <span key={item}>{item}</span>) : <p className="muted">{title === 'Workflows' && !data.workflows.available ? 'GitHub no permitió consultar este recurso.' : 'Sin resultados.'}</p>}</section>)}</div>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Actividad</span><h2>Últimos commits</h2></div></div><div className="commit-list">{data.commits.map((commit) => <a href={commit.htmlUrl} target="_blank" rel="noreferrer" key={commit.sha}><code>{commit.sha.slice(0, 7)}</code><span><strong>{commit.message.split('\n')[0]}</strong><small>{commit.author} · {commit.date ? new Date(commit.date).toLocaleString('es-CO') : 'sin fecha'}</small></span></a>)}</div></section>
  </div>;
}

export function Explore({ onAnalyze }) {
  const [filters, setFilters] = useState(initialFilters);
  const [state, setState] = useState({ loading: false, data: null, error: null });
  const [detail, setDetail] = useState({ loading: false, data: null, error: null });
  const load = () => {
    if (!filters.q.trim()) return;
    setState((value) => ({ ...value, loading: true, error: null }));
    api.explore(filters).then((data) => setState({ loading: false, data, error: null })).catch((error) => setState({ loading: false, data: null, error }));
  };
  useEffect(() => { if (!filters.q.trim()) return undefined; const timer = setTimeout(load, 450); return () => clearTimeout(timer); }, [filters.q, filters.language, filters.topics, filters.sort, filters.page]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = (repo) => { setDetail({ loading: true, data: null, error: null }); api.exploreRepository(repo.owner, repo.name).then((data) => setDetail({ loading: false, data, error: null })).catch((error) => setDetail({ loading: false, data: null, error })); };
  if (detail.loading) return <Loading label="Consultando metadatos y recursos públicos…"/>;
  if (detail.error) return <><PageHeader eyebrow="Explorar GitHub" title="No fue posible abrir el repositorio"/><ErrorPanel error={detail.error} retry={() => setDetail({ loading: false, data: null, error: null })}/></>;
  if (detail.data) return <RepositoryDetail data={detail.data} onClose={() => setDetail({ loading: false, data: null, error: null })} onAnalyze={onAnalyze}/>;
  return <>
    <PageHeader eyebrow="GitHub público" title="Explorar GitHub" description="Busque owner/repository, una URL, usuario, organización, texto, lenguaje o topics. Los resultados no se mezclan con sus repositorios."/>
    <form className="panel explore-search" onSubmit={(event) => { event.preventDefault(); load(); }}><label className="field full"><span>Búsqueda</span><input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value, page: 1 })} placeholder="microsoft/vscode, https://github.com/facebook/react, microsoft o language:javascript"/></label><label className="field"><span>Lenguaje</span><input value={filters.language} onChange={(event) => setFilters({ ...filters, language: event.target.value, page: 1 })} placeholder="JavaScript"/></label><label className="field"><span>Topics (separados por coma)</span><input value={filters.topics} onChange={(event) => setFilters({ ...filters, topics: event.target.value, page: 1 })} placeholder="react, vite"/></label><label className="field"><span>Orden</span><select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value, page: 1 })}><option value="best-match">Mejor coincidencia</option><option value="stars">Stars</option><option value="forks">Forks</option><option value="updated">Actualización</option></select></label><button className="button primary" disabled={!filters.q.trim() || state.loading}><Icon name="scan"/>Buscar</button></form>
    {state.loading ? <Loading label="Buscando en GitHub…"/> : state.error ? <ErrorPanel error={state.error} retry={load}/> : !state.data ? <Empty title="Escriba una búsqueda" text="La consulta se ejecutará con debounce y un máximo de 12 resultados por página."/> : !state.data.items.length ? <Empty title="Sin coincidencias" text="Pruebe otra combinación de texto, lenguaje o topics."/> : <><p className="muted search-context">Interpretado como: {state.data.interpretedAs} · {state.data.pagination.total.toLocaleString('es-CO')} resultado(s)</p><div className="repo-grid">{state.data.items.map((repo) => <article className="repo-card" key={repo.id}><div className="repo-card-top"><img className="repo-avatar" src={repo.avatarUrl} alt=""/><span className="badge">{repo.visibility}</span></div><h2>{repo.fullName}</h2><p>{repo.description || 'Sin descripción'}</p><div className="repo-meta"><span>{repo.language || 'Sin lenguaje'}</span><span>★ {repo.stars}</span><span>⑂ {repo.forks}</span></div><div className="card-actions"><button className="button secondary" onClick={() => open(repo)}>Consultar</button><button className="button secondary" onClick={() => onAnalyze(repo.fullName)}>Analizar</button></div></article>)}</div><div className="pagination"><button disabled={filters.page === 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Anterior</button><span>Página {filters.page} de {Math.max(1, state.data.pagination.pages)}</span><button disabled={filters.page >= state.data.pagination.pages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Siguiente</button></div></>}
  </>;
}
