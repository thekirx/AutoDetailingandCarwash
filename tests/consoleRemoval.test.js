import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  ASSISTANT_GRANT_LABELS,
  DEFAULT_ASSISTANT_GRANTS,
  ROLES,
  allowRoute,
} from '../src/auth/permissions.js'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

describe('Console module removal', () => {
  it('has no Console grant or accessible route for any operations role', () => {
    assert.equal(Object.hasOwn(DEFAULT_ASSISTANT_GRANTS, 'console'), false)
    assert.equal(Object.hasOwn(ASSISTANT_GRANT_LABELS, 'console'), false)
    for (const role of Object.values(ROLES)) {
      assert.equal(allowRoute({ role, permission_grants: { console: true } }, 'console'), false)
    }
  })

  it('removes the Console page and redirects the legacy dashboard to Floor', () => {
    const app = read('src/App.jsx')
    assert.doesNotMatch(app, /AdminConsolePage/)
    assert.doesNotMatch(app, /path="console"/)
    assert.match(app, /path="\/admin\/dashboard"[^\n]+to="\/operations\/dashboard"/)
    assert.doesNotMatch(read('src/lib/demoAccounts.js'), /console/i)
  })
})
