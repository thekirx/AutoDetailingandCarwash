import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  ASSISTANT_GRANT_GROUPS,
  ASSISTANT_GRANT_KEYS,
  DEFAULT_ASSISTANT_GRANTS,
  ROLES,
  allowRoute,
  canEditAssistantGrants,
  canEditFinanceBooks,
  canEditPlanning,
  canWritePosSettings,
  countEnabledAssistantGrants,
  normalizeAssistantGrants,
  setAssistantGrantsPreset,
} from '../src/auth/permissions.js'

const ROUTE_KEYS = [
  'planning', 'people', 'branches', 'cars', 'audit', 'data-center', 'inquiries', 'dashboard',
  'queue', 'queue-new', 'attendance', 'kpi', 'my-tasks', 'pos', 'inventory', 'finance', 'crm',
  'bookings', 'reviews', 'reports', 'memberships', 'settings', 'content', 'notifications', 'history',
]
const OWNER_ONLY_ROUTES = ['cars', 'data-center']

describe('ASA grant editor helpers', () => {
  it('groups cover every grant key exactly once', () => {
    const grouped = ASSISTANT_GRANT_GROUPS.flatMap((g) => g.keys)
    assert.deepEqual([...grouped].sort(), [...ASSISTANT_GRANT_KEYS].sort())
    assert.equal(new Set(grouped).size, grouped.length)
  })

  it('normalize drops unknown keys and coerces booleans', () => {
    const next = normalizeAssistantGrants({ pos: 1, finance_write: 'yes', hacker: true })
    assert.equal(next.pos, true)
    assert.equal(next.finance_write, true)
    assert.equal(Object.prototype.hasOwnProperty.call(next, 'hacker'), false)
    assert.equal(next.rbac_edit, DEFAULT_ASSISTANT_GRANTS.rbac_edit)
  })

  it('presets: defaults, safe, all', () => {
    assert.deepEqual(setAssistantGrantsPreset('defaults'), DEFAULT_ASSISTANT_GRANTS)
    const safe = setAssistantGrantsPreset('safe')
    assert.equal(safe.finance_write, false)
    assert.equal(safe.planning_edit, false)
    assert.equal(safe.rbac_edit, false)
    assert.equal(safe.pos, true)
    const all = setAssistantGrantsPreset('all')
    assert.equal(countEnabledAssistantGrants(all), ASSISTANT_GRANT_KEYS.length)
  })
})

describe('ASA with every grant (Luci)', () => {
  const sa = { role: ROLES.SUPER_ADMIN }
  const luci = { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: setAssistantGrantsPreset('all') }
  const defaults = { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: {} }

  it('opens every Super Admin page except the owner-only ones', () => {
    for (const key of ROUTE_KEYS) {
      const expected = OWNER_ONLY_ROUTES.includes(key) ? false : allowRoute(sa, key)
      assert.equal(allowRoute(luci, key), expected, key)
    }
  })

  it('gets the money and admin writes that defaults keep off', () => {
    for (const can of [canEditFinanceBooks, canWritePosSettings, canEditPlanning, canEditAssistantGrants]) {
      assert.equal(can(luci), true, can.name)
      assert.equal(can(defaults), false, can.name)
    }
  })

  it('seed creates Luci with every grant on', () => {
    const seed = readFileSync(new URL('../scripts/seed-floor-accounts.mjs', import.meta.url), 'utf8')
    const block = seed.slice(seed.indexOf("email: 'assistant@hakumautocare.com'"), seed.indexOf('const opsLead'))
    assert.match(block, /full_name: 'Luci'/)
    assert.match(block, /permission_grants: setAssistantGrantsPreset\('all'\)/)
  })
})
