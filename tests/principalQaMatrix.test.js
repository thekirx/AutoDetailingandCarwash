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
  it('P0-1 detailer may open detailing queue home', () => {
    const p = profile(ROLES.DETAILER)
    assert.equal(redirectForRole(ROLES.DETAILER), '/operations/queue?family=detailing')
    assert.equal(allowRoute(p, 'queue'), true)
    assert.equal(allowRoute(p, 'attendance'), true)
    assert.equal(allowRoute(p, 'finance'), false)
    assert.equal(allowRoute(p, 'pos'), false)
    assert.ok(getDetailerDock(p).some((i) => i.to.includes('family=detailing')))
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
    [ROLES.DETAILER, '/operations/queue?family=detailing', 'floor'],
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

  it('investor finance+reports only', () => {
    const p = profile(ROLES.INVESTOR)
    assert.deepEqual(allowedKeys(p).sort(), ['finance', 'reports'].sort())
    assert.deepEqual(
      getOperationsNav(p).map((i) => i.to),
      ['/operations/finance', '/operations/reports'],
    )
  })

  it('team_lead queue ok, pos denied by default', () => {
    const p = profile(ROLES.TEAM_LEAD)
    assert.equal(allowRoute(p, 'queue'), true)
    assert.equal(allowRoute(p, 'dashboard'), true)
    assert.equal(allowRoute(p, 'attendance'), true)
    assert.equal(allowRoute(p, 'pos'), false)
    assert.equal(allowRoute(p, 'finance'), false)
  })

  it('ASA without grants denied queue_all surfaces when gated', () => {
    const bare = profile(ROLES.ASSISTANT_SUPER_ADMIN, { permission_grants: {} })
    assert.equal(allowRoute(bare, 'console'), true)
    // queue view still via ASA console tier in QUEUE_VIEWER
    assert.equal(allowRoute(bare, 'queue'), true)
  })
})
