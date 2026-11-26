import { expect, it, vi } from 'vitest';

const { PrismaPg, PrismaClient } = vi.hoisted(() => ({ PrismaPg: vi.fn(), PrismaClient: vi.fn() }));
vi.mock('@prisma/adapter-pg', () => ({ PrismaPg }));
vi.mock('../src/generated/prisma/client.js', () => ({ PrismaClient }));

import { createDatabase, initialize } from '../src/core/database.ts';

it('creates a prisma client with the pg adapter', () => {
  createDatabase('postgresql://x/y');
  expect(PrismaPg).toHaveBeenCalledWith({ connectionString: 'postgresql://x/y', connectionTimeoutMillis: 10000 });
  expect(PrismaClient).toHaveBeenCalledWith({ adapter: PrismaPg.mock.instances[0] });
});
it('initialize creates the todos table idempotently', async () => {
  const $executeRaw = vi.fn().mockResolvedValue(0);
  await initialize({ $executeRaw } as never);
  expect($executeRaw).toHaveBeenCalledOnce();
  expect($executeRaw.mock.calls[0][0].join('')).toContain('CREATE TABLE IF NOT EXISTS todos');
});
