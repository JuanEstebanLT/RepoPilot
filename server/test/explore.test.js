import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRepositoryReference, searchPublicRepositories } from '../src/services/publicRepositoryService.js';
import { repositoryCapabilities } from '../src/services/githubService.js';

function repository(owner = 'microsoft', name = 'vscode') {
  return {
    id: 1, name, full_name: `${owner}/${name}`, owner: { login: owner, avatar_url: 'https://example.test/avatar.png' },
    private: false, visibility: 'public', description: 'Editor', language: 'TypeScript', topics: ['editor'],
    stargazers_count: 100, forks_count: 20, watchers_count: 100, open_issues_count: 3,
    archived: false, fork: false, is_template: false, updated_at: '2026-01-01', html_url: `https://github.com/${owner}/${name}`,
    default_branch: 'main', permissions: undefined,
  };
}

test('interpreta owner/repo y URL completa de GitHub', () => {
  assert.deepEqual(parseRepositoryReference('microsoft/vscode'), { owner: 'microsoft', repo: 'vscode' });
  assert.deepEqual(parseRepositoryReference('https://github.com/facebook/react'), { owner: 'facebook', repo: 'react' });
});

test('resuelve owner/repo directamente sin usar listAllRepositories', async () => {
  let called;
  const octokit = { rest: { repos: { get: async (params) => { called = params; return { data: repository() }; } } } };
  const result = await searchPublicRepositories({ q: 'microsoft/vscode', language: '', topics: '', page: 1, perPage: 12, sort: 'best-match', order: 'desc' }, octokit);
  assert.deepEqual(called, { owner: 'microsoft', repo: 'vscode' });
  assert.equal(result.interpretedAs, 'repository');
  assert.equal(result.items[0].fullName, 'microsoft/vscode');
});

test('acepta URL completa como repositorio exacto', async () => {
  const octokit = { rest: { repos: { get: async () => ({ data: repository('facebook', 'react') }) } } };
  const result = await searchPublicRepositories({ q: 'https://github.com/facebook/react', language: '', topics: '', page: 1, perPage: 12, sort: 'best-match', order: 'desc' }, octokit);
  assert.equal(result.items[0].fullName, 'facebook/react');
});

test('interpreta cuentas de usuario y organización', async () => {
  const queries = [];
  const octokit = { rest: {
    users: { getByUsername: async ({ username }) => ({ data: { login: username, type: username === 'acme-org' ? 'Organization' : 'User' } }) },
    search: { repos: async ({ q }) => { queries.push(q); return { data: { items: [], total_count: 0, incomplete_results: false } }; } },
  } };
  const base = { language: '', topics: '', page: 1, perPage: 12, sort: 'best-match', order: 'desc' };
  assert.equal((await searchPublicRepositories({ ...base, q: 'octocat' }, octokit)).interpretedAs, 'user');
  assert.equal((await searchPublicRepositories({ ...base, q: 'acme-org' }, octokit)).interpretedAs, 'organization');
  assert.deepEqual(queries, ['user:octocat', 'org:acme-org']);
});

test('combina búsqueda de texto, lenguaje y topics con límites', async () => {
  let request;
  const octokit = { rest: { search: { repos: async (params) => { request = params; return { data: { items: [repository()], total_count: 1, incomplete_results: false } }; } } } };
  await searchPublicRepositories({ q: 'editor rápido', language: 'TypeScript', topics: 'editor,tools', page: 2, perPage: 10, sort: 'stars', order: 'desc' }, octokit);
  assert.equal(request.q, 'editor rápido language:TypeScript topic:editor topic:tools');
  assert.equal(request.per_page, 10);
  assert.equal(request.page, 2);
});

test('diferencia repositorio inexistente o privado', async () => {
  const octokit = { rest: { repos: { get: async () => { throw Object.assign(new Error('Not Found'), { status: 404 }); } } } };
  await assert.rejects(
    () => searchPublicRepositories({ q: 'missing/repo', language: '', topics: '', page: 1, perPage: 12, sort: 'best-match', order: 'desc' }, octokit),
    (error) => error.code === 'REPOSITORY_NOT_FOUND_OR_PRIVATE' && error.status === 404
  );
});

test('los permisos reales determinan el modo de acceso', () => {
  assert.equal(repositoryCapabilities({ permissions: { push: true } }).mode, 'write');
  assert.equal(repositoryCapabilities({ permissions: { pull: true, push: false } }).mode, 'read-only');
  assert.equal(repositoryCapabilities({}).mode, 'read-only');
});
