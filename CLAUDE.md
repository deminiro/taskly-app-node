# Taskly App Node

- `backend/` — Express 5 + Prisma 7 (PostgreSQL) API, Vitest + Supertest tests in `backend/tests/`.
- `frontend/` — React 19 + Vite + React Query + styled-components, Vitest + RTL tests next to sources.
- Node >= 22.12. Each package is independent: `npm --prefix <pkg> ci | test | run typecheck | run test:coverage`.

## Testing
Unit tests never need a database or network. For writing or updating tests use the `test-engineer`
agent (`.claude/agents/test-engineer.md`) and its skills in `.claude/skills/`. The same agent runs on
every pull request via `.github/workflows/test-agent.yml` — see `SOLUTION.md`.
