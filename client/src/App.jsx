import { useEffect, useState } from 'react';
import { api } from './services/api.js';
import { Layout } from './components/Layout.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Repositories } from './pages/Repositories.jsx';
import { Explore } from './pages/Explore.jsx';
import { CreateRepository } from './pages/CreateRepository.jsx';
import { Analyzer } from './pages/Analyzer.jsx';
import { Issues } from './pages/Issues.jsx';
import { Settings } from './pages/Settings.jsx';

const validPages = new Set(['dashboard', 'repositories', 'explore', 'create', 'analyzer', 'issues', 'settings']);

export default function App() {
  const initial = window.location.hash.slice(1) || 'dashboard';
  const [page, setPage] = useState(validPages.has(initial) ? initial : 'dashboard');
  const [auth, setAuth] = useState(null); const [analysisRepo, setAnalysisRepo] = useState('');
  useEffect(() => { api.auth().then(setAuth).catch(() => setAuth({ connected: false })); }, []);
  const navigate = (next) => { setPage(next); window.location.hash = next; window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const analyze = (repo) => { setAnalysisRepo(repo); navigate('analyzer'); };
  const pages = {
    dashboard: <Dashboard onNavigate={navigate}/>, repositories: <Repositories onAnalyze={analyze}/>,
    explore: <Explore onAnalyze={analyze}/>, create: <CreateRepository onAnalyze={analyze} onNavigate={navigate}/>, analyzer: <Analyzer key={analysisRepo} initialRepo={analysisRepo}/>,
    issues: <Issues/>, settings: <Settings/>,
  };
  return <Layout current={page} onNavigate={navigate} auth={auth}>{pages[page]}</Layout>;
}
