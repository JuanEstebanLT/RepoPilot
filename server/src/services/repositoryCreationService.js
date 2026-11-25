import crypto from 'node:crypto';
import { getOctokit } from '../config/github.js';
import { buildRepoPilotTemplate, optionalProjectFiles } from './templateService.js';
import { parseRepositoryReference } from './publicRepositoryService.js';

const previews = new Map();
const TTL_MS = 15 * 60 * 1000;

function normalizeTopics(topics = []) {
  return [...new Set(topics.map((topic) => String(topic).trim().toLowerCase()).filter(Boolean))];
}

function cleanExpired() {
  const now = Date.now();
  for (const [id, item] of previews) if (item.expiresAt <= now) previews.delete(id);
}

function templateLabel(input) {
  if (input.template.mode === 'empty') return 'Sin plantilla';
  if (input.template.mode === 'github') return `GitHub Template: ${input.template.github}`;
  return `RepoPilot: ${input.template.repopilot}`;
}

export function summarizeCreation(input) {
  if (input.template.mode === 'github') {
    return {
      owner: input.owner, name: input.name, fullName: `${input.owner}/${input.name}`, description: input.description,
      visibility: input.visibility, homepage: input.homepage, topics: input.topics,
      readme: 'Según la plantilla GitHub', gitignore: [], license: 'Según la plantilla GitHub',
      template: input.template.github, templateMode: 'github',
      templateLabel: templateLabel(input),
      files: ['Contenido generado desde la plantilla GitHub'], features: input.features, merge: input.merge,
    };
  }
  const optional = input.template.optionalFiles;
  const files = new Set();
  if (input.template.mode === 'repopilot') buildRepoPilotTemplate(input.template.repopilot, input.name, input.description).forEach((file) => files.add(file.path));
  if (input.readme.enabled || optional.readme) files.add('README.md');
  if (input.gitignoreTemplates.length || optional.gitignore) files.add('.gitignore');
  if (input.license !== 'none' || optional.license) files.add('LICENSE');
  optionalProjectFiles(optional).forEach((file) => files.add(file.path));
  return {
    owner: input.owner, name: input.name, fullName: `${input.owner}/${input.name}`, description: input.description,
    visibility: input.visibility, homepage: input.homepage, topics: input.topics,
    readme: input.readme.enabled ? (input.readme.content ? 'Personalizado' : 'Generado') : 'No',
    gitignore: input.gitignoreTemplates, license: input.license,
    template: input.template.mode === 'empty' ? 'Sin plantilla' : input.template.repopilot,
    templateLabel: templateLabel(input),
    templateMode: input.template.mode, files: [...files], features: input.features, merge: input.merge,
  };
}

export async function createRepositoryPreview(input, octokit) {
  cleanExpired();
  if (input.template.mode === 'github' && !parseRepositoryReference(input.template.github)) {
    throw Object.assign(new Error('La plantilla de GitHub debe usar owner/repository o una URL válida.'), { status: 422, code: 'INVALID_GITHUB_TEMPLATE' });
  }
  let owner = input.owner;
  let ownerResolution = 'explicit';
  if (!owner) {
    const client = octokit || getOctokit();
    const { data: authenticated } = await client.rest.users.getAuthenticated();
    owner = authenticated.login;
    ownerResolution = 'authenticated';
  }
  const snapshot = structuredClone({
    ...input, owner, ownerResolution, topics: normalizeTopics(input.topics),
  });
  const previewId = crypto.randomUUID();
  const expiresAt = Date.now() + TTL_MS;
  previews.set(previewId, { input: snapshot, expiresAt });
  return { previewId, expiresAt: new Date(expiresAt).toISOString(), summary: summarizeCreation(snapshot) };
}

export function consumeRepositoryPreview(previewId) {
  cleanExpired();
  const preview = previews.get(previewId);
  if (!preview) throw Object.assign(
    new Error('La vista previa expiró o no existe.'),
    { status: 409, code: 'PREVIEW_EXPIRED' }
  );
  previews.delete(previewId);
  return structuredClone(preview.input);
}

