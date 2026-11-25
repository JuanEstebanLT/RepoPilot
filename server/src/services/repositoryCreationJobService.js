import crypto from 'node:crypto';
import { getOctokit } from '../config/github.js';
import { mapRepository } from './githubService.js';
import { consumeRepositoryPreview, summarizeCreation } from './repositoryCreationService.js';
import { buildReadme, buildRepoPilotTemplate, optionalProjectFiles } from './templateService.js';
import { parseRepositoryReference } from './publicRepositoryService.js';

const jobs = new Map();
const JOB_TTL = 24 * 60 * 60 * 1000;

const STAGES = [
  ['repository', 'Repositorio'], ['settings', 'Configuración general'],
  ['topics', 'Topics'], ['template', 'Plantilla'], ['readme', 'README'],
  ['gitignore', '.gitignore'], ['license', 'Licencia'],
  ['optionalFiles', 'Archivos opcionales'], ['discussions', 'Discussions'],
  ['merge', 'Configuración merge'],
];

const STAGE_MESSAGES = {
  repository: 'No se pudo crear el repositorio.',
  settings: 'El repositorio fue creado, pero GitHub rechazó la configuración general.',
  topics: 'El repositorio fue creado, pero GitHub rechazó la configuración de topics.',
  template: 'El repositorio fue creado, pero no fue posible generar los archivos de la plantilla.',
  readme: 'El repositorio fue creado, pero no fue posible crear README.md.',
  gitignore: 'El repositorio fue creado, pero no fue posible generar .gitignore.',
  license: 'El repositorio fue creado, pero GitHub rechazó la creación de LICENSE.',
  optionalFiles: 'El repositorio fue creado, pero algunos archivos opcionales no pudieron crearse.',
  discussions: 'El repositorio fue creado, pero Discussions no pudo habilitarse.',
  merge: 'El repositorio fue creado, pero algunas estrategias de merge no pudieron configurarse.',
};

function cleanupJobs() {
  const now = Date.now();
  for (const [id, job] of jobs) if (job.expiresAt <= now) jobs.delete(id);
}

function stepMap() {
  return Object.fromEntries(STAGES.map(([id, label]) => [id, {
    id, label, status: 'pending', detail: null, error: null,
  }]));
}

function repositoryView(repo) {
  return repo ? {
    id: repo.id, name: repo.name, owner: repo.owner.login,
    fullName: repo.full_name, htmlUrl: repo.html_url,
    defaultBranch: repo.default_branch, visibility: repo.visibility || (repo.private ? 'private' : 'public'),
  } : null;
}

function publicJob(job) {
  return {
    creationId: job.id, status: job.status, currentStage: job.currentStage,
    repository: job.repository, steps: job.steps, error: job.error,
    files: [...job.files], summary: job.summary,
    createdAt: job.createdAt, updatedAt: job.updatedAt,
  };
}

function newJob(input, repository = null) {
  cleanupJobs();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const job = {
    id, status: 'running', currentStage: repository ? 'settings' : 'repository',
    input: structuredClone(input), repository: repositoryView(repository),
    steps: stepMap(), files: new Set(), error: null,
    summary: summarizeCreation(input), createdAt: now, updatedAt: now,
    expiresAt: Date.now() + JOB_TTL,
  };
  if (repository) {
    job.steps.repository.status = 'completed';
    job.steps.repository.detail = 'Repositorio existente verificado en GitHub.';
  }
  jobs.set(id, job);
  return job;
}

function touch(job) { job.updatedAt = new Date().toISOString(); }
function mark(job, stage, status, detail = null) {
  job.currentStage = stage;
  job.steps[stage] = { ...job.steps[stage], status, detail, error: null };
  touch(job);
}

function fail(job, stage, cause) {
  let status = Number(cause.status) || 500;
  let code = cause.code || `CREATION_${stage.toUpperCase()}_FAILED`;
  const githubMessage = cause.response?.data?.message || cause.message || '';
  if (status === 401) code = 'TOKEN_INVALID';
  if (status === 403) code = 'PERMISSION_DENIED';
  if (status === 403 && cause.response?.headers?.['x-ratelimit-remaining'] === '0') { status = 429; code = 'RATE_LIMITED'; }
  if (status === 404) code = 'REPOSITORY_NOT_FOUND';
  if (status === 409) code = cause.code || 'CREATION_CONFLICT';
  if (status === 422 && stage === 'repository' && /already exists|name already exists/i.test(githubMessage)) code = 'REPOSITORY_NAME_TAKEN';
  if (status === 422 && code === `CREATION_${stage.toUpperCase()}_FAILED`) code = 'VALIDATION_ERROR';
  const message = code === 'REPOSITORY_NAME_TAKEN'
    ? 'No se pudo crear el repositorio porque el owner ya utiliza ese nombre.'
    : code === 'TOKEN_INVALID'
      ? 'GitHub rechazó la operación porque el token no es válido.'
      : code === 'RATE_LIMITED'
        ? 'GitHub no pudo completar la etapa porque se agotó el Rate Limit.'
        : STAGE_MESSAGES[stage];
  const error = {
    stage, code, status, message,
  };
  job.steps[stage] = { ...job.steps[stage], status: 'failed', error, detail: null };
  job.status = job.repository ? 'partial' : 'failed';
  job.currentStage = stage; job.error = error; touch(job);
}

function sameArray(left, right) {
  return [...left].sort().join('\0') === [...right].sort().join('\0');
}

async function authenticatedLogin(octokit) {
  return (await octokit.rest.users.getAuthenticated()).data.login;
}

async function ensureAuthenticatedOwner(octokit, input) {
  const authenticated = await authenticatedLogin(octokit);
  if (input.ownerResolution === 'authenticated' && input.owner.toLowerCase() !== authenticated.toLowerCase()) {
    throw Object.assign(new Error('La cuenta autenticada cambió después del preview.'), { status: 409, code: 'PREVIEW_OWNER_CHANGED' });
  }
  return authenticated;
}

async function createRepository(octokit, input) {
  const authenticated = await ensureAuthenticatedOwner(octokit, input);
  const params = {
    name: input.name, description: input.description || undefined,
    homepage: input.homepage || undefined, private: input.visibility === 'private',
  };
  if (input.template.mode === 'github') {
    const template = parseRepositoryReference(input.template.github);
    const { data: source } = await octokit.rest.repos.get({ owner: template.owner, repo: template.repo });
    if (!source.is_template) throw Object.assign(new Error('GitHub Template inválida.'), { status: 422, code: 'INVALID_GITHUB_TEMPLATE' });
    return (await octokit.rest.repos.createUsingTemplate({
      template_owner: template.owner, template_repo: template.repo,
      owner: input.owner, name: input.name, description: input.description || undefined,
      private: input.visibility === 'private', include_all_branches: false,
    })).data;
  }
  const createParams = { ...params, auto_init: false };
  return input.owner.toLowerCase() === authenticated.toLowerCase()
    ? (await octokit.rest.repos.createForAuthenticatedUser(createParams)).data
    : (await octokit.rest.repos.createInOrg({ org: input.owner, ...createParams })).data;
}

async function currentRepository(octokit, job) {
  return (await octokit.rest.repos.get({ owner: job.repository.owner, repo: job.repository.name })).data;
}

async function stageRepository(job, octokit) {
  if (job.repository) return;
  const created = await createRepository(octokit, job.input);
  job.repository = repositoryView(created);
  if (job.input.template.mode === 'github') {
    job.steps.template.status = 'completed';
    job.steps.template.detail = 'Repositorio generado desde GitHub Template.';
  }
}

async function stageSettings(job, octokit) {
  const current = await currentRepository(octokit, job);
  const desired = job.input;
  const different = (current.description || '') !== desired.description
    || (current.homepage || '') !== desired.homepage
    || current.has_issues !== desired.features.issues
    || current.has_projects !== desired.features.projects
    || current.has_wiki !== desired.features.wiki;
  if (!different) { job.steps.settings.detail = 'La configuración general ya coincidía.'; return; }
  await octokit.rest.repos.update({
    owner: job.repository.owner, repo: job.repository.name,
    description: desired.description || undefined, homepage: desired.homepage || undefined,
    has_issues: desired.features.issues, has_projects: desired.features.projects,
    has_wiki: desired.features.wiki,
  });
}

async function stageTopics(job, octokit) {
  if (!job.input.topics.length) { mark(job, 'topics', 'skipped', 'No se solicitaron topics.'); return; }
  const params = { owner: job.repository.owner, repo: job.repository.name };
  const current = (await octokit.rest.repos.getAllTopics(params)).data.names || [];
  if (sameArray(current, job.input.topics)) { job.steps.topics.detail = 'Los topics ya coincidían.'; return; }
  await octokit.rest.repos.replaceAllTopics({ ...params, names: job.input.topics });
}

async function readFile(octokit, repository, path) {
  try {
    const { data } = await octokit.rest.repos.getContent({ ...repository, path });
    if (Array.isArray(data) || data.type !== 'file') return { conflict: true, content: '' };
    return { sha: data.sha, content: Buffer.from(data.content || '', 'base64').toString('utf8') };
  } catch (error) {
    if ([404, 409].includes(error.status)) return null;
    throw error;
  }
}

async function ensureFile(job, octokit, path, content) {
  const repository = { owner: job.repository.owner, repo: job.repository.name };
  const current = await readFile(octokit, repository, path);
  if (current?.conflict) throw Object.assign(new Error(`${path} no es un archivo.`), { status: 409, code: 'FILE_CONFLICT' });
  if (current && current.content === content) { job.files.add(path); return 'existing'; }
  if (current) throw Object.assign(new Error(`${path} ya existe con contenido diferente.`), { status: 409, code: 'FILE_CONFLICT' });
  await octokit.rest.repos.createOrUpdateFileContents({
    ...repository, path, message: `chore: inicializar ${path}`,
    content: Buffer.from(content, 'utf8').toString('base64'),
  });
  job.files.add(path);
  return 'created';
}

async function gitignoreContent(octokit, names) {
  const sections = await Promise.all([...new Set(names)].map(async (name) => {
    const local = {
      VisualStudioCode: '.vscode/*\n!.vscode/extensions.json\n!.vscode/settings.example.json',
      JetBrains: '.idea/\n*.iml\n*.iws',
      Windows: 'Thumbs.db\nThumbs.db:encryptable\nehthumbs.db\nDesktop.ini\n$RECYCLE.BIN/',
    }[name];
    if (local) return `# --- ${name} ---\n${local}`;
    const { data } = await octokit.rest.gitignore.getTemplate({ name });
    return `# --- ${name} ---\n${data.source.trim()}`;
  }));
  return `${sections.join('\n\n')}\n`;
}

async function stageTemplate(job, octokit) {
  if (job.input.template.mode === 'github') return;
  if (job.input.template.mode === 'empty') { mark(job, 'template', 'skipped', 'Sin plantilla.'); return; }
  const files = buildRepoPilotTemplate(job.input.template.repopilot, job.input.name, job.input.description);
  for (const file of files) await ensureFile(job, octokit, file.path, file.content);
}

async function stageReadme(job, octokit) {
  if (job.input.template.mode === 'github' || (!job.input.readme.enabled && !job.input.template.optionalFiles.readme)) {
    mark(job, 'readme', 'skipped', 'README no solicitado o administrado por la plantilla GitHub.'); return;
  }
  await ensureFile(job, octokit, 'README.md', job.input.readme.content || buildReadme(job.input.name, job.input.description, job.input.template.repopilot));
}

async function stageGitignore(job, octokit) {
  if (job.input.template.mode === 'github') { mark(job, 'gitignore', 'skipped', 'Administrado por la plantilla GitHub.'); return; }
  let content = null;
  if (job.input.gitignoreTemplates.length) content = await gitignoreContent(octokit, job.input.gitignoreTemplates);
  else if (job.input.template.optionalFiles.gitignore) content = '.env\n.env.*\n!.env.example\n*.log\n.DS_Store\nThumbs.db\n';
  if (content === null) { mark(job, 'gitignore', 'skipped', '.gitignore no solicitado.'); return; }
  await ensureFile(job, octokit, '.gitignore', content);
}

async function stageLicense(job, octokit) {
  if (job.input.template.mode === 'github' || job.input.license === 'none') {
    mark(job, 'license', 'skipped', 'Licencia no solicitada o administrada por la plantilla GitHub.'); return;
  }
  const { data } = await octokit.rest.licenses.get({ license: job.input.license });
  await ensureFile(job, octokit, 'LICENSE', data.body);
}

async function stageOptionalFiles(job, octokit) {
  if (job.input.template.mode === 'github') { mark(job, 'optionalFiles', 'skipped', 'Administrados por la plantilla GitHub.'); return; }
  const files = optionalProjectFiles(job.input.template.optionalFiles);
  if (!files.length) { mark(job, 'optionalFiles', 'skipped', 'No se solicitaron archivos opcionales.'); return; }
  for (const file of files) await ensureFile(job, octokit, file.path, file.content);
}

async function stageDiscussions(job, octokit) {
  const current = await currentRepository(octokit, job);
  if (current.has_discussions === job.input.features.discussions) {
    job.steps.discussions.detail = 'Discussions ya coincidía.'; return;
  }
  await octokit.rest.repos.update({
    owner: job.repository.owner, repo: job.repository.name,
    has_discussions: job.input.features.discussions,
  });
}

async function stageMerge(job, octokit) {
  const current = await currentRepository(octokit, job);
  const merge = job.input.merge;
  const different = current.allow_merge_commit !== merge.mergeCommit
    || current.allow_squash_merge !== merge.squash
    || current.allow_rebase_merge !== merge.rebase
    || current.delete_branch_on_merge !== merge.deleteBranch;
  if (!different) { job.steps.merge.detail = 'Las opciones merge ya coincidían.'; return; }
  await octokit.rest.repos.update({
    owner: job.repository.owner, repo: job.repository.name,
    allow_merge_commit: merge.mergeCommit, allow_squash_merge: merge.squash,
    allow_rebase_merge: merge.rebase, delete_branch_on_merge: merge.deleteBranch,
  });
}

const HANDLERS = {
  repository: stageRepository, settings: stageSettings, topics: stageTopics,
  template: stageTemplate, readme: stageReadme, gitignore: stageGitignore,
  license: stageLicense, optionalFiles: stageOptionalFiles,
  discussions: stageDiscussions, merge: stageMerge,
};

async function runJob(job, octokit) {
  job.status = 'running'; job.error = null; touch(job);
  for (const [stage] of STAGES) {
    const step = job.steps[stage];
    if (['completed', 'skipped'].includes(step.status)) continue;
    mark(job, stage, 'running');
    try {
      await HANDLERS[stage](job, octokit);
      if (job.steps[stage].status === 'running') mark(job, stage, 'completed', job.steps[stage].detail);
    } catch (error) {
      fail(job, stage, error);
      return publicJob(job);
    }
  }
  job.status = 'completed'; job.currentStage = null; job.error = null; touch(job);
  return publicJob(job);
}

function launch(job, octokit) {
  job.status = 'running';
  job.error = null;
  job.currentStage = STAGES.find(([stage]) => !['completed', 'skipped'].includes(job.steps[stage].status))?.[0] || null;
  touch(job);
  queueMicrotask(() => runJob(job, octokit).catch((error) => fail(job, job.currentStage || 'repository', error)));
  return publicJob(job);
}

export function startRepositoryCreation(previewId, octokit = getOctokit()) {
  const input = consumeRepositoryPreview(previewId);
  return launch(newJob(input), octokit);
}

export async function executeRepositoryPreview(previewId, octokit = getOctokit()) {
  const job = newJob(consumeRepositoryPreview(previewId));
  return runJob(job, octokit);
}

export function getRepositoryCreation(creationId) {
  cleanupJobs();
  const job = jobs.get(creationId);
  if (!job) throw Object.assign(new Error('La creación no existe o expiró.'), { status: 404, code: 'CREATION_NOT_FOUND' });
  return publicJob(job);
}

export function resumeRepositoryCreation(creationId, octokit = getOctokit()) {
  const job = jobs.get(creationId);
  if (!job) throw Object.assign(new Error('La creación no existe o expiró.'), { status: 404, code: 'CREATION_NOT_FOUND' });
  if (!job.repository) throw Object.assign(new Error('El repositorio nunca llegó a crearse.'), { status: 409, code: 'REPOSITORY_NOT_CREATED' });
  if (job.status === 'running') return publicJob(job);
  if (job.status === 'completed') return publicJob(job);
  for (const step of Object.values(job.steps)) if (step.status === 'failed') step.status = 'pending';
  return launch(job, octokit);
}

export async function recoverRepositoryCreation({ input, repositoryId }, octokit = getOctokit()) {
  let owner = input.owner;
  let ownerResolution = 'explicit';
  if (!owner) { owner = await authenticatedLogin(octokit); ownerResolution = 'authenticated'; }
  const snapshot = structuredClone({ ...input, owner, ownerResolution });
  const { data: repository } = await octokit.rest.repos.get({ owner, repo: input.name });
  if (repository.id !== repositoryId) throw Object.assign(new Error('El repositorio no coincide con la creación parcial.'), { status: 409, code: 'RECOVERY_REPOSITORY_MISMATCH' });
  return launch(newJob(snapshot, repository), octokit);
}
