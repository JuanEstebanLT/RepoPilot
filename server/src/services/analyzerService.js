import { getOctokit } from '../config/github.js';
import { assertRepositoryAccess, mapRepository, repositoryCapabilities } from './githubService.js';
import { buildRecommendations } from './analysisRules.js';

export { buildRecommendations, defaultGitignore, defaultReadme } from './analysisRules.js';

const DEPENDENCY_FILES = [
  'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'requirements.txt',
  'pyproject.toml', 'pom.xml', 'build.gradle', 'composer.json', 'gemfile', 'go.mod', 'cargo.toml',
];

function hasPath(paths, matcher) {
  return paths.some((path) => matcher(path.toLowerCase()));
}

function inspectReadme(content, path) {
  const sections = [
    ['instalación', /(^|\n)#{1,3}\s+.*(instalaci[oó]n|installation)/i],
    ['uso', /(^|\n)#{1,3}\s+.*(uso|usage|ejecuci[oó]n)/i],
    ['contribución', /(^|\n)#{1,3}\s+.*(contribuci[oó]n|contributing)/i],
  ];
  return { exists: true, path, content, missingSections: sections.filter(([, pattern]) => !pattern.test(content)).map(([name]) => name) };
}

export async function analyzeRepository(owner, repo, octokit = getOctokit()) {
  const repository = await assertRepositoryAccess(owner, repo, { octokit });
  const [languagesResponse, openIssues, closedIssues, branches, commits] = await Promise.all([
    octokit.rest.repos.listLanguages({ owner, repo }),
    octokit.rest.search.issuesAndPullRequests({ q: `repo:${owner}/${repo} type:issue state:open`, per_page: 1 }),
    octokit.rest.search.issuesAndPullRequests({ q: `repo:${owner}/${repo} type:issue state:closed`, per_page: 1 }),
    octokit.rest.repos.listBranches({ owner, repo, per_page: 10 }),
    octokit.rest.repos.listCommits({ owner, repo, per_page: 5 }).catch((error) => {
      if (error.status === 409) return { data: [] };
      throw error;
    }),
  ]);
  const rootResponse = branches.data.length
    ? await octokit.rest.repos.getContent({ owner, repo, path: '', ref: repository.default_branch })
    : { data: [] };
  const rootItems = Array.isArray(rootResponse.data) ? rootResponse.data : [];
  const files = rootItems.filter((item) => item.type === 'file').map((item) => item.path);
  const extraPaths = await Promise.all(['.github/workflows', 'docs'].map(async (path) => {
    try {
      const response = await octokit.rest.repos.getContent({ owner, repo, path, ref: repository.default_branch });
      return Array.isArray(response.data) ? response.data.filter((item) => item.type === 'file').map((item) => item.path) : [];
    } catch (error) { if (error.status === 404) return []; throw error; }
  }));
  extraPaths.flat().forEach((path) => files.push(path));

  let readme = { exists: false, path: 'README.md', content: '', missingSections: [] };
  try {
    const response = await octokit.rest.repos.getReadme({ owner, repo, ref: repository.default_branch });
    const content = Buffer.from(response.data.content, 'base64').toString('utf8');
    readme = inspectReadme(content, response.data.path);
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  const analysis = {
    repository: mapRepository(repository),
    access: repositoryCapabilities(repository),
    mode: repositoryCapabilities(repository).mode,
    languages: languagesResponse.data,
    files: {
      total: files.length,
      sample: files.slice(0, 200),
      truncated: false,
      hasReadme: readme.exists,
      readmePath: readme.exists ? readme.path : null,
      hasGitignore: hasPath(files, (path) => path === '.gitignore'),
      hasLicense: hasPath(files, (path) => /^license(\.|$)/.test(path)),
      dependencyFiles: files.filter((path) => DEPENDENCY_FILES.includes(path.split('/').pop().toLowerCase())),
      workflows: files.filter((path) => path.toLowerCase().startsWith('.github/workflows/')),
      documentation: files.filter((path) => path.toLowerCase().startsWith('docs/') || /(^|\/)readme(\.|$)/i.test(path)),
    },
    readme,
    issues: {
      total: openIssues.data.total_count + closedIssues.data.total_count,
      open: openIssues.data.total_count,
      closed: closedIssues.data.total_count,
    },
    branches: branches.data.map((branch) => ({ name: branch.name, protected: branch.protected })),
    commits: commits.data.map((commit) => ({
      sha: commit.sha, message: commit.commit.message, author: commit.commit.author?.name,
      date: commit.commit.author?.date, htmlUrl: commit.html_url,
    })),
  };
  analysis.recommendations = buildRecommendations({
    repository, files, readme, issueCount: analysis.issues.open, languages: analysis.languages,
  });
  return analysis;
}

