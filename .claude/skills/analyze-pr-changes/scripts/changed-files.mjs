#!/usr/bin/env node
// Usage: node changed-files.mjs [baseRef]   (no baseRef = uncommitted changes vs HEAD)
// Prints JSON: every changed file classified, with its conventional test file.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { basename, dirname, extname, posix } from 'node:path'
import { pathToFileURL } from 'node:url'

const NOT_TESTABLE = [
  /\/types\.ts$/, /\.types\.ts$/, /\.d\.ts$/, /\/index\.ts$/, /\.stories\.tsx?$/,
  /\.constants\.ts$/, /\/constants\.tsx?$/, /^backend\/src\/generated\//,
  /^frontend\/src\/design-system\//, /^frontend\/src\/main\.tsx$/,
  /^frontend\/src\/test\//, /^frontend\/src\/lib\/queryClient\.ts$/,
  /^frontend\/src\/features\/todos\/api\/queryKeys\.ts$/,
]

export function classify(path, status = 'M') {
  const isTest = /\.test\.tsx?$/.test(path) || path.startsWith('backend/tests/')
  if (isTest) return { path, status, kind: 'test' }
  const backend = /^backend\/src\/.+\.ts$/.test(path)
  const frontend = /^frontend\/src\/.+\.tsx?$/.test(path)
  if (!backend && !frontend) return { path, status, kind: 'non-code' }
  const kind = backend ? 'backend' : 'frontend'
  if (status === 'D') return { path, status, kind, testable: false, note: 'deleted; check for orphaned tests' }
  if (NOT_TESTABLE.some((re) => re.test(path))) return { path, status, kind, testable: false, note: 'excluded by convention' }
  const ext = extname(path)
  const testFile = backend
    ? `backend/tests/${basename(path, ext)}.test.ts`
    : posix.join(dirname(path), `${basename(path, ext)}.test${ext}`)
  return { path, status, kind, testable: true, testFile, testFileExists: existsSync(testFile) }
}

function changedFiles(base) {
  const args = base ? ['diff', '--name-status', '--no-renames', `${base}...HEAD`] : ['status', '--porcelain', '--untracked-files=all']
  const out = execFileSync('git', args, { encoding: 'utf8' })
  return out.split('\n').filter(Boolean).map((line) =>
    base ? { status: line[0], path: line.split('\t')[1] } : { status: line.startsWith('??') ? 'A' : line.slice(0, 2).trim()[0], path: line.slice(3) },
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = changedFiles(process.argv[2]).map(({ path, status }) => classify(path, status))
  const testFilesInDiff = files.filter((f) => f.kind === 'test').map((f) => f.path)
  for (const f of files) if (f.testFile) f.testFileChangedInDiff = testFilesInDiff.includes(f.testFile)
  console.log(JSON.stringify({ files, work: files.filter((f) => f.testable).map((f) => f.path) }, null, 2))
}
