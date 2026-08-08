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

  it('Admin keeps planning capability but nav is POS/Queue View/Queue only', () => {
    const p = { role: ROLES.ADMIN, branch_slug: 'bacoor', branch_slugs: ['bacoor', 'imus'] }
    assert.equal(canViewPlanning(p), true)
    assert.equal(canEditPlanning(p), false)
    assert.equal(canAccessReports(p), false)
    assert.equal(canAccessPos(p), true)
    assert.deepEqual(getBranchScopeList(p), ['bacoor', 'imus'])
    assert.deepEqual(
      getOperationsNav(p).map((i) => i.to),
      ['/operations/pos', '/operations/dashboard', '/operations/queue'],
    )
    assert.ok(!getOperationsNav(p).some((i) => i.to === '/operations/reports'))
  })

  it('marketing CRM only', () => {
    const p = { role: ROLES.MARKETING }
    assert.equal(canAccessCrm(p), true)
    assert.equal(canAccessFinance(p), false)
    assert.equal(canAccessPos(p), false)
    assert.deepEqual(
      getOperationsNav(p).map((i) => i.to),
      ['/operations/crm'],
    )
  })

  it('homes and deprecated sales redirect', () => {
    assert.equal(redirectForRole(ROLES.ASSISTANT_SUPER_ADMIN), '/operations/console')
    assert.equal(redirectForRole(ROLES.MARKETING), '/operations/crm')
    assert.equal(redirectForRole(ROLES.STAFF), '/operations/my-tasks')
    assert.equal(redirectForRole('sales'), '/operations/pos')
  })

  it('Team Lead dock is derived from the same allowRoute matrix', () => {
    const dock = getTeamLeadDock({ role: ROLES.TEAM_LEAD, branch_slug: 'bacoor' })
    assert.ok(dock.some((i) => i.to === '/operations/queue'))
    assert.ok(dock.some((i) => i.to === '/operations/queue/new'))
    assert.ok(dock.some((i) => i.to === '/operations/bookings'))
    assert.equal(getTeamLeadDock({ role: ROLES.STAFF }).length, 0)
  })
})
