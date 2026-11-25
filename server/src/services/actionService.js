import crypto from 'node:crypto';
import { getOctokit } from '../config/github.js';
import { assertRepositoryAccess } from './githubService.js';

const previews = new Map();
const TTL_MS = 10 * 60 * 1000;

function cleanExpired() {
  const now = Date.now();
  for (const [id, preview] of previews) if (preview.expiresAt <= now) previews.delete(id);
}

function simpleDiff(before, after) {
  const oldLines = before.split('\n');
  const newLines = after.split('\n');
  const max = Math.max(oldLines.length, newLines.length);
  const lines = [];
  for (let index = 0; index < max; index += 1) {
    if (oldLines[index] === newLines[index]) {
      if (oldLines[index] !== undefined) lines.push(`  ${oldLines[index]}`);
    } else {
      if (oldLines[index] !== undefined) lines.push(`- ${oldLines[index]}`);
      if (newLines[index] !== undefined) lines.push(`+ ${newLines[index]}`);
    }
    if (lines.length >= 240) { lines.push('… diferencia truncada en la vista previa'); break; }
  }
  return lines.join('\n');
}

async function currentFile(octokit, owner, repo, path, ref) {
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref });
    if (Array.isArray(data) || data.type !== 'file') throw Object.assign(new Error('La ruta no corresponde a un archivo.'), { status: 409 });
    return { sha: data.sha, content: Buffer.from(data.content, 'base64').toString('utf8') };
  } catch (error) {
    if (error.status === 404) return { sha: null, content: '' };
    throw error;
  }
}

export async function createPreview(input) {
  cleanExpired();
  const octokit = getOctokit();
  const repository = await assertRepositoryAccess(input.owner, input.repo, { write: true });
  let before = '';
  let after = input.content || '';
  let sha = null;
  let path = null;
  let commitMessage = null;
  let permission = 'Administration: write';

  if (input.action === 'update_description') {
    before = repository.description || '';
    after = input.description;
  } else {
    path = input.action === 'upsert_readme' ? 'README.md' : '.gitignore';
    const current = await currentFile(octokit, input.owner, input.repo, path, repository.default_branch);
    before = current.content;
    sha = current.sha;
    permission = 'Contents: write';
    commitMessage = input.action === 'upsert_readme'
      ? (sha ? 'docs: actualizar README del repositorio' : 'docs: agregar documentación inicial del repositorio')
      : (sha ? 'chore: actualizar archivo gitignore' : 'chore: incorporar archivo gitignore');
  }

  if (before === after) throw Object.assign(new Error('La propuesta no contiene cambios.'), { status: 422, code: 'NO_CHANGES' });
  const id = crypto.randomUUID();
  const expiresAt = Date.now() + TTL_MS;
  previews.set(id, { ...input, path, before, after, sha, branch: repository.default_branch, commitMessage, expiresAt });
  return {
    previewId: id, expiresAt: new Date(expiresAt).toISOString(), action: input.action,
    repository: `${input.owner}/${input.repo}`, branch: repository.default_branch,
    affectedFiles: path ? [path] : ['Configuración del repositorio'], permission,
    before, after, diff: simpleDiff(before, after), commitMessage,
  };
}

export async function executePreview(previewId) {
  cleanExpired();
  const preview = previews.get(previewId);
  if (!preview) throw Object.assign(new Error('La vista previa expiró o no existe.'), { status: 409, code: 'PREVIEW_EXPIRED' });
  previews.delete(previewId);
  const octokit = getOctokit();
  await assertRepositoryAccess(preview.owner, preview.repo, { write: true });

  if (preview.action === 'update_description') {
    const current = await assertRepositoryAccess(preview.owner, preview.repo);
    if ((current.description || '') !== preview.before) throw Object.assign(new Error('La descripción cambió después de la vista previa.'), { status: 409, code: 'STALE_PREVIEW' });
    const { data } = await octokit.rest.repos.update({ owner: preview.owner, repo: preview.repo, description: preview.after });
    return { success: true, action: preview.action, htmlUrl: data.html_url, description: data.description };
  }

  const current = await currentFile(octokit, preview.owner, preview.repo, preview.path, preview.branch);
  if (current.sha !== preview.sha) throw Object.assign(new Error('El archivo cambió después de la vista previa.'), { status: 409, code: 'STALE_PREVIEW' });
  const params = {
    owner: preview.owner, repo: preview.repo, path: preview.path, branch: preview.branch,
    message: preview.commitMessage, content: Buffer.from(preview.after, 'utf8').toString('base64'),
  };
  if (preview.sha) params.sha = preview.sha;
  const { data } = await octokit.rest.repos.createOrUpdateFileContents(params);
  return {
    success: true, action: preview.action, path: preview.path,
    commitSha: data.commit.sha, commitUrl: data.commit.html_url, contentUrl: data.content?.html_url,
  };
}
