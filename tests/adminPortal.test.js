import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { nearestBranchSlug, haversineKm } from '../src/lib/branchGeo.js'
import { creatableRolesFor } from '../server/provisionStaff.mjs'
import { canCreateAdminAccounts, canManagePeople, redirectForRole } from '../src/auth/permissions.js'

describe('nearest branch', () => {
  it('picks Bacoor when near Cavite', () => {
    const nearest = nearestBranchSlug(
      { lat: 14.45, lng: 120.94 },
      [{ slug: 'bacoor', name: 'Bacoor' }, { slug: 'batangas', name: 'Batangas' }],
    )
    assert.equal(nearest.slug, 'bacoor')
    assert.ok(nearest.distanceKm < 20)
  })

  it('haversine is symmetric-ish', () => {
    const a = { lat: 14.45, lng: 120.94 }
    const b = { lat: 13.75, lng: 121.05 }
    assert.ok(Math.abs(haversineKm(a, b) - haversineKm(b, a)) < 0.001)
  })
})

describe('staff provision RBAC', () => {
  it('BossMich can create admin; admin cannot', () => {
    assert.ok(creatableRolesFor('BossMich').includes('admin'))
    assert.ok(!creatableRolesFor('admin').includes('admin'))
    assert.ok(creatableRolesFor('admin').includes('team_lead'))
  })

  it('permission helpers align', () => {
    assert.equal(canCreateAdminAccounts({ role: 'BossMich' }), true)
    assert.equal(canCreateAdminAccounts({ role: 'admin' }), false)
    assert.equal(canManagePeople({ role: 'admin' }), true)
    assert.equal(redirectForRole('BossMich'), '/operations/console')
    assert.equal(redirectForRole('staff'), '/operations/my-tasks')
    assert.equal(redirectForRole('team_lead'), '/operations/dashboard')
  })
})
