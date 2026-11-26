---
name: run-tests-and-coverage
description: Runs the Taskly backend/frontend Vitest suites with type checking and coverage, reads per-file coverage for changed files, and drives the fix loop for failing generated tests. Use after writing or updating tests, and to verify a PR's test changes.
---

# Run tests and coverage

Run from the repo root, only for packages you touched (`backend`, `frontend`).

1. **Fast loop** while writing — single file:
   ```sh
   npm --prefix <pkg> test -- <path relative to pkg>
   ```
2. **Type check** — test files are type-checked too (`tsconfig.json` includes them):
   ```sh
   npm --prefix <pkg> run typecheck
   ```
3. **Full suite with coverage** — must be green before you report:
   ```sh
   npm --prefix <pkg> run test:coverage
   ```
   Coverage thresholds in `backend/vitest.config.ts` / `frontend/vite.config.ts` make this command fail if coverage drops. A threshold failure on a file you did not touch is pre-existing — report it, do not edit the config.
4. **Coverage of the changed files**:
   ```sh
   node .claude/skills/run-tests-and-coverage/scripts/coverage-report.mjs <pkg> <changed source files...>
   ```
   Aim for every changed line and branch covered. If a changed file is below 80% lines, look at the uncovered lines in the text report and add tests for meaningful behaviour (not for trivial getters).

## Fix loop (max 3 iterations per failing test)
- Read the failure. Decide: is the **test** wrong (wrong selector, missing await, missing mock, wrong expectation about existing behaviour) → fix the test. Is the **code** wrong (behaviour contradicts the PR description, validation, types, or the obvious intent) → keep the test as `it.todo('<what is broken>')` and add an entry to `suspected_bugs`. Never edit production code.
- Flaky signals (passes alone, fails in suite; time-dependent) → isolate state: `vi.restoreAllMocks()`, fake timers, fresh `QueryClient` per test.
- After 3 failed iterations delete that test and record it in `failed_attempts`.

Record each final run in the report `runs` array: package, command, passed and failed counts (from the Vitest summary line `Tests  N passed`).
