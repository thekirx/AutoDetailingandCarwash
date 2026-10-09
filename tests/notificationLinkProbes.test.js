import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePostLoginPath } from '../src/auth/authRedirect.js'
import { allowRoute } from '../src/auth/permissions.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const strip = (f) => {
  const s = readFileSync(join(root, f), 'utf8')
  // Comments are stripped before matching: both probes document the bugs they
  // guard against, and prose about a defect must not satisfy the guard for it.
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}
const links = strip('scripts/probe-notification-links.mjs')
const reach = strip('scripts/probe-notification-reachability.mjs')

describe('notification deep-link probes stay honest', () => {
  it('never fabricates a result object into readOrFail', () => {
    for (const [name, src] of [['links', links], ['reach', reach]]) {
      assert.deepEqual(
        src.match(/readOrFail\([^)]*\{\s*data:\s*null/g) || [],
        [],
        `${name} probe hands readOrFail a fabricated { data: null } — every read would yield null`,
      )
    }
  })

  it('does not treat /operations as a literal "index" route key', () => {
    // This was a real bug: allowRoute(profile, 'index') is false for every role,
    // so the probe reported 11 blocked pairs that did not exist and would have
    // hidden any that did.
    assert.ok(
      /resolvePostLoginPath\(profile,\s*null\)/.test(reach),
      'the reachability probe must follow the /operations index redirect before gating',
    )
    assert.ok(
      !/return\s+m\[1\]\s*\|\|\s*'index'/.test(reach),
      "'index' is not a gated route key; every role would be reported blocked",
    )
  })

  it('confirms /operations really does resolve per role, so the probe is not hiding a real block', () => {
    const expectations = [
      ['admin', 'pos'],
      ['staff', 'attendance'],
      ['team_lead', 'queue'],
      ['investor', 'finance'],
      ['marketing', 'crm'],
    ]
    for (const [role, expected] of expectations) {
      const landing = resolvePostLoginPath({ role, is_active: true }, null)
      assert.match(String(landing), /^\/operations\//, `${role} did not resolve inside /operations`)
      const key = /^\/operations\/([^/?#]+)/.exec(String(landing))[1]
      assert.equal(key, expected, `${role} lands on ${key}, not ${expected}`)
      assert.equal(allowRoute({ role, is_active: true }, key), true, `${role} cannot open ${key}`)
    }
  })
})