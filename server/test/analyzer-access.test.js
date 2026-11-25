import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRepository } from '../src/services/analyzerService.js';
import { assertRepositoryAccess } from '../src/services/githubService.js';

function mockOctokit(permissions) {
  const repo = { id: 1, name: 'demo', full_name: 'owner/demo', owner: { login: 'owner' }, private: false, description: '', language: 'JavaScript', stargazers_count: 0, forks_count: 0, open_issues_count: 0, default_branch: 'main', updated_at: '', created_at: '', pushed_at: '', html_url: 'https://github.com/owner/demo', permissions };
  const octokit = { rest: {
    repos: {
      get: async () => ({ data: repo }), listLanguages: async () => ({ data: { JavaScript: 10 } }),
      listBranches: async () => ({ data: [] }), listCommits: async () => ({ data: [] }),
      getContent: async () => { throw Object.assign(new Error('Not Found'), { status: 404 }); },
      getReadme: async () => { throw Object.assign(new Error('Not Found'), { status: 404 }); },
    },
    search: { issuesAndPullRequests: async () => ({ data: { total_count: 0, items: [] } }) },
  } };
  return octokit;
}

test('analizador habilita escritura para repositorio con permiso push', async () => {
  const result = await analyzeRepository('owner', 'demo', mockOctokit({ pull: true, push: true }));
  assert.equal(result.mode, 'write');
  assert.equal(result.access.canWrite, true);
});

test('analizador acepta público externo en modo solo lectura', async () => {
  const result = await analyzeRepository('external', 'demo', mockOctokit(undefined));
  assert.equal(result.mode, 'read-only');
  assert.equal(result.access.canWrite, false);
});

test('backend bloquea escritura cuando GitHub no concede permisos', async () => {
  await assert.rejects(
    () => assertRepositoryAccess('external', 'demo', { write: true, octokit: mockOctokit({ pull: true, push: false }) }),
    (error) => error.status === 403 && error.code === 'WRITE_PERMISSION_REQUIRED'
  );
});
