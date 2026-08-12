import assert from 'node:assert/strict'
import {
  ROLES,
  canAccessCrm,
  canAccessPos,
  canAccessBookingBoard,
  canAccessReports,
  getOperationsNav,
  redirectForRole,
} from '../src/auth/permissions.js'

const marketing = { role: ROLES.MARKETING, branch_slug: 'bacoor' }
const admin = { role: ROLES.ADMIN, branch_slug: 'bacoor' }
const assistant = { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: {} }

assert.equal(canAccessCrm(marketing), true)
assert.equal(canAccessPos(marketing), false)
assert.equal(canAccessBookingBoard(marketing), true)
assert.equal(canAccessPos(admin), true)
assert.equal(canAccessReports(admin), false)
assert.equal(canAccessReports(assistant), true)

const mNav = getOperationsNav(marketing)
assert.deepEqual(
  mNav.map((i) => i.to),
  [
    '/operations/crm',
    '/operations/bookings',
    '/operations/planning',
    '/operations/notifications',
    '/operations/history',
  ],
)

assert.equal(redirectForRole(ROLES.MARKETING), '/operations/crm')
assert.equal(redirectForRole(ROLES.SALES), '/operations/bookings')
assert.equal(redirectForRole(ROLES.ASSISTANT_SUPER_ADMIN), '/operations/console')

console.log('permissions.marketingSalesNav: ok')
