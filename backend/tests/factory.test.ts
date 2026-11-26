import request from 'supertest';
import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '../src/factory.ts';
import { record } from './fixture.ts';

function db(overrides: Record<string, unknown> = {}) {
  return { todo: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([record]), ...overrides } } as never;
}
afterEach(() => vi.restoreAllMocks());

it('serves health, todos and the openapi document', async () => {
  const app = createApp(db());
  expect((await request(app).get('/api/health')).body).toEqual({ status: 'ok' });
  expect((await request(app).get('/api/todos')).body).toHaveLength(1);
  const spec = await request(app).get('/openapi.json');
  expect(spec.status).toBe(200);
  expect(spec.body).toHaveProperty('openapi');
  expect((await request(app).get('/docs/')).status).toBe(200);
});
it('does not expose x-powered-by', async () => {
  expect((await request(createApp(db())).get('/api/health')).headers['x-powered-by']).toBeUndefined();
});
it('returns 404 json for unknown routes', async () => {
  const response = await request(createApp(db())).get('/nope');
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ detail: 'Not Found' });
});
it('returns 422 for malformed JSON', async () => {
  const response = await request(createApp(db())).post('/api/todos').set('content-type', 'application/json').send('{bad');
  expect(response.status).toBe(422);
  expect(response.body).toEqual({ detail: 'Invalid JSON.' });
});
it('returns 413 for oversized bodies', async () => {
  const response = await request(createApp(db())).post('/api/todos').send({ title: 'x'.repeat(200_000) });
  expect(response.status).toBe(413);
  expect(response.body).toEqual({ detail: 'Request body too large.' });
});
it('returns 500 and logs unexpected errors', async () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const response = await request(createApp(db({ findMany: vi.fn().mockRejectedValue(new Error('boom')) }))).get('/api/todos');
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ detail: 'Internal Server Error' });
  expect(spy).toHaveBeenCalled();
});
