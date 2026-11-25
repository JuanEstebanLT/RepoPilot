import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { PageHeader } from '../components/Feedback.jsx';
import { Icon } from '../components/Icons.jsx';
import { normalizeTopics } from '../utils/topics.js';

const initial = {
  name: '', owner: '', description: '', visibility: 'private', homepage: '', topics: [],
  readme: { enabled: true, content: '' }, gitignoreTemplates: [], license: 'none',
  features: { issues: true, projects: true, wiki: true, discussions: false },
  merge: { mergeCommit: true, squash: true, rebase: true, deleteBranch: false },
  template: { mode: 'empty', github: '', repopilot: 'empty', optionalFiles: { readme: false, gitignore: false, envExample: false, license: false, contributing: false, codeOfConduct: false, security: false } },
};
const labels = ['Datos generales', 'Inicialización', 'Funciones GitHub', 'Merge', 'Plantilla', 'Vista previa'];
const gitignores = ['Node', 'Python', 'Java', 'Android', 'Gradle', 'Maven', 'VisualStudioCode', 'JetBrains', 'Windows'];
const repoTemplates = [['empty', 'Proyecto vacío'], ['react-vite', 'React + Vite'], ['node-express', 'Node.js + Express'], ['python', 'Python'], ['fastapi', 'FastAPI'], ['android-kotlin', 'Android Kotlin'], ['java', 'Java']];

function Toggle({ checked, onChange, title, text }) {
  return <label className="toggle-row option-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}/><span><strong>{title}</strong>{text && <small>{text}</small>}</span></label>;
}

function Summary({ summary }) {
  return <dl className="summary creation-summary">
    <div><dt>Owner / nombre</dt><dd>{summary.fullName}</dd></div><div><dt>Descripción</dt><dd>{summary.description || 'Sin descripción'}</dd></div><div><dt>Visibilidad</dt><dd>{summary.visibility}</dd></div><div><dt>Homepage</dt><dd>{summary.homepage || 'No definida'}</dd></div><div><dt>Topics</dt><dd>{summary.topics.join(', ') || 'Sin topics'}</dd></div><div><dt>README</dt><dd>{summary.readme}</dd></div><div><dt>.gitignore</dt><dd>{summary.gitignore.join(', ') || 'No'}</dd></div><div><dt>Licencia</dt><dd>{summary.license}</dd></div><div><dt>Plantilla</dt><dd>{summary.templateLabel}</dd></div><div><dt>Archivos</dt><dd>{summary.files.join(', ') || 'Repositorio vacío'}</dd></div><div><dt>Funciones GitHub</dt><dd>{Object.entries(summary.features).filter(([, value]) => value).map(([key]) => key).join(', ') || 'Ninguna'}</dd></div><div><dt>Opciones merge</dt><dd>{Object.entries(summary.merge).filter(([, value]) => value).map(([key]) => key).join(', ') || 'Ninguna'}</dd></div>
  </dl>;
}

function CreationProgress({ creation }) {
  const symbols = { pending: '○', running: '◌', completed: '✓', failed: '✕', skipped: '–' };
  return <div className="creation-progress">
    {Object.values(creation.steps).map((item) => <div className={`progress-step ${item.status}`} key={item.id}>
      <span className="progress-symbol">{symbols[item.status]}</span>
      <div><strong>{item.label}</strong>{item.detail && <small>{item.detail}</small>}{item.error && <small>{item.error.message}</small>}</div>
    </div>)}
  </div>;
}

export function CreateRepository({ onAnalyze, onNavigate }) {
  const [form, setForm] = useState(initial);
  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState(null);
  const [creation, setCreation] = useState(null);
  const [approvedInput, setApprovedInput] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [favoriteName, setFavoriteName] = useState('');
  const [topicsInput, setTopicsInput] = useState('');
  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem('repopilot.creationFavorites') || '[]'));
      const partial = JSON.parse(localStorage.getItem('repopilot.partialCreation') || 'null');
      if (partial?.creation?.repository && partial?.input) {
        setCreation(partial.creation); setApprovedInput(partial.input); setStep(7);
      }
    } catch { setFavorites([]); }
  }, []);
  useEffect(() => {
    if (creation?.status !== 'running') return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      api.creationStatus(creation.creationId).then((next) => {
        if (cancelled) return;
        setCreation(next);
        if (next.status === 'partial' && approvedInput) localStorage.setItem('repopilot.partialCreation', JSON.stringify({ creation: next, input: approvedInput }));
        if (next.status === 'completed') localStorage.removeItem('repopilot.partialCreation');
        if (next.status !== 'running') setBusy(false);
      }).catch((err) => { if (!cancelled) { setError(err.message); setBusy(false); } });
    }, 800);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [creation?.creationId, creation?.status, creation?.updatedAt, approvedInput]);
  const validName = /^[A-Za-z0-9._-]{1,100}$/.test(form.name);
  const update = (patch) => { setForm((current) => ({ ...current, ...patch })); setPreview(null); };
  const updateNested = (section, patch) => update({ [section]: { ...form[section], ...patch } });

  const preparePreview = async () => {
    setBusy(true); setError('');
    try {
      const topics = normalizeTopics(topicsInput);
      const input = { ...form, topics };
      const data = await api.previewRepository(input);
      setForm((current) => ({ ...current, topics }));
      setApprovedInput(input);
      setPreview(data); setStep(6);
    }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const next = () => { if (step === 5) preparePreview(); else setStep((value) => Math.min(6, value + 1)); };
  const create = async () => {
    if (!preview || busy) return;
    setBusy(true); setError('');
    try { setCreation(await api.createRepository(preview.previewId)); setStep(7); }
    catch (err) { setError(err.message); setBusy(false); }
  };
  const resume = async () => {
    if (!creation?.repository || busy) return;
    setBusy(true); setError('');
    try {
      let next;
      try { next = await api.resumeCreation(creation.creationId); }
      catch (err) {
        if (err.status !== 404 || !approvedInput) throw err;
        next = await api.recoverCreation(approvedInput, creation.repository.id);
      }
      setCreation(next);
    } catch (err) { setError(err.message); setBusy(false); }
  };
  const saveFavorite = () => {
    const name = favoriteName.trim(); if (!name) return;
    const safe = { ...form, name: '', owner: '', topics: normalizeTopics(topicsInput) };
    const nextFavorites = [...favorites.filter((item) => item.name !== name), { name, config: safe }].slice(-12);
    localStorage.setItem('repopilot.creationFavorites', JSON.stringify(nextFavorites));
    setFavorites(nextFavorites); setFavoriteName('');
  };
  const restart = () => { localStorage.removeItem('repopilot.partialCreation'); setForm(initial); setTopicsInput(''); setStep(1); setPreview(null); setCreation(null); setApprovedInput(null); setBusy(false); setError(''); };
  const canNext = step !== 1 || validName;

  if (step === 7 && creation) {
    const partial = creation.status === 'partial';
    const completed = creation.status === 'completed';
    const failed = creation.status === 'failed';
    return <>
      <PageHeader eyebrow={completed ? 'Repositorio creado' : partial ? 'Configuración incompleta' : 'Creación en progreso'} title={completed ? 'Repositorio creado correctamente' : partial ? 'Creación parcialmente completada' : failed ? 'No se pudo crear el repositorio' : 'Creando repositorio…'} description={completed ? 'GitHub confirmó todas las operaciones solicitadas.' : partial ? 'El repositorio existe. Puede reanudar únicamente las operaciones pendientes.' : failed ? 'GitHub no llegó a confirmar la creación del repositorio.' : 'Cada etapa se actualiza únicamente cuando el backend confirma su resultado.'}/>
      <section className="panel result-panel progress-panel">
        {creation.repository && <><h2>{creation.repository.fullName}</h2><a className="muted" href={creation.repository.htmlUrl} target="_blank" rel="noreferrer">{creation.repository.htmlUrl}</a></>}
        <CreationProgress creation={creation}/>
        {creation.error && <p className="inline-error" data-stage={creation.error.stage}>{creation.error.message}</p>}
        {completed && <dl className="summary"><div><dt>Rama principal</dt><dd>{creation.repository.defaultBranch || 'Creada con el primer archivo'}</dd></div><div><dt>Visibilidad</dt><dd>{creation.repository.visibility}</dd></div><div><dt>Archivos creados</dt><dd>{creation.files.join(', ') || 'Ninguno'}</dd></div><div><dt>Topics</dt><dd>{creation.summary.topics.join(', ') || 'Sin topics'}</dd></div><div><dt>Plantilla</dt><dd>{creation.summary.templateLabel}</dd></div><div><dt>Configuración</dt><dd>Etapas completadas y verificadas por GitHub.</dd></div></dl>}
        {error && <p className="inline-error">{error}</p>}
        <div className="result-actions">{partial && <button className="button primary" onClick={resume} disabled={busy}>{busy ? 'Reanudando…' : 'Reanudar configuración'}</button>}{creation.repository && <a className="button secondary" href={creation.repository.htmlUrl} target="_blank" rel="noreferrer">Abrir repositorio<Icon name="external"/></a>}{completed && <button className="button secondary" onClick={() => onAnalyze(creation.repository.fullName)}>Analizar</button>}<button className="button secondary" onClick={() => onNavigate('repositories')}>Volver a Mis repositorios</button>{completed && <button className="button primary" onClick={restart}>Crear otro</button>}</div>
      </section>
    </>;
  }

  return <>
    <PageHeader eyebrow="Asistente seguro" title="Crear repositorio" description="Configure, revise y confirme. RepoPilot no enviará la creación a GitHub antes del paso final."/>
    <ol className="wizard-steps">{labels.map((label, index) => <li key={label} className={step === index + 1 ? 'active' : step > index + 1 ? 'done' : ''}><span>{index + 1}</span><small>{label}</small></li>)}</ol>
    <section className="panel wizard-panel">
      <div className="favorite-bar"><select defaultValue="" onChange={(event) => { const selected = favorites.find((item) => item.name === event.target.value); if (selected) { setForm({ ...initial, ...selected.config, name: form.name, owner: form.owner }); setTopicsInput(selected.config.topics?.join(', ') || ''); setPreview(null); } }}><option value="">Cargar configuración favorita…</option>{favorites.map((item) => <option key={item.name}>{item.name}</option>)}</select><input value={favoriteName} onChange={(event) => setFavoriteName(event.target.value)} placeholder="Nombre (p. ej. SENA React)"/><button className="button secondary" type="button" onClick={saveFavorite}>Guardar favorita</button></div>
      {step === 1 && <div className="form-grid"><label className="field"><span>Nombre *</span><input value={form.name} maxLength={100} onChange={(event) => update({ name: event.target.value })} placeholder="mi-proyecto"/>{form.name && !validName && <small className="field-error">Use letras, números, punto, guion o guion bajo.</small>}</label><label className="field"><span>Owner (opcional)</span><input value={form.owner} onChange={(event) => update({ owner: event.target.value })} placeholder="Cuenta autenticada u organización"/></label><label className="field full"><span>Descripción</span><textarea value={form.description} maxLength={350} onChange={(event) => update({ description: event.target.value })}/><small>{form.description.length}/350</small></label><label className="field"><span>Homepage</span><input type="url" value={form.homepage} onChange={(event) => update({ homepage: event.target.value })} placeholder="https://ejemplo.com"/></label><label className="field"><span>Topics</span><input value={topicsInput} onChange={(event) => { const value = event.target.value; setTopicsInput(value); update({ topics: normalizeTopics(value) }); }} placeholder="sena, react, api"/></label><fieldset className="field full"><legend>Visibilidad</legend><div className="choice-grid"><label className={`choice ${form.visibility === 'private' ? 'selected' : ''}`}><input type="radio" checked={form.visibility === 'private'} onChange={() => update({ visibility: 'private' })}/><strong>Privado</strong><span>Solo personas autorizadas.</span></label><label className={`choice ${form.visibility === 'public' ? 'selected' : ''}`}><input type="radio" checked={form.visibility === 'public'} onChange={() => update({ visibility: 'public' })}/><strong>Público</strong><span>Visible para cualquier persona.</span></label></div></fieldset></div>}
      {step === 2 && <div className="form-grid"><div className="field full"><Toggle checked={form.readme.enabled} onChange={(enabled) => updateNested('readme', { enabled })} title="Crear README" text="Puede usar contenido personalizado."/></div>{form.readme.enabled && <label className="field full"><span>README personalizado (opcional)</span><textarea className="code-editor short" value={form.readme.content} onChange={(event) => updateNested('readme', { content: event.target.value })} placeholder="# Mi proyecto…"/></label>}<fieldset className="field full"><legend>Plantillas .gitignore combinables</legend><div className="checkbox-list template-checks">{gitignores.map((name) => <label key={name}><input type="checkbox" checked={form.gitignoreTemplates.includes(name)} onChange={(event) => update({ gitignoreTemplates: event.target.checked ? [...form.gitignoreTemplates, name] : form.gitignoreTemplates.filter((item) => item !== name) })}/><span>{name}</span></label>)}</div></fieldset><label className="field"><span>Licencia oficial</span><select value={form.license} onChange={(event) => update({ license: event.target.value })}><option value="none">Sin licencia</option><option value="mit">MIT</option><option value="apache-2.0">Apache 2.0</option><option value="gpl-3.0">GPL v3</option><option value="bsd-3-clause">BSD 3-Clause</option><option value="mpl-2.0">MPL 2.0</option></select><small>Se obtiene desde la API oficial de GitHub.</small></label></div>}
      {step === 3 && <div className="option-grid">{[['issues', 'Issues', 'Seguimiento de tareas'], ['projects', 'Projects', 'Tableros de proyecto'], ['wiki', 'Wiki', 'Documentación colaborativa'], ['discussions', 'Discussions', 'Conversaciones de la comunidad']].map(([key, title, text]) => <Toggle key={key} checked={form.features[key]} onChange={(value) => updateNested('features', { [key]: value })} title={title} text={text}/>)}</div>}
      {step === 4 && <div className="option-grid">{[['mergeCommit', 'Merge commits'], ['squash', 'Squash merge'], ['rebase', 'Rebase merge'], ['deleteBranch', 'Eliminar branch después del merge']].map(([key, title]) => <Toggle key={key} checked={form.merge[key]} onChange={(value) => updateNested('merge', { [key]: value })} title={title}/>)}</div>}
      {step === 5 && <div className="form-grid"><fieldset className="field full"><legend>Origen del proyecto</legend><div className="choice-grid three"><label className={`choice ${form.template.mode === 'empty' ? 'selected' : ''}`}><input type="radio" checked={form.template.mode === 'empty'} onChange={() => updateNested('template', { mode: 'empty' })}/><strong>Sin plantilla</strong><span>Inicialización elegida en el paso 2.</span></label><label className={`choice ${form.template.mode === 'github' ? 'selected' : ''}`}><input type="radio" checked={form.template.mode === 'github'} onChange={() => updateNested('template', { mode: 'github' })}/><strong>GitHub Template</strong><span>Usa el endpoint oficial.</span></label><label className={`choice ${form.template.mode === 'repopilot' ? 'selected' : ''}`}><input type="radio" checked={form.template.mode === 'repopilot'} onChange={() => updateNested('template', { mode: 'repopilot' })}/><strong>Plantilla RepoPilot</strong><span>Base pequeña y funcional.</span></label></div></fieldset>{form.template.mode === 'github' && <label className="field full"><span>Repositorio template</span><input value={form.template.github} onChange={(event) => updateNested('template', { github: event.target.value })} placeholder="owner/template o URL de GitHub"/></label>}{form.template.mode === 'repopilot' && <label className="field"><span>Plantilla propia</span><select value={form.template.repopilot} onChange={(event) => updateNested('template', { repopilot: event.target.value })}>{repoTemplates.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>}{form.template.mode !== 'github' && <fieldset className="field full"><legend>Archivos opcionales</legend><div className="checkbox-list template-checks">{[['readme', 'README.md'], ['gitignore', '.gitignore'], ['envExample', '.env.example'], ['contributing', 'CONTRIBUTING.md'], ['codeOfConduct', 'CODE_OF_CONDUCT.md'], ['security', 'SECURITY.md']].map(([key, label]) => <label key={key}><input type="checkbox" checked={form.template.optionalFiles[key]} onChange={(event) => updateNested('template', { optionalFiles: { ...form.template.optionalFiles, [key]: event.target.checked } })}/><span>{label}</span></label>)}</div></fieldset>}</div>}
      {step === 6 && preview && <><div className="preview-expiration">Vista previa válida hasta {new Date(preview.expiresAt).toLocaleTimeString('es-CO')}</div><Summary summary={preview.summary}/></>}
      {error && <p className="inline-error">{error}</p>}
      <div className="wizard-actions"><button className="button secondary" disabled={step === 1 || busy} onClick={() => { setStep((value) => value - 1); setError(''); }}>Volver</button>{step < 6 ? <button className="button primary" disabled={!canNext || busy || (step === 5 && form.template.mode === 'github' && !form.template.github)} onClick={next}>{busy ? 'Preparando…' : step === 5 ? 'Generar vista previa' : 'Continuar'}</button> : <button className="button primary" disabled={busy || !preview} onClick={create}>{busy ? 'Creando…' : 'Crear repositorio'}</button>}</div>
    </section>
  </>;
}
