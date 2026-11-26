import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveDatabaseUrl } from '../src/core/config.ts';

const names = ['DATABASE_URL', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_HOST', 'DB_PORT', 'POSTGRES_DB'];

describe('resolveDatabaseUrl', () => {
  beforeEach(() => { for (const n of names) vi.stubEnv(n, ''); });
  afterEach(() => vi.unstubAllEnvs());

  it('prefers the override and normalises the psycopg scheme', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://env/db');
    expect(resolveDatabaseUrl('postgresql+psycopg://u:p@h/db')).toBe('postgresql://u:p@h/db');
  });
  it('uses DATABASE_URL when no override', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://env/db');
    expect(resolveDatabaseUrl()).toBe('postgresql://env/db');
  });
  it('builds the url from discrete variables', () => {
    vi.stubEnv('POSTGRES_USER', 'user');
    vi.stubEnv('POSTGRES_PASSWORD', 'p@ss');
    vi.stubEnv('POSTGRES_HOST', 'db');
    vi.stubEnv('DB_PORT', '5433');
    vi.stubEnv('POSTGRES_DB', 'my db');
    expect(resolveDatabaseUrl()).toBe('postgresql://user:p%40ss@db:5433/my%20db');
  });
  it('throws naming the missing variable', () => {
    vi.stubEnv('POSTGRES_USER', 'user');
    expect(() => resolveDatabaseUrl()).toThrow('Missing environment variable: POSTGRES_PASSWORD');
  });
});
