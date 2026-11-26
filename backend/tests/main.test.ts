import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.resetModules(); vi.restoreAllMocks(); process.exitCode = undefined; });

it('starts the server on import', async () => {
  const start = vi.fn().mockResolvedValue({});
  vi.doMock('../src/core/lifespan.js', () => ({ start }));
  await import('../src/main.ts');
  expect(start).toHaveBeenCalledOnce();
});
it('logs and sets exit code when start fails', async () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.doMock('../src/core/lifespan.js', () => ({ start: vi.fn().mockRejectedValue(new Error('x')) }));
  await import('../src/main.ts');
  await vi.waitFor(() => expect(process.exitCode).toBe(1));
  expect(spy).toHaveBeenCalled();
});
