import { useState } from 'react';
import { Icon } from './Icons.jsx';

const items = [
  ['dashboard', 'Dashboard', 'dashboard'], ['repositories', 'Mis repositorios', 'repo'],
  ['explore', 'Explorar GitHub', 'scan'],
  ['create', 'Crear repositorio', 'plus'], ['analyzer', 'Analizador', 'scan'],
  ['issues', 'Gestión de issues', 'issue'], ['settings', 'Configuración', 'settings'],
];

export function Layout({ current, onNavigate, auth, children }) {
  const [open, setOpen] = useState(false);
  const navigate = (id) => { onNavigate(id); setOpen(false); };
  return <div className="shell">
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark">RP</div><div><strong>RepoPilot</strong><span>GitHub workspace</span></div></div>
      <nav aria-label="Navegación principal">
        {items.map(([id, label, icon]) => <button key={id} className={current === id ? 'active' : ''} onClick={() => navigate(id)}><Icon name={icon}/><span>{label}</span></button>)}
      </nav>
      <div className="sidebar-profile">
        {auth?.user ? <><img src={auth.user.avatarUrl} alt=""/><div><strong>{auth.user.name || auth.user.login}</strong><span>@{auth.user.login}</span></div></> : <><div className="avatar-placeholder"/><div><strong>Sin conexión</strong><span>Revise el token</span></div></>}
      </div>
    </aside>
    {open && <button className="backdrop" aria-label="Cerrar menú" onClick={() => setOpen(false)}/>} 
    <main className="main">
      <header className="topbar"><button className="menu-button" onClick={() => setOpen(!open)} aria-label="Abrir menú"><Icon name={open ? 'close' : 'menu'}/></button><div className={`connection-pill ${auth?.connected ? 'connected' : ''}`}><span/>{auth?.connected ? 'GitHub conectado' : 'Sin conexión'}</div></header>
      <div className="content">{children}</div>
    </main>
  </div>;
}
