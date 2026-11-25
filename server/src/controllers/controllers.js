import { getOctokit } from '../config/github.js';
import { hasGithubToken } from '../config/env.js';

import {
  analyzeRepository,
  defaultGitignore,
  defaultReadme,
} from '../services/analyzerService.js';

import {
  createPreview,
  executePreview,
} from '../services/actionService.js';

import {
  assertRepositoryAccess,
  getAuthenticatedContext,
  getDashboard,
  listAllRepositories,
  mapRepository,
} from '../services/githubService.js';
import { getPublicRepository, getRepositoryResource, searchPublicRepositories } from '../services/publicRepositoryService.js';
import { createRepositoryPreview } from '../services/repositoryCreationService.js';
import {
  getRepositoryCreation, recoverRepositoryCreation, resumeRepositoryCreation,
  startRepositoryCreation,
} from '../services/repositoryCreationJobService.js';


export const health = (req, res) =>
  res.json({
    status: 'ok',
    tokenConfigured: hasGithubToken(),
    timestamp: new Date().toISOString(),
  });


export async function authStatus(req, res) {
  res.json(await getAuthenticatedContext());
}


export async function dashboard(req, res) {
  res.json(await getDashboard());
}


export async function listRepositories(req, res) {
  const {
    search,
    visibility,
    sort,
    direction,
    page,
    perPage,
  } = req.validatedQuery ?? req.query;

  let repositories = await listAllRepositories();

  const term = search.toLowerCase();

  if (term) {
    repositories = repositories.filter(
      (repo) =>
        repo.name.toLowerCase().includes(term) ||
        repo.description?.toLowerCase().includes(term)
    );
  }

  if (visibility !== 'all') {
    repositories = repositories.filter(
      (repo) => repo.private === (visibility === 'private')
    );
  }

  const field = {
    updated: 'updatedAt',
    created: 'createdAt',
    pushed: 'pushedAt',
    name: 'name',
  }[sort];

  repositories.sort(
    (a, b) =>
      String(a[field] || '').localeCompare(String(b[field] || '')) *
      (direction === 'asc' ? 1 : -1)
  );

  const start = (page - 1) * perPage;

  res.json({
    items: repositories.slice(start, start + perPage),

    pagination: {
      page,
      perPage,
      total: repositories.length,
      pages: Math.ceil(repositories.length / perPage),
    },
  });
}


export async function createRepository(req, res) {
  res.status(202).json(startRepositoryCreation(req.body.previewId));
}

export async function previewRepositoryCreation(req, res) {
  res.status(201).json(await createRepositoryPreview(req.body));
}

export async function repositoryCreationStatus(req, res) {
  res.json(getRepositoryCreation(req.params.creationId));
}

export async function resumeRepositoryCreationController(req, res) {
  res.status(202).json(resumeRepositoryCreation(req.params.creationId));
}

export async function recoverRepositoryCreationController(req, res) {
  res.status(202).json(await recoverRepositoryCreation(req.body));
}

export async function exploreSearch(req, res) {
  res.json(await searchPublicRepositories(req.validatedQuery ?? req.query));
}

export async function exploreRepository(req, res) {
  res.json(await getPublicRepository(req.params.owner, req.params.repo));
}

export async function exploreResource(req, res) {
  res.json(await getRepositoryResource(
    req.params.owner, req.params.repo, req.params.resource,
    req.validatedQuery ?? req.query
  ));
}


export async function listIssues(req, res) {
  const { owner, repo } = req.params;

  const {
    state,
    page,
    perPage,
  } = req.validatedQuery ?? req.query;

  await assertRepositoryAccess(owner, repo);

  const octokit = getOctokit();

  const all = await octokit.paginate(
    octokit.rest.issues.listForRepo,
    {
      owner,
      repo,
      state,
      per_page: 100,
    }
  );

  const issues = all
    .filter((issue) => !issue.pull_request)
    .map((issue) => ({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,

      author: issue.user?.login,
      avatarUrl: issue.user?.avatar_url,

      createdAt: issue.created_at,
      updatedAt: issue.updated_at,

      htmlUrl: issue.html_url,

      labels: issue.labels.map((label) =>
        typeof label === 'string'
          ? {
              name: label,
            }
          : {
              name: label.name,
              color: label.color,
            }
      ),
    }));

  const start = (page - 1) * perPage;

  res.json({
    items: issues.slice(start, start + perPage),

    pagination: {
      page,
      perPage,
      total: issues.length,
      pages: Math.ceil(issues.length / perPage),
    },
  });
}


export async function listLabels(req, res) {
  await assertRepositoryAccess(
    req.params.owner,
    req.params.repo
  );

  const octokit = getOctokit();

  const labels = await octokit.paginate(
    octokit.rest.issues.listLabelsForRepo,
    {
      ...req.params,
      per_page: 100,
    }
  );

  res.json({
    items: labels.map(
      ({
        name,
        color,
        description,
      }) => ({
        name,
        color,
        description,
      })
    ),
  });
}


export async function createIssue(req, res) {
  await assertRepositoryAccess(
    req.params.owner,
    req.params.repo,
    {
      write: true,
    }
  );

  const octokit = getOctokit();

  const {
    title,
    body,
    labels,
  } = req.body;

  const { data } =
    await octokit.rest.issues.create({
      ...req.params,
      title,
      body,
      labels,
    });

  res.status(201).json({
    issue: {
      number: data.number,
      title: data.title,
      htmlUrl: data.html_url,
      state: data.state,
    },
  });
}


export async function analyze(req, res) {
  res.json(
    await analyzeRepository(
      req.params.owner,
      req.params.repo
    )
  );
}


export async function templates(req, res) {
  const repository =
    await assertRepositoryAccess(
      req.params.owner,
      req.params.repo
    );

  const octokit = getOctokit();

  const { data: languages } =
    await octokit.rest.repos.listLanguages(
      req.params
    );

  res.json({
    readme: defaultReadme(repository),
    gitignore: defaultGitignore(languages),
  });
}


export async function previewAction(req, res) {
  res
    .status(201)
    .json(
      await createPreview(req.body)
    );
}


export async function executeAction(req, res) {
  res.json(
    await executePreview(
      req.body.previewId
    )
  );
}
