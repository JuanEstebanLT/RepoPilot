import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

export function RepositorySelector({ value, onChange, label = 'Repositorio' }) {
  const [repos, setRepos] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { api.repositories({ perPage: 100, sort: 'updated' }).then((data) => setRepos(data.items)).catch((err) => setError(err.message)); }, []);
  return <label className="field"><span>{label}</span><input list="repository-options" value={value} onChange={(event) => onChange(event.target.value)} placeholder="owner/repository (propio o público)"/><datalist id="repository-options">{repos.map((repo) => <option key={repo.id} value={repo.fullName}>{repo.private ? 'privado' : 'público'}</option>)}</datalist>{error && <small className="field-error">{error}</small>}</label>;
}
