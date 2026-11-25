import { getOctokit } from '../config/github.js';

export function mapRepository(repo) {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    owner: repo.owner.login,
    private: repo.private,
    description: repo.description,
    language: repo.language,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    openIssues: repo.open_issues_count,
    defaultBranch: repo.default_branch,
    updatedAt: repo.updated_at,
    createdAt: repo.created_at,
    pushedAt: repo.pushed_at,
    htmlUrl: repo.html_url,
    permissions: repo.permissions || null,
    canWrite: Boolean(repo.permissions?.push || repo.permissions?.admin || repo.permissions?.maintain),
  };
}

export function repositoryCapabilities(repo) {
  const permissions = repo.permissions || {};
  const canWrite = Boolean(permissions.push || permissions.admin || permissions.maintain);
  return {
    canRead: true,
    canWrite,
    canAdmin: Boolean(permissions.admin),
    permissions: Object.keys(permissions).length ? permissions : null,
    mode: canWrite ? 'write' : 'read-only',
  };
}

export async function getAuthenticatedContext() {
  const octokit = getOctokit();
  const [userResponse, rateResponse] = await Promise.all([
    octokit.rest.users.getAuthenticated(),
    octokit.rest.rateLimit.get(),
  ]);
  const user = userResponse.data;
  const core = rateResponse.data.resources.core;
  return {
    connected: true,
    user: {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
      htmlUrl: user.html_url,
      publicRepos: user.public_repos,
      ownedPrivateRepos: user.owned_private_repos ?? null,
    },
    token: {
      scopes: (userResponse.headers['x-oauth-scopes'] || '').split(',').map((scope) => scope.trim()).filter(Boolean),
      note: 'Los tokens de acceso específico no siempre exponen sus permisos mediante cabeceras.',
    },
    rateLimit: {
      limit: core.limit,
      remaining: core.remaining,
      used: core.used,
      resetAt: new Date(core.reset * 1000).toISOString(),
    },
  };
}

export async function listAllRepositories() {
  const octokit = getOctokit();
  const repositories = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    affiliation: 'owner,collaborator,organization_member',
    visibility: 'all',
    per_page: 100,
  });
  return repositories.map(mapRepository);
}

export async function assertRepositoryAccess(owner, repo, { write = false, octokit = getOctokit() } = {}) {
  const { data } = await octokit.rest.repos.get({ owner, repo });
  if (write && !data.permissions?.push && !data.permissions?.admin) {
    const error = new Error('El token no tiene permiso de escritura en este repositorio.');
    error.status = 403;
    error.code = 'WRITE_PERMISSION_REQUIRED';
    throw error;
  }
  return data;
}

export async function getDashboard() {
  const octokit = getOctokit();
  const [auth, repositories, issues] = await Promise.all([
    getAuthenticatedContext(),
    listAllRepositories(),
    octokit.paginate(octokit.rest.issues.listForAuthenticatedUser, {
      filter: 'all', state: 'open', per_page: 100,
    }),
  ]);
  return {
    ...auth,
    repositories: {
      total: repositories.length,
      public: repositories.filter((repo) => !repo.private).length,
      private: repositories.filter((repo) => repo.private).length,
    },
    openIssues: issues.filter((issue) => !issue.pull_request).length,
  };
}
