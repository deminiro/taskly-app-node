#!/usr/bin/env node
// Usage: node coverage-report.mjs <backend|frontend> [repo-relative files...]
// Reads <package>/coverage/coverage-summary.json (run test:coverage first) and prints
// total coverage plus coverage of the given files as JSON.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const pct = (m) => ({ lines: m.lines.pct, statements: m.statements.pct, branches: m.branches.pct, functions: m.functions.pct })

// Summary keys are absolute paths from whichever machine ran the tests; keep the part from "<pkg>/src/".
const repoPath = (abs, pkg) => {
  const p = abs.replaceAll('\\', '/')
  const i = p.lastIndexOf(`/${pkg}/src/`)
  return i >= 0 ? p.slice(i + 1) : p
}

export function coverageReport(pkg, files = [], summaryPath = resolve(pkg, 'coverage', 'coverage-summary.json')) {
  if (!existsSync(summaryPath)) return null
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
  const byFile = Object.fromEntries(
    Object.entries(summary).filter(([key]) => key !== 'total').map(([abs, m]) => [repoPath(abs, pkg), pct(m)]),
  )
  return {
    package: pkg,
    total: pct(summary.total),
    files: files
      .filter((f) => f.startsWith(`${pkg}/`))
      .map((f) => ({ path: f, ...(byFile[f] ?? { note: 'not instrumented (excluded from coverage)' }) })),
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [pkg, ...files] = process.argv.slice(2)
  if (!['backend', 'frontend'].includes(pkg)) {
    console.error('usage: coverage-report.mjs <backend|frontend> [files...]')
    process.exit(2)
  }
  console.log(JSON.stringify(coverageReport(pkg, files), null, 2))
}
