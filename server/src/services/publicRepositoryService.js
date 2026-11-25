import { getOctokit } from '../config/github.js';
import { repositoryCapabilities } from './githubService.js';

const cache = new Map();
const CACHE_TTL = 60_000;
const DEPENDENCY_NAMES = new Set([
  'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'requirements.txt', 'pyproject.toml', 'poetry.lock', 'pom.xml',
  'build.gradle', 'build.gradle.kts', 'composer.json', 'gemfile',
  'go.mod', 'cargo.toml',
]);

function cached(key, loader) {
  const current = cache.get(key);
  if (current && current.expiresAt > Date.now()) return current.value;
  const value = Promise.resolve().then(loader).catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL });
  return value;
}

export function parseRepositoryReference(value) {
  const input = String(value || '').trim();
  let match = input.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/#?]+)(?:[/?#].*)?$/i);
  if (!match) match = input.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/i, '') };
}

function publicError(error, owner, repo) {
  if (error.status !== 404) throw error;
  throw Object.assign(
    new Error(`No se encontró ${owner}/${repo}. Puede no existir, ser privado o no estar disponible para el token.`),
    { status: 404, code: 'REPOSITORY_NOT_FOUND_OR_PRIVATE' }
  );
}

function compactRepository(repo) {
  return {
    id: repo.id, owner: repo.owner?.login, avatarUrl: repo.owner?.avatar_url,
    name: repo.name, fullName: repo.full_name, description: repo.description,
    private: repo.private, visibility: repo.visibility || (repo.private ? 'private' : 'public'),
    language: repo.language, topics: repo.topics || [], stars: repo.stargazers_count,
    forks: repo.forks_count, watchers: repo.subscribers_count ?? repo.watchers_count,
    openIssues: repo.open_issues_count, archived: repo.archived, fork: repo.fork,
    template: repo.is_template, updatedAt: repo.updated_at, htmlUrl: repo.html_url,
    defaultBranch: repo.default_branch,
  };
}

function detailedRepository(repo) {
  return {
    ...compactRepository(repo), homepage: repo.homepage, size: repo.size,
    createdAt: repo.created_at, pushedAt: repo.pushed_at,
    license: repo.license ? { key: repo.license.key, name: repo.license.name, spdxId: repo.license.spdx_id } : null,
    ownerType: repo.owner?.type, hasIssues: repo.has_issues, hasProjects: repo.has_projects,
    hasWiki: repo.has_wiki, hasDiscussions: repo.has_discussions,
  };
}

function percentages(languages) {
  const total = Object.values(languages).reduce((sum, bytes) => sum + bytes, 0);
  return Object.entries(languages).map(([name, bytes]) => ({
    name, bytes, percentage: total ? Number(((bytes / total) * 100).toFixed(2)) : 0,
  }));
}

function fileContent(data) {
  return data?.content ? Buffer.from(data.content, 'base64').toString('utf8') : '';
}

async function optional(loader, unavailable = null) {
  try { return await loader(); } catch (error) {
    if ([403, 404, 409].includes(error.status)) return unavailable;
    throw error;
  }
}

export async function searchPublicRepositories(input, octokit = getOctokit()) {
  const reference = parseRepositoryReference(input.q);
  const cacheKey = `search:${JSON.stringify(input)}`;
  return cached(cacheKey, async () => {
    if (reference && !input.language && !input.topics) {
      try {
        const { data } = await octokit.rest.repos.get(reference);
        return { items: [compactRepository(data)], pagination: { page: 1, perPage: 1, total: 1, pages: 1 }, interpretedAs: 'repository' };
      } catch (error) { publicError(error, reference.owner, reference.repo); }
    }

    let baseQuery = input.q;
    let interpretedAs = 'search';
    if (/^[A-Za-z0-9-]+$/.test(baseQuery)) {
      const account = await optional(() => octokit.rest.users.getByUsername({ username: baseQuery }));
      if (account?.data) {
        baseQuery = `${account.data.type === 'Organization' ? 'org' : 'user'}:${account.data.login}`;
        interpretedAs = account.data.type === 'Organization' ? 'organization' : 'user';
      }
    }
    const topicQueries = input.topics.split(',').map((item) => item.trim()).filter(Boolean).map((topic) => `topic:${topic}`);
    const q = [baseQuery, input.language && `language:${input.language}`, ...topicQueries].filter(Boolean).join(' ');
    const params = { q, page: input.page, per_page: input.perPage, order: input.order };
    if (input.sort !== 'best-match') params.sort = input.sort;
    const { data } = await octokit.rest.search.repos(params);
    return {
      items: data.items.map(compactRepository), interpretedAs,
      pagination: { page: input.page, perPage: input.perPage, total: Math.min(data.total_count, 1000), pages: Math.ceil(Math.min(data.total_count, 1000) / input.perPage) },
      incomplete: data.incomplete_results,
    };
  });
}

export async function getPublicRepository(owner, repo, octokit = getOctokit()) {
  return cached(`detail:${owner}/${repo}`, async () => {
    let repository;
    try { repository = (await octokit.rest.repos.get({ owner, repo })).data; }
    catch (error) { publicError(error, owner, repo); }
    const base = { owner, repo, per_page: 10 };
    const [languages, root, readme, gitignore, license, branches, commits, tags, releases, issues, pulls, workflows] = await Promise.all([
      octokit.rest.repos.listLanguages({ owner, repo }),
      optional(() => octokit.rest.repos.getContent({ owner, repo, path: '', ref: repository.default_branch }), { data: [] }),
      optional(() => octokit.rest.repos.getReadme({ owner, repo, ref: repository.default_branch })),
      optional(() => octokit.rest.repos.getContent({ owner, repo, path: '.gitignore', ref: repository.default_branch })),
      optional(() => octokit.rest.licenses.getForRepo({ owner, repo, ref: repository.default_branch })),
      octokit.rest.repos.listBranches(base),
      optional(() => octokit.rest.repos.listCommits(base), { data: [] }),
      octokit.rest.repos.listTags(base), octokit.rest.repos.listReleases(base),
      optional(() => octokit.rest.issues.listForRepo({ ...base, state: 'open' }), { data: [] }),
      optional(() => octokit.rest.pulls.list({ ...base, state: 'open' }), { data: [] }),
      optional(() => octokit.rest.actions.listRepoWorkflows({ ...base }), null),
    ]);
    const rootItems = Array.isArray(root.data) ? root.data : [];
    return {
      repository: detailedRepository(repository), access: repositoryCapabilities(repository),
      languages: { bytes: languages.data, items: percentages(languages.data) },
      readme: readme ? { path: readme.data.path, content: fileContent(readme.data), htmlUrl: readme.data.html_url } : null,
      gitignore: gitignore ? { path: gitignore.data.path, content: fileContent(gitignore.data), htmlUrl: gitignore.data.html_url } : null,
      licenseFile: license ? { path: license.data.path, content: fileContent(license.data), htmlUrl: license.data.html_url } : null,
      root: rootItems.slice(0, 100).map((item) => ({ name: item.name, path: item.path, type: item.type, size: item.size, htmlUrl: item.html_url })),
      dependencyFiles: rootItems.filter((item) => item.type === 'file' && DEPENDENCY_NAMES.has(item.name.toLowerCase())).map((item) => item.name),
      branches: branches.data.map((item) => ({ name: item.name, protected: item.protected })),
      commits: commits.data.map((item) => ({ sha: item.sha, message: item.commit.message, author: item.commit.author?.name, date: item.commit.author?.date, htmlUrl: item.html_url })),
      tags: tags.data.map((item) => ({ name: item.name, sha: item.commit.sha, tarballUrl: item.tarball_url })),
      releases: releases.data.map((item) => ({ id: item.id, name: item.name || item.tag_name, tag: item.tag_name, publishedAt: item.published_at, draft: item.draft, prerelease: item.prerelease, htmlUrl: item.html_url })),
      issues: issues.data.filter((item) => !item.pull_request).map((item) => ({ number: item.number, title: item.title, author: item.user?.login, createdAt: item.created_at, htmlUrl: item.html_url })),
      pullRequests: pulls.data.map((item) => ({ number: item.number, title: item.title, author: item.user?.login, createdAt: item.created_at, htmlUrl: item.html_url })),
      workflows: workflows ? { available: true, items: workflows.data.workflows.map((item) => ({ id: item.id, name: item.name, state: item.state, path: item.path, htmlUrl: item.html_url })) } : { available: false, items: [] },
      limits: { root: 100, activity: 10 },
    };
  });
}

const RESOURCE_LOADERS = {
  languages: (octokit, params) => octokit.rest.repos.listLanguages(params),
  commits: (octokit, params) => octokit.rest.repos.listCommits(params),
  branches: (octokit, params) => octokit.rest.repos.listBranches(params),
  releases: (octokit, params) => octokit.rest.repos.listReleases(params),
  tags: (octokit, params) => octokit.rest.repos.listTags(params),
  issues: (octokit, params) => octokit.rest.issues.listForRepo({ ...params, state: 'open' }),
  pulls: (octokit, params) => octokit.rest.pulls.list({ ...params, state: 'open' }),
  workflows: (octokit, params) => octokit.rest.actions.listRepoWorkflows(params),
};

export async function getRepositoryResource(owner, repo, resource, pagination, octokit = getOctokit()) {
  const loader = RESOURCE_LOADERS[resource];
  if (!loader) throw Object.assign(new Error('Recurso de exploración no admitido.'), { status: 404, code: 'EXPLORE_RESOURCE_NOT_FOUND' });
  await optional(() => octokit.rest.repos.get({ owner, repo })).then((value) => {
    if (!value) throw Object.assign(new Error('Repositorio no encontrado o privado.'), { status: 404, code: 'REPOSITORY_NOT_FOUND_OR_PRIVATE' });
  });
  const params = { owner, repo, page: pagination.page, per_page: pagination.perPage };
  const { data } = await loader(octokit, params);
  const items = resource === 'workflows' ? data.workflows : data;
  return { items, pagination: { page: pagination.page, perPage: pagination.perPage, hasMore: items.length === pagination.perPage } };
}
