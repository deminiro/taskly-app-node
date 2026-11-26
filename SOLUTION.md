# Solution: test-engineer agent, skills and PR workflow

## What it does

| Piece | Where | Role |
|---|---|---|
| Custom agent | [`.claude/agents/test-engineer.md`](.claude/agents/test-engineer.md) | Decides whether tests are needed, writes or updates Vitest tests, verifies them, and writes a structured report. It only writes test files and never changes production code. |
| Skill `analyze-pr-changes` | [`.claude/skills/analyze-pr-changes/`](.claude/skills/analyze-pr-changes/SKILL.md) | Classifies the files a PR changes and maps each source file to its conventional test file. A script does this deterministically. |
| Skill `backend-unit-tests` | [`.claude/skills/backend-unit-tests/`](.claude/skills/backend-unit-tests/SKILL.md) | How to test Express + Prisma code without a database: fake `TodoStore`, Prisma client spies, Supertest. |
| Skill `frontend-unit-tests` | [`.claude/skills/frontend-unit-tests/`](.claude/skills/frontend-unit-tests/SKILL.md) | How to test React with RTL: the design-system mocks, React Query wrappers, `fetch` stubs and fake timers. |
| Skill `run-tests-and-coverage` | [`.claude/skills/run-tests-and-coverage/`](.claude/skills/run-tests-and-coverage/SKILL.md) | Runs typecheck, tests and coverage, reports per-file coverage, and runs the bounded fix loop. |
| Agentic workflow | [`.github/workflows/test-agent.yml`](.github/workflows/test-agent.yml) | Runs on every PR (PR mode) or manually (coverage mode). |
| Deterministic CI | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | Typecheck, tests and coverage for both packages, plus self-tests of the workflow scripts. |
| Guard rails | [`.github/scripts/`](.github/scripts) | Test-file allowlist for the agent's patch (`validate-patch.mjs`) and the PR comment renderer (`pr-comment.mjs`), both with tests (`scripts.test.mjs`). |

The skills are plain `SKILL.md` folders, so they're reusable. The same agent works locally (`claude --agent test-engineer`), as a subagent in an interactive session, and in CI. The two helper scripts are used both by the agent (through the skills) and by the workflow.

## Main technical decisions

1. **Claude Code + Claude Code Action as the agent environment.** Agents and skills are files in the repo, versioned and reviewed like code, so local and CI runs use identical definitions. The action gives a headless runner with tool allowlists and turn limits.
2. **Three jobs with separate privileges.** The model is never in the same job as a write credential.
   - `generate`: holds the model token and a **read-only** GitHub token, checks out with `persist-credentials: false`, and runs the agent. Its only output is a patch plus a report, uploaded as an artifact.
   - `verify`: **no secrets, read-only**. It validates the patch against the allowlist, applies it, then runs typecheck, tests and coverage itself. The agent's own claim that tests pass is not trusted. Agent-written test code only ever runs here.
   - `publish`: has `contents: write` and `pull-requests: write`, and **runs no agent-written code**. It re-validates the patch, makes sure the branch hasn't moved, commits, and updates one sticky PR comment.
3. **Fail closed on the patch.** Only `backend/tests/**/*.ts`, `frontend/src/**/*.test.ts(x)` and `frontend/src/test/**` are accepted. Any other path, `..`, a rename, binary content, a symlink, a submodule or an executable mode rejects the whole patch. The PR check then goes red and the comment says why. The validator comes from the checkout *before* the patch is applied, so the agent can't change it.
4. **Least-privilege tools for the agent.** Read, Glob, Grep, Edit and Write, plus Bash limited to `npm --prefix <pkg> test|typecheck|test:coverage`, the two skill scripts and read-only `git diff|status|log`. WebFetch and WebSearch are disabled. Turns are capped (60 in PR mode, 150 in coverage mode) and the job has a timeout.
5. **Prompt-injection posture.** The agent is told to treat the diff, comments and PR text as data. PR title and body are never put into the prompt or into `run:` scripts. Branch names reach scripts only through `env`. Agent text in the PR comment is escaped (no HTML, no table breaking, no @-mentions).
6. **The agent decides.** A cheap deterministic pre-filter (the `analyze-pr-changes` script) skips the model entirely when no testable source changed: docs, config, types, styles, stories or tests only. The comment then says "skipped" with the reason. Otherwise the agent decides per file whether tests are warranted and explains why in the comment.
7. **Correct over green.** The agent may not weaken existing assertions or touch source. A test that exposes a real bug is kept as `it.todo` and listed under *Possible bugs found*. A test it can't fix in 3 iterations is dropped and listed.
8. **Reliability.** Per-PR concurrency with cancel-in-progress. The commit is skipped if the branch moved after the agent ran (the newer push gets its own run). Actions are pinned to commit SHAs. Artifacts are kept 14 days so a rejected or failed patch can be inspected.

## How to run it

Prerequisites (once per repository):

1. Add the repository secret **`CLAUDE_CODE_OAUTH_TOKEN`** (create it with `claude setup-token`). `ANTHROPIC_API_KEY` works too if you swap the input in `test-agent.yml`.
2. For coverage mode only: Settings → Actions → General → enable **"Allow GitHub Actions to create and approve pull requests"**.
3. Actions must be enabled. Nothing else needs installing: Node 22 and the dependencies are set up by the workflow.

Usage:

- **PR mode:** open or update a non-draft PR from a branch in this repository. The `Test agent` check runs, pushes a `test: …` commit to the branch when tests were added, and posts or updates one comment. Add the `skip-test-agent` label to opt out.
- **Coverage mode:** Actions → *Test agent* → *Run workflow* → choose the packages. The agent raises coverage and the workflow opens a PR with the verified tests and results.
- **Locally:** `claude --agent test-engineer "Add tests for my uncommitted changes"`.

## Example runs

Before the agent, coverage was **backend 33.0% lines / 33.3% branches** and **frontend 47.7% lines / 43.8% branches**.

<!-- EXAMPLE-RUNS -->

## Assumptions

- Unit tests are the target. Neither package needs a database, network or browser, so the existing Vitest setups are enough.
- PR authors are repository collaborators. The workflow runs the PR's code (install scripts, tests), which is the normal trust level for `pull_request` from the same repository.
- A commit pushed back to the PR branch by the bot is acceptable to the team. Committing is the default because it makes the tests part of the reviewed change.
- The test conventions already in the repo (flat `backend/tests`, co-located frontend tests, design-system mocks) are the ones to follow.

## Limitations

- **Fork PRs are skipped.** `pull_request` from forks has no secrets, and using `pull_request_target` would mean running untrusted code next to secrets.
- **The bot commit doesn't trigger CI again.** Pushes made with `GITHUB_TOKEN` don't start workflows. The `verify` job already ran the full typecheck and coverage on exactly that tree, but required-status rules see the previous commit.
- LLM output is not deterministic. Two runs can produce different (both valid) tests, and quality depends on turn limits and the model.
- Each run costs model tokens. Large PRs may hit the turn cap, and the report then shows partial work.
- Coverage numbers measure lines executed, not whether the assertions are any good.
- The allowlist checks *where* the agent writes, not *what* the tests do. Test code runs only in the secret-less, read-only `verify` job.

## For production I would

- Use a GitHub App identity for the bot commit so CI re-runs on it, plus branch protection that requires both CI and the test agent.
- Run mutation testing (e.g. StrykerJS) on the changed files to measure test strength, and feed the surviving mutants back to the agent.
- Offer a "suggest" mode: post the tests as review suggestions or as a stacked PR instead of committing, chosen per label.
- Add per-file coverage thresholds that ratchet up after each coverage-mode PR, plus a diff-coverage gate.
- Add cost and turn budgets per PR size, cache `node_modules`, and send token usage to the step summary.
- Support fork PRs with a two-workflow `workflow_run` pattern: an untrusted build without secrets, then a trusted job that only handles artifacts.
- Add an eval set of past PRs with known-good tests, to measure changes to the agent and skills before rolling them out.
