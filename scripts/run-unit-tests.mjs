/**
 * Cross-platform unit runner for node:test (Windows-safe).
 * node scripts/run-unit-tests.mjs
 */
import { readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'tests')
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => join('tests', f))
  .sort()

if (!files.length) {
  console.error('No tests/*.test.js found')
  process.exit(1)
}

const isWin = process.platform === 'win32'
const r = spawnSync(process.execPath, ['--test', ...files], {
  cwd: root,
  encoding: 'utf8',
  shell: false,
  env: process.env,
  maxBuffer: 40 * 1024 * 1024,
  stdio: 'inherit',
})
process.exit(r.status ?? 1)
void isWin
