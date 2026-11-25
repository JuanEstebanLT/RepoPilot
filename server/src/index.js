import { app } from './app.js';
import { env, hasGithubToken } from './config/env.js';

app.listen(env.port, '127.0.0.1', () => {
  console.log(`GitHub Repo Manager API disponible en http://127.0.0.1:${env.port}`);
  console.log(`Token configurado: ${hasGithubToken() ? 'sí' : 'no'}`);
});
