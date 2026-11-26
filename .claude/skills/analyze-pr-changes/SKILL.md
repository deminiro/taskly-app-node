---
name: analyze-pr-changes
description: Lists and classifies the files changed in a pull request (or working tree) for the Taskly repo, maps each source file to its conventional test file, and produces the work list for test generation. Use before writing tests for changed code.
---

# Analyse PR changes

1. Get the classified change list:

   ```sh
   node .claude/skills/analyze-pr-changes/scripts/changed-files.mjs "$BASE_SHA"   # PR mode
   node .claude/skills/analyze-pr-changes/scripts/changed-files.mjs               # local: uncommitted changes
   ```

   Each entry has `kind` (`backend` | `frontend` | `test` | `non-code`), `testable`, the conventional `testFile`, whether it exists, and whether it was already changed in this diff.

2. For every file in `work`, read the diff of that file only:

   ```sh
   git diff "$BASE_SHA"...HEAD -- <path>
   ```

   and read the full current file plus its existing test file (if any). Look for: new exports, new branches/conditions, changed signatures, new routes/status codes, new UI states or callbacks.

3. Decide per file (see the decision policy in the agent). Typical "no tests" cases: rename/format-only change, comment-only change, a change already exercised by a test file changed in the same diff (confirm by running it).

4. Check the callers of changed functions (`Grep` for the export name) — a changed signature can break existing tests that are not in the diff; include those test files in the work list.

Output for the next step: the list of `{ sourceFile, testFile, behavioursToCover[] }`.

Notes:
- Backend tests live in `backend/tests/<module>.test.ts` (flat). Frontend tests sit next to the file: `X.tsx` → `X.test.tsx`.
- `frontend/src/design-system/**` is excluded from coverage and not tested by convention.
