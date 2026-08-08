import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ROLES,
  getBranchAdminDock,
  getOperationsNav,
  redirectForRole,
  isBranchAdmin,
} from '../src/auth/permissions.js'

describe('Branch Admin simplified shell', () => {
  const p = { role: ROLES.ADMIN, branch_slug: 'bacoor', branch_slugs: ['bacoor'] }

  it('isBranchAdmin matches role admin only', () => {
    assert.equal(isBranchAdmin(p), true)
    assert.equal(isBranchAdmin({ role: ROLES.SUPER_ADMIN }), false)
    assert.equal(isBranchAdmin({ role: ROLES.TEAM_LEAD }), false)
  })

  it('homes to POS', () => {
    assert.equal(redirectForRole(ROLES.ADMIN), '/operations/pos')
    assert.equal(redirectForRole(ROLES.SUPER_ADMIN), '/operations/console')
  })

  it('nav is POS + Floor + Queue only', () => {
    assert.deepEqual(
      getOperationsNav(p).map((i) => i.to),
      ['/operations/pos', '/operations/dashboard', '/operations/queue'],
    )
  })

  it('dock is Floor, Queue, POS (POS primary)', () => {
    const dock = getBranchAdminDock(p)
    assert.deepEqual(
      dock.map((i) => i.to),
      ['/operations/dashboard', '/operations/queue', '/operations/pos'],
    )
    assert.equal(dock.find((i) => i.to === '/operations/pos')?.primary, true)
    assert.equal(getBranchAdminDock({ role: ROLES.TEAM_LEAD }).length, 0)
  })
})
