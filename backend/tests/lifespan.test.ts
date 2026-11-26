import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  createDatabase: vi.fn(), initialize: vi.fn(), resolveDatabaseUrl: vi.fn(), createApp: vi.fn(),
}));
vi.mock('../src/core/database.js', () => ({ createDatabase: m.createDatabase, initialize: m.initialize }));
vi.mock('../src/core/config.js', () => ({ resolveDatabaseUrl: m.resolveDatabaseUrl }));
vi.mock('../src/factory.js', () => ({ createApp: m.createApp }));

import { start } from '../src/core/lifespan.ts';

let database: { $connect: ReturnType<typeof vi.fn>; $disconnect: ReturnType<typeof vi.fn> };
let listener: EventEmitter & { address: () => { port: number }; close: ReturnType<typeof vi.fn> };
let listen: ReturnType<typeof vi.fn>;

beforeEach(() => {
  database = { $connect: vi.fn().mockResolvedValue(undefined), $disconnect: vi.fn().mockResolvedValue(undefined) };
  m.createDatabase.mockReturnValue(database);
  m.initialize.mockResolvedValue(undefined);
  m.resolveDatabaseUrl.mockReturnValue('postgresql://x');
  listener = Object.assign(new EventEmitter(), { address: () => ({ port: 8000 }), close: vi.fn((cb: () => void) => cb()) });
  listen = vi.fn((port: number, host: string, cb: () => void) => { queueMicrotask(cb); return listener; });
  m.createApp.mockReturnValue({ listen });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  process.removeAllListeners('SIGTERM');
  process.removeAllListeners('SIGINT');
  process.exitCode = undefined;
});

it('connects, initialises and listens on API_PORT', async () => {
  vi.stubEnv('API_PORT', '9001');
  const result = await start();
  expect(database.$connect).toHaveBeenCalled();
  expect(m.initialize).toHaveBeenCalledWith(database);
  expect(listen).toHaveBeenCalledWith(9001, '0.0.0.0', expect.any(Function));
  expect(result.database).toBe(database);
});
it('defaults to port 8000', async () => {
  vi.stubEnv('API_PORT', '');
  await start();
  expect(listen.mock.calls[0][0]).toBe(8000);
});
it('disconnects and rethrows when startup fails', async () => {
  database.$connect.mockRejectedValue(new Error('down'));
  await expect(start()).rejects.toThrow('down');
  expect(database.$disconnect).toHaveBeenCalled();
});
it('rejects when the listener emits an error', async () => {
  listen.mockImplementation(() => listener);
  const promise = start();
  await vi.waitFor(() => expect(listener.listenerCount('error')).toBe(1));
  listener.emit('error', new Error('EADDRINUSE'));
  await expect(promise).rejects.toThrow('EADDRINUSE');
  expect(database.$disconnect).toHaveBeenCalled();
});
it('shuts down gracefully on SIGTERM', async () => {
  await start();
  process.emit('SIGTERM');
  await vi.waitFor(() => expect(database.$disconnect).toHaveBeenCalled());
  expect(listener.close).toHaveBeenCalled();
  expect(process.exitCode).toBeUndefined();
});
it('sets exit code when disconnect fails during shutdown', async () => {
  await start();
  database.$disconnect.mockRejectedValue(new Error('x'));
  process.emit('SIGINT');
  await vi.waitFor(() => expect(process.exitCode).toBe(1));
});
