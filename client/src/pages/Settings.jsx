import { useAsync } from '../hooks/useAsync.js';
import { api } from '../services/api.js';
import { ErrorPanel, Loading, PageHeader } from '../components/Feedback.jsx';
import { Icon } from '../components/Icons.jsx';

export function Settings() {
  const state = useAsync(api.auth, []);
  return <><PageHeader eyebrow="Entorno local" title="Configuración" description="Estado seguro de la conexión. El valor del token nunca se entrega al navegador."/>{state.loading ? <Loading/> : state.error ? <ErrorPanel error={state.error} retry={() => state.run()}/> : <div className="settings-grid"><section className="panel"><div className="panel-heading"><h2>Autenticación</h2><span className="badge success"><Icon name="check" size={14}/>Activa</span></div><dl className="details-list"><div><dt>Usuario</dt><dd>@{state.data.user.login}</dd></div><div><dt>Token</dt><dd>Configurado en backend · valor oculto</dd></div><div><dt>Scopes clásicos informados</dt><dd>{state.data.token.scopes.join(', ') || 'No informados'}</dd></div></dl><p className="muted">{state.data.token.note}</p></section><section className="panel"><h2>Modelo de seguridad</h2><ul className="security-list"><li><Icon name="check"/>Servidor enlazado a <code>127.0.0.1</code></li><li><Icon name="check"/>Origen del navegador restringido por CORS</li><li><Icon name="check"/>Token fuera de variables <code>VITE_</code></li><li><Icon name="check"/>Escrituras con vista previa y confirmación</li><li><Icon name="check"/>SHA verificado antes de actualizar archivos</li></ul></section></div>}</>;
}
