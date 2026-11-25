import { z } from 'zod';

const repoName = z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9._-]+$/, 'Nombre de repositorio no válido.');
const ownerName = z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9-]+$/, 'Propietario no válido.');
const creationTopics = z.preprocess(
  (value) => Array.isArray(value)
    ? [...new Set(value.map((topic) => String(topic).trim().toLowerCase()).filter(Boolean))]
    : (value ?? []),
  z.array(z.string().regex(/^[a-z0-9-]+$/)).max(20)
);

export const repoParamsSchema = z.object({ owner: ownerName, repo: repoName });

export const repoListSchema = z.object({
  search: z.string().trim().max(100).optional().default(''),
  visibility: z.enum(['all', 'public', 'private']).optional().default('all'),
  sort: z.enum(['updated', 'name', 'created', 'pushed']).optional().default('updated'),
  direction: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(12),
});

export const createRepoSchema = z.object({
  previewId: z.string().uuid(),
  confirmed: z.literal(true, { error: 'Debe confirmar la creación.' }),
});

export const creationIdSchema = z.object({ creationId: z.string().uuid() });

const optionalFilesSchema = z.object({
  readme: z.boolean().optional().default(true),
  gitignore: z.boolean().optional().default(true),
  envExample: z.boolean().optional().default(false),
  license: z.boolean().optional().default(false),
  contributing: z.boolean().optional().default(false),
  codeOfConduct: z.boolean().optional().default(false),
  security: z.boolean().optional().default(false),
}).optional().default({});

export const creationDraftSchema = z.object({
  name: repoName,
  owner: z.union([ownerName, z.literal('')]).optional().default(''),
  description: z.string().trim().max(350).optional().default(''),
  visibility: z.enum(['public', 'private']).default('private'),
  homepage: z.string().trim().max(2048).optional().default('').refine(
    (value) => !value || /^https?:\/\//i.test(value),
    'La homepage debe comenzar con http:// o https://.'
  ),
  topics: creationTopics,
  readme: z.object({
    enabled: z.boolean().default(true),
    content: z.string().max(500000).optional().default(''),
  }).optional().default({ enabled: true, content: '' }),
  gitignoreTemplates: z.array(z.enum([
    'Node', 'Python', 'Java', 'Android', 'Gradle', 'Maven',
    'VisualStudioCode', 'JetBrains', 'Windows',
  ])).max(9).optional().default([]),
  license: z.enum(['none', 'mit', 'apache-2.0', 'gpl-3.0', 'bsd-3-clause', 'mpl-2.0']).default('none'),
  features: z.object({
    issues: z.boolean().default(true), projects: z.boolean().default(true),
    wiki: z.boolean().default(true), discussions: z.boolean().default(false),
  }).optional().default({}),
  merge: z.object({
    mergeCommit: z.boolean().default(true), squash: z.boolean().default(true),
    rebase: z.boolean().default(true), deleteBranch: z.boolean().default(false),
  }).optional().default({}),
  template: z.object({
    mode: z.enum(['empty', 'github', 'repopilot']).default('empty'),
    github: z.string().trim().max(300).optional().default(''),
    repopilot: z.enum(['empty', 'react-vite', 'node-express', 'python', 'fastapi', 'android-kotlin', 'java']).default('empty'),
    optionalFiles: optionalFilesSchema,
  }).optional().default({}),
});

export const recoverCreationSchema = z.object({
  input: creationDraftSchema,
  repositoryId: z.number().int().positive(),
  confirmed: z.literal(true, { error: 'Debe confirmar la recuperación.' }),
});

export const exploreSearchSchema = z.object({
  q: z.string().trim().min(1).max(256),
  language: z.string().trim().max(50).optional().default(''),
  topics: z.string().trim().max(200).optional().default(''),
  sort: z.enum(['best-match', 'stars', 'forks', 'updated']).optional().default('best-match'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).max(100).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(30).optional().default(12),
});

export const exploreResourceSchema = z.object({
  page: z.coerce.number().int().min(1).max(100).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const exploreResourceParamsSchema = repoParamsSchema.extend({
  resource: z.enum(['languages', 'commits', 'branches', 'releases', 'tags', 'issues', 'pulls', 'workflows']),
});

export const issueQuerySchema = z.object({
  state: z.enum(['open', 'closed', 'all']).optional().default('open'),
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const createIssueSchema = z.object({
  title: z.string().trim().min(3).max(256),
  body: z.string().max(65536).optional().default(''),
  labels: z.array(z.string().trim().min(1).max(100)).max(20).optional().default([]),
  confirmed: z.literal(true, { error: 'Debe confirmar la creación.' }),
});

export const previewActionSchema = z.object({
  owner: ownerName,
  repo: repoName,
  action: z.enum(['update_description', 'upsert_readme', 'upsert_gitignore']),
  description: z.string().trim().min(1).max(350).optional(),
  content: z.string().min(1).max(500000).optional(),
}).superRefine((value, context) => {
  if (value.action === 'update_description' && !value.description) {
    context.addIssue({ code: 'custom', path: ['description'], message: 'La descripción es obligatoria.' });
  }
  if (value.action !== 'update_description' && !value.content) {
    context.addIssue({ code: 'custom', path: ['content'], message: 'El contenido es obligatorio.' });
  }
});

export const executeActionSchema = z.object({
  previewId: z.string().uuid(),
  confirmed: z.literal(true, { error: 'Debe confirmar la modificación.' }),
});
