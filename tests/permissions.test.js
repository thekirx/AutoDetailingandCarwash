import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ROLES,
  allowRoute,
  canAccessCrm,
  canAccessFinance,
  canAccessPos,
  canAccessReports,
  canEditPlanning,
  canEditQueueOperations,
  canManageServices,
  canViewPlanning,
  getBranchScopeList,
  getOperationsNav,
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
    assert.equal(canAccessPos(p), true)
    assert.equal(canAccessReports(p), true)
    assert.equal(canEditPlanning(p), false)
    assert.equal(canViewPlanning(p), true)
    assert.equal(allowRoute(p, 'reports'), true)
    assert.equal(allowRoute(p, 'planning'), true)
  })

  it('Assistant Super Admin respects denied grant', () => {
    const p = { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: { reports: false, pos: false } }
    assert.equal(canAccessReports(p), false)
    assert.equal(canAccessPos(p), false)
    assert.equal(allowRoute(p, 'pos'), false)
  })

  it('Admin views planning, no reports; POS yes', () => {
    const p = { role: ROLES.ADMIN, branch_slug: 'bacoor', branch_slugs: ['bacoor', 'imus'] }
    assert.equal(canViewPlanning(p), true)
    assert.equal(canEditPlanning(p), false)
    assert.equal(canAccessReports(p), false)
    assert.equal(canAccessPos(p), true)
    assert.deepEqual(getBranchScopeList(p), ['bacoor', 'imus'])
    assert.ok(getOperationsNav(p).some((i) => i.to === '/operations/planning'))
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
})
