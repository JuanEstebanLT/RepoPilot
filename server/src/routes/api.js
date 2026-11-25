import { Router } from 'express';
import * as controller from '../controllers/controllers.js';
import { validate } from '../middlewares/validate.js';
import {
  createIssueSchema, createRepoSchema, creationDraftSchema, creationIdSchema, executeActionSchema,
  exploreResourceParamsSchema, exploreResourceSchema, exploreSearchSchema, issueQuerySchema,
  previewActionSchema, recoverCreationSchema, repoListSchema, repoParamsSchema,
} from '../validators/schemas.js';

export const apiRouter = Router();

apiRouter.get('/health', controller.health);
apiRouter.get('/auth/status', controller.authStatus);
apiRouter.get('/dashboard', controller.dashboard);
apiRouter.get('/repositories', validate(repoListSchema, 'query'), controller.listRepositories);
apiRouter.post('/repositories/preview', validate(creationDraftSchema), controller.previewRepositoryCreation);
apiRouter.post('/repositories', validate(createRepoSchema), controller.createRepository);
apiRouter.post('/repository-creations/recover', validate(recoverCreationSchema), controller.recoverRepositoryCreationController);
apiRouter.get('/repository-creations/:creationId', validate(creationIdSchema, 'params'), controller.repositoryCreationStatus);
apiRouter.post('/repository-creations/:creationId/resume', validate(creationIdSchema, 'params'), controller.resumeRepositoryCreationController);
apiRouter.get('/explore/search', validate(exploreSearchSchema, 'query'), controller.exploreSearch);
apiRouter.get('/explore/:owner/:repo', validate(repoParamsSchema, 'params'), controller.exploreRepository);
apiRouter.get('/explore/:owner/:repo/:resource', validate(exploreResourceParamsSchema, 'params'), validate(exploreResourceSchema, 'query'), controller.exploreResource);
apiRouter.get('/repositories/:owner/:repo/issues', validate(repoParamsSchema, 'params'), validate(issueQuerySchema, 'query'), controller.listIssues);
apiRouter.get('/repositories/:owner/:repo/labels', validate(repoParamsSchema, 'params'), controller.listLabels);
apiRouter.post('/repositories/:owner/:repo/issues', validate(repoParamsSchema, 'params'), validate(createIssueSchema), controller.createIssue);
apiRouter.get('/repositories/:owner/:repo/analysis', validate(repoParamsSchema, 'params'), controller.analyze);
apiRouter.get('/repositories/:owner/:repo/templates', validate(repoParamsSchema, 'params'), controller.templates);
apiRouter.post('/actions/preview', validate(previewActionSchema), controller.previewAction);
apiRouter.post('/actions/execute', validate(executeActionSchema), controller.executeAction);
