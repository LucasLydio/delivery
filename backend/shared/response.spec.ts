import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import { apiResponse } from './response';

test('shared response helpers apply the standard status for every HTTP operation', async () => {
  const app = express();
  app.get('/', (_req, res) => {
    apiResponse.get(res, { method: 'get' });
  });
  app.post('/', (_req, res) => {
    apiResponse.post(res, { method: 'post' });
  });
  app.put('/', (_req, res) => {
    apiResponse.put(res, { method: 'put' });
  });
  app.delete('/', (_req, res) => {
    apiResponse.delete(res);
  });
  app.patch('/', (_req, res) => {
    apiResponse.patch(res, { method: 'patch' });
  });
  app.options('/', (_req, res) => {
    apiResponse.options(res);
  });

  const statuses = await Promise.all([
    request(app).get('/'),
    request(app).post('/'),
    request(app).put('/'),
    request(app).delete('/'),
    request(app).patch('/'),
    request(app).options('/'),
  ]);
  assert.deepEqual(
    statuses.map(({ status }) => status),
    [200, 201, 200, 204, 200, 204],
  );
});
