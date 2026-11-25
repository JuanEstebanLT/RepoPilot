import { Icon } from './Icons.jsx';

export function Modal({ title, children, onClose, footer }) {
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <button className="modal-backdrop" aria-label="Cerrar" onClick={onClose}/>
    <section className="modal"><header><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Cerrar"><Icon name="close"/></button></header><div className="modal-body">{children}</div>{footer && <footer>{footer}</footer>}</section>
  </div>;
}
