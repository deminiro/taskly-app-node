// Run: node --test .github/scripts
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { classify } from '../../.claude/skills/analyze-pr-changes/scripts/changed-files.mjs'
import { esc, render } from './pr-comment.mjs'
import { rejectedPaths } from './validate-patch.mjs'

const validator = new URL('./validate-patch.mjs', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
const newFilePatch = (path, body = 'x') =>
  `diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n@@ -0,0 +1 @@\n+${body}\n`

function validate(patchText) {
  const file = join(mkdtempSync(join(tmpdir(), 'patch-')), 'p.patch')
  writeFileSync(file, patchText)
  try {
    execFileSync('node', [validator, file], { encoding: 'utf8' })
    return 0
  } catch (error) {
    return error.status
  }
}

test('allowlist accepts only test files', () => {
  assert.deepEqual(rejectedPaths(['backend/tests/a.test.ts', 'frontend/src/x/A.test.tsx', 'frontend/src/test/wrap.tsx']), [])
  for (const bad of ['backend/src/factory.ts', 'backend/tests/../src/x.ts', '.github/workflows/ci.yml', 'frontend/package.json', 'frontend/vite.config.ts', 'frontend/src/App.tsx', '.claude/agents/test-engineer.md']) {
    assert.deepEqual(rejectedPaths([bad]), [bad], bad)
  }
})

test('validator rejects patches that touch source or add symlinks, accepts test-only patches', () => {
  assert.equal(validate(newFilePatch('backend/tests/ok.test.ts')), 0)
  assert.equal(validate(newFilePatch('backend/tests/ok.test.ts') + newFilePatch('backend/src/evil.ts')), 1)
  assert.equal(validate(newFilePatch('backend/tests/link.ts').replace('100644', '120000')), 1)
})

test('classifier maps sources to conventional test files and skips non-testable files', () => {
  assert.equal(classify('backend/src/core/config.ts').testFile, 'backend/tests/config.test.ts')
  assert.equal(classify('frontend/src/lib/http.ts').testFile, 'frontend/src/lib/http.test.ts')
  assert.equal(classify('frontend/src/features/todos/types.ts').testable, false)
  assert.equal(classify('frontend/src/design-system/components/Button/Button.tsx').testable, false)
  assert.equal(classify('backend/src/factory.ts', 'D').testable, false)
  assert.equal(classify('README.md').kind, 'non-code')
  assert.equal(classify('backend/tests/router.test.ts').kind, 'test')
})

test('comment escapes model output and reports a missing report as failure', () => {
  assert.equal(esc('a|b <img> @user\nx'), 'a&#124;b &#60;img&#62; @​user x')
  const empty = mkdtempSync(join(tmpdir(), 'agent-'))
  const md = render({ AGENT_DIR: empty, RESULT_DIR: empty, RUN_URL: 'u' })
  assert.match(md, /^<!-- test-agent -->/)
  assert.match(md, /`failed` — The agent did not produce a report\./)
})
