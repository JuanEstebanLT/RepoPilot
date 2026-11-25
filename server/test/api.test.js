import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';

test('GET /api/health informa el estado sin revelar credenciales', async () => {
  const response = await request(app).get('/api/health').expect(200);
  assert.equal(response.body.status, 'ok');
  assert.equal(Object.hasOwn(response.body, 'token'), false);
});

test('protege endpoints API frente a clientes no locales', async () => {
  const response = await request(app).get('/api/auth/status').expect(403);
  assert.equal(response.body.error.code, 'LOCAL_CLIENT_REQUIRED');
});

test('valida filtros antes de contactar GitHub', async () => {
  const response = await request(app).get('/api/repositories?page=0').set('X-Repo-Manager', 'local-client').expect(422);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});
