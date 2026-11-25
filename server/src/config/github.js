import { Octokit } from 'octokit';
import { env } from './env.js';

let client;

export function getOctokit() {
  if (!env.githubToken) {
    const error = new Error('El token de GitHub no está configurado en el servidor.');
    error.status = 503;
    error.code = 'TOKEN_NOT_CONFIGURED';
    throw error;
  }

  if (!client) {
    client = new Octokit({
      auth: env.githubToken,
      userAgent: 'github-repo-manager/1.0.0',
      request: {
        timeout: 15000,
        headers: {
          accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2026-03-10',
        },
      },
    });
  }

  return client;
}
