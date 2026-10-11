import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// The GitHub repo is public. Staff passwords live in .env (VITE_DEMO_PASSWORD_*),
// never in a tracked file. This pins the shape every committed one used.
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const STAFF_PASSWORD = /Hakum[A-Z][A-Za-z]*20\d\d!/

test('no tracked file contains a staff password', () => {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)
  const leaking = files.filter((f) => {
    try {
      return STAFF_PASSWORD.test(readFileSync(join(root, f), 'utf8'))
    } catch {
      return false
    }
  })
  assert.deepEqual(leaking, [], `staff passwords committed in: ${leaking.join(', ')}`)
})
