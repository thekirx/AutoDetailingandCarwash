/**
 * Cross-platform unit runner for node:test (Windows-safe).
 * node scripts/run-unit-tests.mjs
 */
import { readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'tests')

/**
 * Walk tests/ recursively.
 *
 * BUG-056: this used to be a flat readdirSync with a `.test.js`-only filter, so
 * three real node:test suites written as `.test.mjs` (homeHero, publicHome-
 * Content, hero-video-assets) were silently never executed — 10 assertions that
 * looked like coverage and were not. The walker also means a future
 * tests/integration/ folder is picked up instead of vanishing.
 */
function discover(current) {
  const out = []
  for (const entry of readdirSync(current)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(current, entry)
    if (statSync(full).isDirectory()) {
      out.push(...discover(full))
      continue
    }
    const isSuite = entry.endsWith('.test.js') || entry.endsWith('.test.mjs')
    // Browser suites need a running preview server; `npm run test:browser`.
    if (isSuite && !entry.includes('.browser.test.')) {
      out.push(relative(root, full).split('\\').join('/'))
    }
  }
  return out
}

const files = discover(dir).sort()

if (!files.length) {
  console.error('No tests/*.test.js{,.mjs} found')
  process.exit(1)
}

const r = spawnSync(process.execPath, ['--test', ...files], {
  cwd: root,
  encoding: 'utf8',
  shell: false,
  env: process.env,
  maxBuffer: 40 * 1024 * 1024,
  stdio: 'inherit',
})
process.exit(r.status ?? 1)
