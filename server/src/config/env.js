import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDirectory, '../../../.env') });

export const env = Object.freeze({
  port: Number(process.env.PORT || 3001),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  githubToken: process.env.GITHUB_TOKEN?.trim() || '',
  nodeEnv: process.env.NODE_ENV || 'development',
});

export const hasGithubToken = () => Boolean(env.githubToken);
