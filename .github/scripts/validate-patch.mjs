#!/usr/bin/env node
// Usage: node validate-patch.mjs <patch>
// Fails closed unless every file in the agent's patch is a test file. Exit 0 = ok, 1 = rejected.
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const ALLOWED = [
  /^backend\/tests\/[\w./-]+\.ts$/,
  /^frontend\/src\/[\w./-]+\.test\.tsx?$/,
  /^frontend\/src\/test\/[\w./-]+\.tsx?$/,
]

export function rejectedPaths(paths) {
  return paths.filter((p) => p.includes('..') || !ALLOWED.some((re) => re.test(p)))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const patch = process.argv[2]
  const numstat = execFileSync('git', ['apply', '--numstat', '-z', patch], { encoding: 'utf8' })
  const entries = numstat.split('\0').filter(Boolean).map((e) => e.split('\t'))
  const problems = []
  for (const [added, , path] of entries) {
    if (!path) problems.push('rename/copy entries are not allowed')
    else if (added === '-') problems.push(`${path}: binary content is not allowed`)
  }
  const summary = execFileSync('git', ['apply', '--summary', patch], { encoding: 'utf8' })
  if (/mode 120000|mode 160000|mode 100755/.test(summary)) problems.push('symlinks, submodules and executables are not allowed')
  const paths = entries.map(([, , p]) => p).filter(Boolean)
  for (const p of rejectedPaths(paths)) problems.push(`${p}: outside the test-file allowlist`)
  if (problems.length) {
    console.log(problems.join('\n'))
    process.exit(1)
  }
  console.log(`ok: ${paths.length} test file(s)`)
}
