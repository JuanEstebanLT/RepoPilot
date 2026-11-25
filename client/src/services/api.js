const API_ROOT = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Repo-Manager': 'local-client',
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || 'No fue posible completar la solicitud.');
    error.code = data.error?.code;
    error.details = data.error?.details;
    error.status = response.status;
    throw error;
  }
  return data;
}

const query = (params) => new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== '')).toString();

export const api = {
  health: () => request('/health'),
  auth: () => request('/auth/status'),
  dashboard: () => request('/dashboard'),
  repositories: (params = {}) => request(`/repositories?${query(params)}`),
  previewRepository: (payload) => request('/repositories/preview', { method: 'POST', body: JSON.stringify(payload) }),
  createRepository: (previewId) => request('/repositories', { method: 'POST', body: JSON.stringify({ previewId, confirmed: true }) }),
  creationStatus: (creationId) => request(`/repository-creations/${creationId}`),
  resumeCreation: (creationId) => request(`/repository-creations/${creationId}/resume`, { method: 'POST', body: '{}' }),
  recoverCreation: (input, repositoryId) => request('/repository-creations/recover', { method: 'POST', body: JSON.stringify({ input, repositoryId, confirmed: true }) }),
  explore: (params) => request(`/explore/search?${query(params)}`),
  exploreRepository: (owner, repo) => request(`/explore/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`),
  exploreResource: (owner, repo, resource, params = {}) => request(`/explore/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${resource}?${query(params)}`),
  issues: (owner, repo, params = {}) => request(`/repositories/${owner}/${repo}/issues?${query(params)}`),
  labels: (owner, repo) => request(`/repositories/${owner}/${repo}/labels`),
  createIssue: (owner, repo, payload) => request(`/repositories/${owner}/${repo}/issues`, { method: 'POST', body: JSON.stringify(payload) }),
  analyze: (owner, repo) => request(`/repositories/${owner}/${repo}/analysis`),
  templates: (owner, repo) => request(`/repositories/${owner}/${repo}/templates`),
  preview: (payload) => request('/actions/preview', { method: 'POST', body: JSON.stringify(payload) }),
  execute: (previewId) => request('/actions/execute', { method: 'POST', body: JSON.stringify({ previewId, confirmed: true }) }),
};
