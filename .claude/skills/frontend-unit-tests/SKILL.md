---
name: frontend-unit-tests
description: Conventions and patterns for writing Vitest + React Testing Library unit tests for the Taskly React frontend (components, hooks, API client). Use when creating or updating frontend/src/**/*.test.ts(x).
---

# Frontend unit tests (Vitest + React Testing Library)

Location: next to the source, `Foo.tsx` → `Foo.test.tsx`, `foo.ts` → `foo.test.ts`. Environment is jsdom; `src/test/setup.ts` loads jest-dom matchers and runs `cleanup`. Fixture: `todoFixture` from `src/test/todoFixture.ts` (spread and override fields).

Style used in this repo: top-level `it(...)`, `userEvent.setup()` for interaction, queries by role/label/text (not test ids, except the design-system mocks' `data-testid`), `vi.mocked(fn)` for typed mocks.

## Patterns

| Testing | Pattern |
|---|---|
| Component using the design system | `vi.mock('../../design-system', () => import('../../design-system/mocks'))` (adjust path) — renders plain HTML, no ThemeProvider needed. |
| Component composed of other feature components | Mock children to focus on the unit (see `TodosPage.test.tsx`). |
| Hooks using React Query | `renderHook(() => useX(), { wrapper })` where `wrapper` is `({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>` with `new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })`. Seed with `client.setQueryData(todoKeys.list, [...])`, assert with `client.getQueryData(...)`. Mock the API module: `vi.mock('../api/todos', () => ({ todosApi: { create: vi.fn(), ... } }))`. |
| Plain hooks (`useState`, timers) | `renderHook` + `act`; `vi.useFakeTimers()` and `vi.advanceTimersByTime()`; restore with `vi.useRealTimers()`. |
| `lib/http.ts` | `vi.stubGlobal('fetch', vi.fn())` returning `new Response(JSON.stringify(body), { status })`; `vi.unstubAllGlobals()` in `afterEach`. Cover network failure, aborted signal, 204, 422, error `detail`, non-JSON error body. |
| API client (`features/todos/api/todos.ts`) | Mock `lib/http` `request` and assert path + init (see `api/todos.test.ts`). |
| Providers | Render with a real `QueryClient` and assert children render. |

## Checklist
- Each conditional render branch (empty / loading / error / populated, disabled states).
- Each callback prop fires with the right arguments after a user action.
- Accessible names: prefer `getByRole('button', { name: '...' })` — this doubles as an a11y check.
- Await async UI with `findBy*` / `waitFor`; never `setTimeout` sleeps.
- Dates: `isOverdue` depends on "today" → use fake timers with `vi.setSystemTime`.

## Commands (run from repo root)
```sh
npm --prefix frontend test -- src/path/Foo.test.tsx   # one file
npm --prefix frontend run typecheck
```
