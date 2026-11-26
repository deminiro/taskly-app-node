#!/usr/bin/env node
// Renders the sticky PR comment (markdown, stdout) from the agent's report and the workflow's own
// verification results. Env: AGENT_DIR, RESULT_DIR, PUSHED_SHA, VERIFY_STATUS, MODE_LABEL, RUN_URL, HEAD_SHA.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { coverageReport } from '../../.claude/skills/run-tests-and-coverage/scripts/coverage-report.mjs'

const PACKAGES = ['backend', 'frontend']
const read = (path) => (path && existsSync(path) ? readFileSync(path, 'utf8').trim() : '')
const readJson = (path, fallback) => {
  try { return JSON.parse(read(path)) } catch { return fallback }
}
// Agent output is model-generated and may echo PR content: neutralise HTML/table syntax and mentions.
export const esc = (s) =>
  String(s ?? '').replace(/[|<>]/g, (c) => `&#${c.charCodeAt(0)};`).replace(/@/g, '@​').replace(/\r?\n/g, ' ')

export function render(env) {
  const agentDir = env.AGENT_DIR ?? ''
  const resultDir = env.RESULT_DIR ?? ''
  const report = readJson(join(agentDir, 'report.json'), { decision: 'failed', reason: 'The agent did not produce a report.' })
  const changes = readJson(join(agentDir, 'changes.json'), { files: [], work: [] })
  const patchState = read(join(resultDir, 'patch.txt'))
  const out = ['<!-- test-agent -->', `## 🧪 Test agent (${env.MODE_LABEL ?? 'PR'} mode)`, '']
  const icon = { tests_added: '✅', tests_updated: '✅', skipped: '⏭️', failed: '❌' }[report.decision] ?? '❔'
  out.push(`**Decision:** ${icon} \`${esc(report.decision)}\` — ${esc(report.reason)}`, '')

  if (patchState === 'rejected') {
    out.push('> [!CAUTION]', '> The agent patch was **rejected** by the test-file allowlist and was not applied:', '>')
    for (const line of read(join(resultDir, 'validation.txt')).split('\n')) out.push(`> - ${esc(line)}`)
    out.push('')
  } else if (env.VERIFY_STATUS === 'failed') {
    out.push('> [!WARNING]', '> Verification failed, so nothing was committed. The agent patch is attached to the workflow run (artifact `test-agent`).', '')
  } else if (env.PUSHED_SHA) {
    out.push(`Generated tests passed verification and were committed in ${env.PUSHED_SHA}.`, '')
  }

  const analysed = report.analysed_files?.length
    ? report.analysed_files
    : changes.files.filter((f) => PACKAGES.includes(f.kind)).map((f) => ({ path: f.path, needs_tests: !!f.testable, why: f.note ?? '' }))
  if (analysed.length) {
    out.push('<details open><summary><b>Analysed source files</b></summary>', '', '| File | Needs tests | Why |', '|---|---|---|')
    for (const f of analysed) out.push(`| \`${esc(f.path)}\` | ${f.needs_tests ? 'yes' : 'no'} | ${esc(f.why)} |`)
    out.push('', '</details>', '')
  }

  if (report.test_files?.length) {
    out.push('<details open><summary><b>Tests written by the agent</b></summary>', '')
    for (const t of report.test_files) {
      out.push(`- \`${esc(t.path)}\` (${esc(t.action)})`)
      for (const name of t.tests ?? []) out.push(`  - ${esc(name)}`)
    }
    out.push('', '</details>', '')
  }

  const runs = PACKAGES.map((pkg) => ({
    pkg,
    status: read(join(resultDir, `status-${pkg}.txt`)),
    vitest: readJson(join(resultDir, `vitest-${pkg}.json`), null),
    before: coverageReport(pkg, [], join(agentDir, `baseline-${pkg}.json`)),
    after: coverageReport(pkg, analysed.map((f) => f.path), join(resultDir, `coverage-${pkg}.json`)),
  })).filter((r) => r.status)

  if (runs.length) {
    const fmt = (c, k) => (c ? `${c.total[k]}%` : '–')
    out.push('### Verification (re-run by the workflow, not self-reported by the agent)', '',
      '| Package | Typecheck + tests | Passed | Failed | Lines before → after | Branches before → after |', '|---|---|---|---|---|---|')
    for (const r of runs) {
      out.push(`| ${r.pkg} | ${r.status === 'passed' ? '✅ passed' : '❌ failed'} | ${r.vitest?.numPassedTests ?? '–'} | ${r.vitest?.numFailedTests ?? '–'} | ${fmt(r.before, 'lines')} → ${fmt(r.after, 'lines')} | ${fmt(r.before, 'branches')} → ${fmt(r.after, 'branches')} |`)
    }
    out.push('')
    const rows = runs.flatMap((r) => r.after?.files ?? [])
    if (rows.length) {
      out.push('<details><summary><b>Coverage of analysed files</b></summary>', '', '| File | Lines | Branches | Functions |', '|---|---|---|---|')
      for (const f of rows) out.push(f.note ? `| \`${esc(f.path)}\` | ${esc(f.note)} | | |` : `| \`${esc(f.path)}\` | ${f.lines}% | ${f.branches}% | ${f.functions}% |`)
      out.push('', '</details>', '')
    }
    const failures = runs.flatMap((r) => (r.vitest?.testResults ?? []).flatMap((file) =>
      (file.assertionResults ?? []).filter((a) => a.status === 'failed').map((a) => `${a.fullName}: ${String(a.failureMessages?.[0] ?? '').split('\n')[0]}`.slice(0, 300))))
    if (failures.length) out.push('<details open><summary><b>Failing tests</b></summary>', '', '```text', ...failures.slice(0, 20), '```', '', '</details>', '')
  }

  if (report.suspected_bugs?.length) out.push('### Possible bugs found by the tests', '', ...report.suspected_bugs.map((b) => `- ${esc(b)}`), '')
  if (report.failed_attempts?.length) out.push('### Tests the agent could not make pass (dropped)', '', ...report.failed_attempts.map((b) => `- ${esc(b)}`), '')
  if (report.skills_used?.length) out.push(`**Skills used:** ${report.skills_used.map((s) => `\`${esc(s)}\``).join(', ')}`, '')
  out.push(`<sub>Agent \`.claude/agents/test-engineer.md\` · [workflow run](${env.RUN_URL ?? '#'}) · head ${String(env.HEAD_SHA ?? '').slice(0, 7)} · add the \`skip-test-agent\` label to opt out</sub>`)
  return out.join('\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(render(process.env))
