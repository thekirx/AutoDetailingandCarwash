import assert from 'node:assert/strict'
import {
  ROLES,
  canAccessCrm,
  canAccessPos,
  canAccessBookingBoard,
  canAccessMarketing,
  getOperationsNav,
  redirectForRole,
} from '../src/auth/permissions.js'

const marketing = { role: ROLES.MARKETING, branch_slug: 'bacoor' }
const sales = { role: ROLES.SALES, branch_slug: 'bacoor' }
const admin = { role: ROLES.ADMIN, branch_slug: 'bacoor' }

assert.equal(canAccessCrm(marketing), true)
assert.equal(canAccessCrm(sales), false)
assert.equal(canAccessPos(sales), true)
assert.equal(canAccessPos(marketing), false)
assert.equal(canAccessBookingBoard(sales), true)
assert.equal(canAccessBookingBoard(marketing), false)
assert.equal(canAccessMarketing(marketing), false) // SMS is admin-only; marketing is CRM-only
assert.equal(canAccessMarketing(admin), true)

const mNav = getOperationsNav(marketing)
assert.deepEqual(
  mNav.map((i) => i.to),
  ['/operations/crm'],
)

const sNav = getOperationsNav(sales)
assert.deepEqual(
  sNav.map((i) => i.to),
  ['/operations/pos', '/operations/bookings'],
)

assert.equal(redirectForRole(ROLES.MARKETING), '/operations/crm')
assert.equal(redirectForRole(ROLES.SALES), '/operations/pos')

console.log('permissions.marketingSalesNav: ok')
