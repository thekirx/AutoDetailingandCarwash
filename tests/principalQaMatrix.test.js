/**
 * Principal QA Phase B — role × home × shell × allowRoute matrix.
 * Also locks P0-1 (detailer queue) and P0-2 (video_editor my-tasks).
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ROLES,
  allowRoute,
  redirectForRole,
  usesCommandShell,
  usesFloorAppShell,
  getOperationsNav,
  getDetailerDock,
  getVideoEditorDock,
} from '../src/auth/permissions.js'

const OPS_KEYS = [
  'console',
  'people',
  'branches',
  'cars',
  'audit',
  'data-center',
  'inquiries',
  'dashboard',
  'queue',
  'queue-new',
  'crew',
  'attendance',
  'kpi',
  'my-tasks',
  'pos',
  'inventory',
  'finance',
  'payroll',
  'my-pay',
  'crm',
  'bookings',
  'planning',
  'settings',
  'content',
  'notifications',
  'history',
  'reports',
  'memberships',
  'reviews',
]

function profile(role, extra = {}) {
  return { role, branch_slug: 'bacoor', branch_slugs: ['bacoor'], ...extra }
}

function allowedKeys(p) {
  return OPS_KEYS.filter((k) => allowRoute(p, k))
}

describe('P0 access gates', () => {
  it('P0-1 detailer may open bookings for detailing work', () => {
    const p = profile(ROLES.DETAILER)
    assert.equal(redirectForRole(ROLES.DETAILER), '/operations/bookings')
    assert.equal(allowRoute(p, 'bookings'), true)
    assert.equal(allowRoute(p, 'attendance'), true)
    assert.equal(allowRoute(p, 'finance'), false)
    assert.equal(allowRoute(p, 'pos'), false)
    assert.ok(getDetailerDock(p).some((i) => i.to === '/operations/bookings'))
  })

  it('P0-2 video_editor may open my-tasks + planning calendar', () => {
    const p = profile(ROLES.VIDEO_EDITOR)
    assert.equal(redirectForRole(ROLES.VIDEO_EDITOR), '/operations/planning?tab=calendar')
    assert.equal(allowRoute(p, 'planning'), true)
    assert.equal(allowRoute(p, 'my-tasks'), true)
    assert.equal(allowRoute(p, 'queue'), false)
    assert.equal(allowRoute(p, 'finance'), false)
    assert.ok(getVideoEditorDock(p).some((i) => i.to === '/operations/my-tasks'))
  })
})

describe('Landing + shell matrix', () => {
  const cases = [
    [ROLES.SUPER_ADMIN, '/operations/console', 'command'],
    [ROLES.ASSISTANT_SUPER_ADMIN, '/operations/console', 'command'],
    [ROLES.ADMIN, '/operations/pos', 'command'],
    [ROLES.INVESTOR, '/operations/finance', 'command'],
    [ROLES.TEAM_LEAD, '/operations/queue', 'floor'],
    [ROLES.STAFF, '/operations/attendance', 'floor'],
    [ROLES.SALES, '/operations/bookings', 'floor'],
    [ROLES.MARKETING, '/operations/crm', 'floor'],
    [ROLES.VIDEO_EDITOR, '/operations/planning?tab=calendar', 'floor'],
    [ROLES.DETAILER, '/operations/bookings', 'floor'],
  ]

  for (const [role, home, shell] of cases) {
    it(`${role} → ${home} (${shell})`, () => {
      const p = profile(role)
      assert.equal(redirectForRole(role), home)
      if (shell === 'command') {
        assert.equal(usesCommandShell(p), true)
        assert.equal(usesFloorAppShell(p), false)
      } else {
        assert.equal(usesFloorAppShell(p), true)
        assert.equal(usesCommandShell(p), false)
      }
    })
  }
})

describe('Negative allowRoute denials', () => {
  it('staff denied finance/pos/people', () => {
    const p = profile(ROLES.STAFF)
    assert.equal(allowRoute(p, 'finance'), false)
    assert.equal(allowRoute(p, 'pos'), false)
    assert.equal(allowRoute(p, 'people'), false)
    assert.equal(allowRoute(p, 'attendance'), true)
    assert.equal(allowRoute(p, 'my-tasks'), true)
  })

  it('sales denied pos/finance/queue', () => {
    const p = profile(ROLES.SALES)
    assert.equal(allowRoute(p, 'bookings'), true)
    assert.equal(allowRoute(p, 'history'), true)
    assert.equal(allowRoute(p, 'pos'), false)
    assert.equal(allowRoute(p, 'finance'), false)
    assert.equal(allowRoute(p, 'queue'), false)
  })

  it('investor finance hub only (reports live under Finance tab)', () => {
    const p = profile(ROLES.INVESTOR)
    assert.deepEqual(allowedKeys(p).sort(), ['finance', 'reports'].sort())
    assert.deepEqual(
      getOperationsNav(p).map((i) => i.to),
      ['/operations/finance'],
    )
    assert.equal(allowRoute(p, 'reports'), true)
  })

  it('every ROLES value has home, nav, and home route allowed', () => {
    for (const role of Object.values(ROLES)) {
      const p = profile(role)
      const home = redirectForRole(role)
      assert.ok(home.startsWith('/operations'), `${role} home`)
      const nav = getOperationsNav(p)
      assert.ok(nav.length > 0, `${role} nav empty`)
      const routeKey = home.split('?')[0].replace('/operations/', '').split('/')[0]
      assert.equal(allowRoute(p, routeKey), true, `${role} denied home ${routeKey}`)
    }
  })

  it('team_lead queue ok, pos denied by default', () => {
    const p = profile(ROLES.TEAM_LEAD)
    assert.equal(allowRoute(p, 'queue'), true)
    assert.equal(allowRoute(p, 'dashboard'), true)
    assert.equal(allowRoute(p, 'attendance'), true)
    assert.equal(allowRoute(p, 'pos'), false)
    assert.equal(allowRoute(p, 'finance'), false)
  })

  it('ASA empty grants keep console and queue; explicit false denies both', () => {
    const bare = profile(ROLES.ASSISTANT_SUPER_ADMIN, { permission_grants: {} })
    assert.equal(allowRoute(bare, 'console'), true)
    assert.equal(allowRoute(bare, 'queue'), true)
    const denied = profile(ROLES.ASSISTANT_SUPER_ADMIN, {
      permission_grants: { console: false, queue_all: false },
    })
    assert.equal(allowRoute(denied, 'console'), false)
    assert.equal(allowRoute(denied, 'queue'), false)
  })
})
