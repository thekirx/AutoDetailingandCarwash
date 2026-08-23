import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ROLES,
  allowRoute,
  canAccessCrm,
  canAccessFinance,
  canAccessPos,
  canAccessReports,
  canEditAssistantGrants,
  canEditPlanning,
  canEditQueueOperations,
  canManageServices,
  canViewPlanning,
  getBranchScopeList,
  getOperationsNav,
  getTeamLeadDock,
  hasGrant,
  redirectForRole,
} from '../src/auth/permissions.js'

describe('RBAC Part 1 matrix', () => {
  it('BossMich has full access', () => {
    const p = { role: ROLES.SUPER_ADMIN }
    assert.equal(canAccessPos(p), true)
    assert.equal(canAccessFinance(p), true)
    assert.equal(canAccessReports(p), true)
    assert.equal(canEditPlanning(p), true)
    assert.equal(canEditQueueOperations(p), true)
    assert.equal(canManageServices(p), true)
    assert.equal(getBranchScopeList(p), null)
    assert.ok(getOperationsNav(p).some((i) => i.to === '/operations/reports'))
    assert.ok(!getOperationsNav(p).some((i) => i.to === '/operations/services'))
    assert.ok(!getOperationsNav(p).some((i) => i.to === '/operations/sms'))
  })

  it('Assistant Super Admin uses grants (defaults)', () => {
    const p = { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: {} }
    assert.equal(hasGrant(p, 'pos'), true)
    assert.equal(hasGrant(p, 'reports'), true)
    assert.equal(hasGrant(p, 'planning_edit'), false)
    assert.equal(hasGrant(p, 'branches_all'), true)
    assert.equal(canAccessPos(p), true)
    assert.equal(canAccessReports(p), true)
    assert.equal(canEditPlanning(p), false)
    assert.equal(canViewPlanning(p), true)
    assert.equal(allowRoute(p, 'reports'), true)
    assert.equal(allowRoute(p, 'planning'), true)
    assert.equal(getBranchScopeList(p), null)
  })

  it('Assistant Super Admin respects denied grant', () => {
    const p = { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: { reports: false, pos: false } }
    assert.equal(canAccessReports(p), false)
    assert.equal(canAccessPos(p), false)
    assert.equal(allowRoute(p, 'pos'), false)
  })

  it('branches_all controls ASA data scope independently of queue_all', () => {
    const scoped = {
      role: ROLES.ASSISTANT_SUPER_ADMIN,
      permission_grants: { branches_all: false, queue_all: true, kpi_all: true },
      branch_slugs: ['bacoor', 'imus'],
    }
    assert.deepEqual(getBranchScopeList(scoped), ['bacoor', 'imus'])
    assert.equal(canEditQueueOperations(scoped), true)

    const all = {
      role: ROLES.ASSISTANT_SUPER_ADMIN,
      permission_grants: { branches_all: true, queue_all: false },
      branch_slugs: ['bacoor'],
    }
    assert.equal(getBranchScopeList(all), null)
    assert.equal(canEditQueueOperations(all), false)
  })

  it('rbac_edit lets ASA edit grants; Super Admin always can', () => {
    assert.equal(canEditAssistantGrants({ role: ROLES.SUPER_ADMIN }), true)
    assert.equal(canEditAssistantGrants({ role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: {} }), false)
    assert.equal(
      canEditAssistantGrants({ role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: { rbac_edit: true } }),
      true,
    )
  })

  it('Admin keeps planning capability; Command nav includes Floor + queues + POS + ops tools', () => {
    const p = { role: ROLES.ADMIN, branch_slug: 'bacoor', branch_slugs: ['bacoor', 'imus'] }
    assert.equal(canViewPlanning(p), true)
    assert.equal(canEditPlanning(p), true)
    assert.equal(canAccessReports(p), false)
    assert.equal(canAccessPos(p), true)
    assert.deepEqual(getBranchScopeList(p), ['bacoor', 'imus'])
    assert.deepEqual(
      getOperationsNav(p).map((i) => i.to),
      [
        '/operations/dashboard',
        '/operations/queue',
        '/operations/attendance',
        '/operations/pos',
        '/operations/reviews',
        '/operations/planning',
        '/operations/roadmap',
        '/operations/history',
        '/operations/my-pay',
        '/operations/audit',
      ],
    )
    assert.ok(!getOperationsNav(p).some((i) => i.to === '/operations/reports'))
  })

  it('Planner nav: Branch Admin, staff Tasks, video editor calendar only', () => {
    const ba = { role: ROLES.ADMIN, branch_slug: 'bacoor', branch_slugs: ['bacoor'] }
    assert.ok(getOperationsNav(ba).some((i) => i.to === '/operations/planning' && i.label === 'Planner'))
    const staff = { role: ROLES.STAFF, branch_slug: 'bacoor' }
    assert.ok(getOperationsNav(staff).some((i) => i.to === '/operations/planning'))
    assert.ok(!getOperationsNav(staff).some((i) => String(i.to).includes('tab=forms')))
    assert.deepEqual(
      getOperationsNav({ role: ROLES.VIDEO_EDITOR }).map((i) => i.to),
      ['/operations/planning?tab=calendar', '/operations/my-tasks', '/operations/my-pay'],
    )
  })

  it('marketing CRM + bookings + planner + notifications + history', () => {
    const p = { role: ROLES.MARKETING }
    assert.equal(canAccessCrm(p), true)
    assert.equal(canAccessFinance(p), false)
    assert.equal(canAccessPos(p), false)
    assert.deepEqual(
      getOperationsNav(p).map((i) => i.to),
      [
        '/operations/crm',
        '/operations/bookings',
        '/operations/planning',
        '/operations/notifications',
        '/operations/history',
        '/operations/my-pay',
      ],
    )
  })

  it('homes and sales redirect to bookings', () => {
    assert.equal(redirectForRole(ROLES.ASSISTANT_SUPER_ADMIN), '/operations/console')
    assert.equal(redirectForRole(ROLES.MARKETING), '/operations/crm')
    assert.equal(redirectForRole(ROLES.STAFF), '/operations/attendance')
    assert.equal(redirectForRole(ROLES.SALES), '/operations/bookings')
    assert.equal(redirectForRole('cashier'), '/operations/pos')
  })

  it('Team Lead dock is derived from the same allowRoute matrix', () => {
    const dock = getTeamLeadDock({ role: ROLES.TEAM_LEAD, branch_slug: 'bacoor' })
    assert.ok(dock.some((i) => i.to === '/operations/queue'))
    assert.ok(dock.some((i) => i.to === '/operations/queue/new'))
    assert.ok(dock.some((i) => i.to === '/operations/attendance'))
    assert.equal(dock.some((i) => i.to === '/operations/bookings'), false)
    assert.equal(getTeamLeadDock({ role: ROLES.STAFF }).length, 0)
  })

  it('Command nav never links a page the role cannot open', () => {
    const routeKey = (to) => {
      const rest = String(to).split('?')[0].replace(/^\/operations\//, '')
      if (rest === 'queue/new') return 'queue-new'
      return rest.split('/')[0]
    }
    const samples = [
      { role: ROLES.SUPER_ADMIN },
      { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: {} },
      { role: ROLES.ADMIN, branch_slug: 'bacoor', branch_slugs: ['bacoor'] },
      { role: ROLES.OPERATIONS_LEAD },
      { role: ROLES.TEAM_LEAD, branch_slug: 'bacoor' },
      { role: ROLES.STAFF, branch_slug: 'bacoor' },
      { role: ROLES.SALES, branch_slug: 'bacoor' },
      { role: ROLES.MARKETING, branch_slug: 'bacoor' },
      { role: ROLES.DETAILER, branch_slug: 'bacoor' },
      { role: ROLES.VIDEO_EDITOR, branch_slug: 'bacoor' },
      { role: ROLES.INVESTOR },
    ]
    for (const p of samples) {
      for (const item of getOperationsNav(p)) {
        const key = routeKey(item.to)
        assert.equal(allowRoute(p, key), true, `${p.role} ${item.to} -> ${key}`)
      }
    }
  })
})
