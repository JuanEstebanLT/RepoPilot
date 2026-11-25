import test from 'node:test';
import assert from 'node:assert/strict';
import { creationDraftSchema } from '../src/validators/schemas.js';
import { createRepositoryPreview } from '../src/services/repositoryCreationService.js';
import {
  executeRepositoryPreview, getRepositoryCreation, recoverRepositoryCreation,
  resumeRepositoryCreation,
} from '../src/services/repositoryCreationJobService.js';

const optionalFiles = { readme: false, gitignore: false, envExample: false, license: false, contributing: false, codeOfConduct: false, security: false };

function input(overrides = {}) {
  return creationDraftSchema.parse({
    name: 'progreso-prueba', owner: 'tester', description: 'Proyecto', visibility: 'private',
    homepage: '', topics: ['sena', 'react'], readme: { enabled: true, content: '# Proyecto\n' },
    gitignoreTemplates: ['Node'], license: 'mit',
    features: { issues: true, projects: false, wiki: false, discussions: true },
    merge: { mergeCommit: false, squash: true, rebase: true, deleteBranch: true },
    template: { mode: 'repopilot', github: '', repopilot: 'react-vite', optionalFiles },
    ...overrides,
  });
}

function githubMock({ failStage = null } = {}) {
  const files = new Map();
  let topics = [];
  let createCount = 0;
  let updateCount = 0;
  let topicWriteCount = 0;
  let fileWriteCount = 0;
  const repo = {
    id: 501, name: 'progreso-prueba', full_name: 'tester/progreso-prueba',
    owner: { login: 'tester' }, private: true, visibility: 'private', description: '', homepage: '',
    language: null, stargazers_count: 0, forks_count: 0, open_issues_count: 0,
    default_branch: 'main', updated_at: '', created_at: '', pushed_at: '',
    html_url: 'https://github.com/tester/progreso-prueba', permissions: { admin: true, push: true },
    has_issues: true, has_projects: true, has_wiki: true, has_discussions: false,
    allow_merge_commit: true, allow_squash_merge: true, allow_rebase_merge: true,
    delete_branch_on_merge: false,
  };
  let currentFailure = failStage;
  const forbidden = (stage) => {
    if (currentFailure !== stage) return;
    currentFailure = null;
    throw Object.assign(new Error('Forbidden'), { status: 403, code: 'FORBIDDEN' });
  };
  const octokit = { rest: {
    users: { getAuthenticated: async () => ({ data: { login: 'tester' } }) },
    repos: {
      createForAuthenticatedUser: async () => { createCount += 1; return { data: repo }; },
      get: async () => ({ data: repo }),
      update: async (params) => {
        if (params.has_discussions !== undefined) forbidden('discussions');
        else if (params.allow_merge_commit !== undefined) forbidden('merge');
        else forbidden('settings');
        updateCount += 1;
        Object.assign(repo, params);
        return { data: repo };
      },
      getAllTopics: async () => ({ data: { names: topics } }),
      replaceAllTopics: async ({ names }) => { forbidden('topics'); topicWriteCount += 1; topics = [...names]; return { data: { names: topics } }; },
      getContent: async ({ path }) => {
        if (!files.has(path)) throw Object.assign(new Error('Not Found'), { status: 404 });
        return { data: { type: 'file', path, sha: `sha-${path}`, content: Buffer.from(files.get(path)).toString('base64') } };
      },
      createOrUpdateFileContents: async ({ path, content }) => {
        forbidden('contents'); fileWriteCount += 1;
        files.set(path, Buffer.from(content, 'base64').toString('utf8'));
        return { data: { content: { path }, commit: { sha: `commit-${fileWriteCount}` } } };
      },
    },
    gitignore: { getTemplate: async () => ({ data: { source: 'node_modules/\ndist/' } }) },
    licenses: { get: async () => ({ data: { body: 'MIT official body\n' } }) },
  } };
  return {
    octokit, repo, files,
    counts: () => ({ createCount, updateCount, topicWriteCount, fileWriteCount }),
  };
}

async function previewFor(value, octokit) {
  return createRepositoryPreview(value, octokit);
}

async function waitForJob(creationId) {
  for (let index = 0; index < 30; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
    const state = getRepositoryCreation(creationId);
    if (state.status !== 'running') return state;
  }
  throw new Error('El job no terminó durante la prueba.');
}

test('creación completa informa todas las etapas requeridas', async () => {
  const mock = githubMock();
  const preview = await previewFor(input(), mock.octokit);
  const result = await executeRepositoryPreview(preview.previewId, mock.octokit);
  assert.equal(result.status, 'completed');
  assert.equal(result.steps.repository.status, 'completed');
  assert.equal(result.steps.settings.status, 'completed');
  assert.equal(result.steps.topics.status, 'completed');
  assert.equal(result.steps.template.status, 'completed');
  assert.equal(result.steps.readme.status, 'completed');
  assert.equal(result.steps.gitignore.status, 'completed');
  assert.equal(result.steps.license.status, 'completed');
  assert.equal(result.steps.discussions.status, 'completed');
  assert.equal(result.steps.merge.status, 'completed');
  assert.ok(result.files.includes('vite.config.js'));
  assert.ok(result.files.includes('README.md'));
});

test('fallo 403 en topics conserva el repositorio y produce estado parcial', async () => {
  const mock = githubMock({ failStage: 'topics' });
  const preview = await previewFor(input(), mock.octokit);
  const result = await executeRepositoryPreview(preview.previewId, mock.octokit);
  assert.equal(result.status, 'partial');
  assert.equal(result.repository.fullName, 'tester/progreso-prueba');
  assert.equal(result.steps.repository.status, 'completed');
  assert.equal(result.steps.topics.status, 'failed');
  assert.equal(result.steps.template.status, 'pending');
  assert.equal(result.error.stage, 'topics');
  assert.match(result.error.message, /configuración de topics/);
});

test('si GitHub no crea el repositorio el estado final es failed', async () => {
  const mock = githubMock();
  mock.octokit.rest.repos.createForAuthenticatedUser = async () => {
    throw Object.assign(new Error('Validation Failed: name already exists'), {
      status: 422, response: { data: { message: 'name already exists' } },
    });
  };
  const preview = await previewFor(input(), mock.octokit);
  const result = await executeRepositoryPreview(preview.previewId, mock.octokit);
  assert.equal(result.status, 'failed');
  assert.equal(result.repository, null);
  assert.equal(result.steps.repository.status, 'failed');
  assert.equal(result.error.stage, 'repository');
  assert.equal(result.error.code, 'REPOSITORY_NAME_TAKEN');
});

test('reanudar continúa desde topics sin recrear repositorio ni repetir settings', async () => {
  const mock = githubMock({ failStage: 'topics' });
  const preview = await previewFor(input(), mock.octokit);
  const partial = await executeRepositoryPreview(preview.previewId, mock.octokit);
  const before = mock.counts();
  const running = resumeRepositoryCreation(partial.creationId, mock.octokit);
  assert.equal(running.status, 'running');
  const completed = await waitForJob(partial.creationId);
  const after = mock.counts();
  assert.equal(completed.status, 'completed');
  assert.equal(after.createCount, 1);
  assert.equal(after.updateCount - before.updateCount, 2); // Discussions y merge pendientes.
  assert.equal(after.topicWriteCount, 1);
});

test('recuperación reconstruye el job e identifica operaciones ya aplicadas', async () => {
  const mock = githubMock();
  const value = input();
  const preview = await previewFor(value, mock.octokit);
  const completed = await executeRepositoryPreview(preview.previewId, mock.octokit);
  const before = mock.counts();
  const running = await recoverRepositoryCreation({ input: value, repositoryId: mock.repo.id }, mock.octokit);
  const recovered = await waitForJob(running.creationId);
  const after = mock.counts();
  assert.equal(recovered.status, 'completed');
  assert.equal(after.createCount, before.createCount);
  assert.equal(after.topicWriteCount, before.topicWriteCount);
  assert.equal(after.fileWriteCount, before.fileWriteCount);
  assert.equal(after.updateCount, before.updateCount);
  assert.equal(completed.repository.id, recovered.repository.id);
});

for (const [stage, expected] of [
  ['settings', 'configuración general'],
  ['contents', 'README.md'],
]) {
  test(`fallo 403 en ${stage} conserva el repositorio y la etapa específica`, async () => {
    const mock = githubMock({ failStage: stage });
    const value = stage === 'contents'
      ? input({ template: { mode: 'empty', github: '', repopilot: 'empty', optionalFiles }, topics: [], gitignoreTemplates: [], license: 'none' })
      : input();
    const preview = await previewFor(value, mock.octokit);
    const result = await executeRepositoryPreview(preview.previewId, mock.octokit);
    assert.equal(result.status, 'partial');
    assert.equal(result.repository.id, mock.repo.id);
    assert.match(result.error.message, new RegExp(expected, 'i'));
    assert.equal(result.error.status, 403);
  });
}
