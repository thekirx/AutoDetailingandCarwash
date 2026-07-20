import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canAccessCrm,
  canAccessFinance,
  canAccessPos,
  canEditQueueOperations,
  canManageCrew,
  canManageServices,
  redirectForRole,
  ROLES,
} from '../src/auth/permissions.js'

describe('permissions matrix', () => {
  it('maps BossMich as super admin across modules', () => {
    const p = { role: ROLES.SUPER_ADMIN }
    assert.equal(canAccessPos(p), true)
    assert.equal(canAccessFinance(p), true)
    assert.equal(canManageServices(p), true)
    assert.equal(canManageCrew(p), true)
    assert.equal(canEditQueueOperations(p), true)
  })

  it('blocks marketing from finance and POS', () => {
    const p = { role: ROLES.MARKETING }
    assert.equal(canAccessFinance(p), false)
    assert.equal(canAccessPos(p), false)
    assert.equal(canAccessCrm(p), true)
  })

  it('allows sales POS and CRM but not finance', () => {
    const p = { role: ROLES.SALES }
    assert.equal(canAccessPos(p), true)
    assert.equal(canAccessCrm(p), true)
    assert.equal(canAccessFinance(p), false)
  })

  it('redirects roles to sensible homes', () => {
    assert.equal(redirectForRole(ROLES.STAFF), '/operations/my-tasks')
    assert.equal(redirectForRole(ROLES.SALES), '/operations/pos')
    assert.equal(redirectForRole(ROLES.MARKETING), '/operations/bookings')
  })
})
