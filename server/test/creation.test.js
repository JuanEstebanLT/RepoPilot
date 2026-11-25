import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import { app } from '../src/app.js';
import { creationDraftSchema } from '../src/validators/schemas.js';
import { createRepositoryPreview, summarizeCreation } from '../src/services/repositoryCreationService.js';
import { executeRepositoryPreview } from '../src/services/repositoryCreationJobService.js';
import { buildReadme, buildRepoPilotTemplate } from '../src/services/templateService.js';
import { normalizeTopics } from '../../client/src/utils/topics.js';

const draft = {
  name: 'api-node', owner: 'tester', description: 'API de prueba', visibility: 'private', homepage: '', topics: ['node', 'api'],
  readme: { enabled: true, content: '# API personalizada' }, gitignoreTemplates: ['Node', 'Windows'], license: 'mit',
  features: { issues: true, projects: false, wiki: false, discussions: true },
  merge: { mergeCommit: false, squash: true, rebase: true, deleteBranch: true },
  template: { mode: 'repopilot', github: '', repopilot: 'node-express', optionalFiles: { readme: false, gitignore: false, envExample: true, license: false, contributing: true, codeOfConduct: false, security: true } },
};

test('valida nombre, visibilidad, README, gitignore, licencia y plantilla', () => {
  const parsed = creationDraftSchema.parse(draft);
  assert.equal(parsed.name, 'api-node');
  assert.equal(parsed.visibility, 'private');
  assert.equal(parsed.readme.content, '# API personalizada');
  assert.deepEqual(parsed.gitignoreTemplates, ['Node', 'Windows']);
  assert.equal(parsed.license, 'mit');
  assert.equal(parsed.template.repopilot, 'node-express');
  assert.equal(creationDraftSchema.safeParse({ ...draft, name: 'nombre inválido' }).success, false);
});

test('la vista previa reúne archivos y configuración sin contactar GitHub', async () => {
  const parsed = creationDraftSchema.parse(draft);
  const preview = await createRepositoryPreview(parsed);
  assert.match(preview.previewId, /^[0-9a-f-]{36}$/i);
  assert.ok(preview.summary.files.includes('README.md'));
  assert.ok(preview.summary.files.includes('.gitignore'));
  assert.ok(preview.summary.files.includes('LICENSE'));
  assert.equal(preview.summary.features.discussions, true);
  assert.equal(preview.summary.merge.deleteBranch, true);
});

test('rechaza referencia de GitHub Template inválida en preview', async () => {
  const parsed = creationDraftSchema.parse({ ...draft, template: { ...draft.template, mode: 'github', github: 'no es una referencia' } });
  await assert.rejects(() => createRepositoryPreview(parsed), (error) => error.code === 'INVALID_GITHUB_TEMPLATE');
});

test('las plantillas RepoPilot son pequeñas y funcionales', () => {
  const react = buildRepoPilotTemplate('react-vite', 'demo');
  const node = buildRepoPilotTemplate('node-express', 'api');
  const fastapi = buildRepoPilotTemplate('fastapi', 'api');
  assert.ok(react.some((file) => file.path === 'src/main.jsx'));
  assert.ok(node.some((file) => file.path === 'src/index.js'));
  assert.ok(fastapi.some((file) => file.path === 'app/main.py'));
  assert.ok(react.length < 10 && node.length < 10 && fastapi.length < 10);
});

test('plantilla React + Vite incluye estructura y configuración ejecutable', () => {
  const files = new Map(buildRepoPilotTemplate('react-vite', 'demo').map((file) => [file.path, file.content]));
  const packageJson = JSON.parse(files.get('package.json'));
  assert.equal(packageJson.scripts.dev, 'vite');
  assert.equal(packageJson.scripts.build, 'vite build');
  assert.equal(packageJson.scripts.preview, 'vite preview');
  assert.equal(packageJson.dependencies.react, '^19.0.0');
  assert.equal(packageJson.dependencies['react-dom'], '^19.0.0');
  assert.equal(packageJson.devDependencies['@vitejs/plugin-react'], '^5.1.0');
  assert.equal(packageJson.devDependencies.vite, '^7.0.0');
  assert.match(files.get('vite.config.js'), /plugins:\s*\[react\(\)\]/);
  assert.match(files.get('src/App.jsx'), /export default function App/);
  assert.match(files.get('src/main.jsx'), /import App from '\.\/App\.jsx'/);
  assert.match(files.get('src/main.jsx'), /<App \/>/);
  assert.equal(files.has('src/assets/.gitkeep'), true);
  const readme = buildReadme('demo', '', 'react-vite');
  assert.match(readme, /npm install/);
  assert.match(readme, /npm run dev/);
  assert.match(readme, /npm run build/);
  assert.match(readme, /plantilla React \+ Vite de RepoPilot/);
});

test('endpoint de preview no crea repositorios y exige cliente local', async () => {
  const response = await request(app).post('/api/repositories/preview').set('X-Repo-Manager', 'local-client').send(draft).expect(201);
  assert.ok(response.body.previewId);
  assert.equal(response.body.summary.name, 'api-node');
  assert.deepEqual(response.body.summary.topics, ['node', 'api']);
});

test('la confirmación es obligatoria para ejecutar creación', async () => {
  await request(app).post('/api/repositories').set('X-Repo-Manager', 'local-client').send({ previewId: crypto.randomUUID(), confirmed: false }).expect(422);
});

test('resume correctamente la configuración de creación', () => {
  const summary = summarizeCreation(creationDraftSchema.parse(draft));
  assert.equal(summary.visibility, 'private');
  assert.deepEqual(summary.topics, ['node', 'api']);
  assert.equal(summary.template, 'node-express');
  assert.equal(summary.templateLabel, 'RepoPilot: node-express');
  const empty = summarizeCreation(creationDraftSchema.parse({ ...draft, template: { ...draft.template, mode: 'empty', repopilot: 'empty' } }));
  assert.equal(empty.templateLabel, 'Sin plantilla');
  const github = summarizeCreation(creationDraftSchema.parse({ ...draft, template: { ...draft.template, mode: 'github', github: 'octocat/template' } }));
  assert.equal(github.templateLabel, 'GitHub Template: octocat/template');
});

test('topics del formulario permanecen en preview y creación final', async () => {
  const topics = normalizeTopics('  sena, react, api, SENA, , REACT  ');
  assert.deepEqual(topics, ['sena', 'react', 'api']);

  const input = creationDraftSchema.parse({
    ...draft,
    topics: [...topics, '', 'API'],
    readme: { enabled: false, content: '' },
    gitignoreTemplates: [],
    license: 'none',
    template: {
      mode: 'empty', github: '', repopilot: 'empty',
      optionalFiles: { readme: false, gitignore: false, envExample: false, license: false, contributing: false, codeOfConduct: false, security: false },
    },
  });
  assert.deepEqual(input.topics, ['sena', 'react', 'api']);

  const preview = await createRepositoryPreview(input);
  assert.deepEqual(preview.summary.topics, ['sena', 'react', 'api']);

  let topicsSentToGitHub;
  const repository = {
    id: 99, name: input.name, full_name: `tester/${input.name}`,
    owner: { login: 'tester' }, private: true, visibility: 'private',
    description: input.description, language: null, stargazers_count: 0,
    forks_count: 0, open_issues_count: 0, default_branch: null,
    updated_at: '2026-11-25T00:00:00Z', created_at: '2026-11-25T00:00:00Z',
    pushed_at: null, html_url: `https://github.com/tester/${input.name}`,
    permissions: { admin: true, push: true },
  };
  const octokit = { rest: {
    users: { getAuthenticated: async () => ({ data: { login: 'tester' } }) },
    repos: {
      createForAuthenticatedUser: async () => ({ data: repository }),
      update: async () => ({ data: repository }),
      getAllTopics: async () => ({ data: { names: [] } }),
      replaceAllTopics: async ({ names }) => { topicsSentToGitHub = names; return { data: { names } }; },
      get: async () => ({ data: repository }),
    },
  } };

  await executeRepositoryPreview(preview.previewId, octokit);
  assert.deepEqual(topicsSentToGitHub, ['sena', 'react', 'api']);
});

test('owner vacío se resuelve en preview y se conserva en la creación final', async () => {
  const input = creationDraftSchema.parse({
    ...draft,
    name: 'repopilot-creacion-prueba', owner: '', topics: [],
    readme: { enabled: false, content: '' }, gitignoreTemplates: [], license: 'none',
    template: {
      mode: 'empty', github: '', repopilot: 'empty',
      optionalFiles: { readme: false, gitignore: false, envExample: false, license: false, contributing: false, codeOfConduct: false, security: false },
    },
  });
  let createCall;
  const repository = {
    id: 100, name: input.name, full_name: `JuanEstebanLT/${input.name}`,
    owner: { login: 'JuanEstebanLT' }, private: true, visibility: 'private',
    description: input.description, language: null, stargazers_count: 0,
    forks_count: 0, open_issues_count: 0, default_branch: null,
    updated_at: '2026-11-25T00:00:00Z', created_at: '2026-11-25T00:00:00Z',
    pushed_at: null, html_url: `https://github.com/JuanEstebanLT/${input.name}`,
    permissions: { admin: true, push: true },
  };
  const octokit = { rest: {
    users: { getAuthenticated: async () => ({ data: { login: 'JuanEstebanLT' } }) },
    repos: {
      createForAuthenticatedUser: async (params) => { createCall = params; return { data: repository }; },
      update: async () => ({ data: repository }),
      get: async () => ({ data: repository }),
    },
  } };

  const preview = await createRepositoryPreview(input, octokit);
  assert.equal(preview.summary.owner, 'JuanEstebanLT');
  assert.equal(preview.summary.fullName, 'JuanEstebanLT/repopilot-creacion-prueba');
  assert.equal(preview.summary.templateLabel, 'Sin plantilla');

  const result = await executeRepositoryPreview(preview.previewId, octokit);
  assert.equal(createCall.name, 'repopilot-creacion-prueba');
  assert.equal(result.repository.owner, 'JuanEstebanLT');
  assert.equal(result.repository.fullName, 'JuanEstebanLT/repopilot-creacion-prueba');
});

test('bloquea la creación si cambia el owner autenticado después del preview', async () => {
  const input = creationDraftSchema.parse({ ...draft, owner: '' });
  const previewOctokit = { rest: { users: { getAuthenticated: async () => ({ data: { login: 'JuanEstebanLT' } }) } } };
  const preview = await createRepositoryPreview(input, previewOctokit);
  let created = false;
  const changedOctokit = { rest: {
    users: { getAuthenticated: async () => ({ data: { login: 'OtraCuenta' } }) },
    repos: { createForAuthenticatedUser: async () => { created = true; } },
  } };
  const result = await executeRepositoryPreview(preview.previewId, changedOctokit);
  assert.equal(result.status, 'failed');
  assert.equal(result.error.code, 'PREVIEW_OWNER_CHANGED');
  assert.equal(result.error.stage, 'repository');
  assert.equal(created, false);
});
