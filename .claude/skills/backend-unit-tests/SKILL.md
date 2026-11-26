---
name: backend-unit-tests
description: Conventions and patterns for writing Vitest + Supertest unit tests for the Taskly Express/Prisma backend without a database. Use when creating or updating tests under backend/tests.
---

# Backend unit tests (Vitest + Supertest)

Location: `backend/tests/<module>.test.ts` (flat folder). Import source with the `.ts` extension: `import { createApp } from '../src/factory.ts'`. Shared fixtures: `backend/tests/fixture.ts` (`record` = Prisma row, `todo` = API shape) — reuse, extend only if needed.

Style used in this repo: top-level `it(...)` (or a single `describe`), a local `setup()` helper returning what the test needs, `it.each` for input tables, `afterEach(() => vi.restoreAllMocks())` when spying.

## No database, ever
Tests run in CI without PostgreSQL. Pick the lowest layer that proves the behaviour:

| Testing | Pattern |
|---|---|
| Validators / mappers | Call the zod schema / mapper directly. These files have a 100% coverage threshold. |
| Router | Mount `createTodosRouter(repository)` on `express()` with `express.json()`; `repository` is an object of `vi.fn()` matching `TodoStore` (see `tests/router.test.ts`). |
| Repository | `const database = createDatabase('postgresql://test:test@localhost:5432/test')` builds a real Prisma client without connecting; `vi.spyOn(database.todo, 'findMany').mockResolvedValue([record])` (see `tests/repository.test.ts`). |
| App wiring / error handler / health | `createApp(database)` with the same fake database; spy `database.todo.findFirst` etc.; hit routes with `supertest`. |
| Startup (`core/lifespan.ts`) | `vi.mock('../src/core/database.ts')` + `vi.mock('../src/core/config.ts')`; set `process.env.API_PORT = '0'` so `listen` picks a free port; close the returned server in `afterEach`. Remove `SIGTERM`/`SIGINT` listeners you caused. |
| Config | Save and restore `process.env` per test (`vi.stubEnv` + `vi.unstubAllEnvs()`). |

## Checklist per route / function
- Happy path asserts status **and** body **and** the repository call arguments.
- Every 4xx branch (422 validation, 404 missing) and that the repository is NOT called on invalid input.
- Error paths: rejected promises → 500 with `{ detail: 'Internal Server Error' }`; silence `console.error` with `vi.spyOn(console, 'error').mockImplementation(() => {})` and assert it was called.
- Dates: compare against fixed ISO strings; use `vi.useFakeTimers()` + `vi.setSystemTime()` for "now".

## Commands (run from repo root)
```sh
npm --prefix backend test -- tests/<file>.test.ts   # one file
npm --prefix backend run typecheck
```
