import { Icon } from './Icons.jsx';

export function Loading({ label = 'Consultando GitHub…' }) { return <div className="state-panel"><span className="spinner"/><p>{label}</p></div>; }
export function Empty({ title, text }) { return <div className="state-panel empty"><Icon name="repo" size={30}/><h3>{title}</h3><p>{text}</p></div>; }
export function ErrorPanel({ error, retry }) { return <div className="state-panel error"><Icon name="alert" size={28}/><h3>No fue posible completar la consulta</h3><p>{error?.message}</p>{retry && <button className="button secondary" onClick={retry}>Reintentar</button>}</div>; }
export function PageHeader({ eyebrow, title, description, action }) { return <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>; }
