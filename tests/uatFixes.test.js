import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  canViewQueueBoard,
  getOperationsNav,
  groupOperationsNav,
  ROLES,
} from '../src/auth/permissions.js'

describe('UAT regression fixes: nav grouping & queue board access', () => {
  it('coalesces groupOperationsNav so no role produces duplicate group IDs', () => {
    const rolesToCheck = [
      ROLES.SUPER_ADMIN,
      ROLES.ASSISTANT_SUPER_ADMIN,
      ROLES.ADMIN,
      ROLES.OPERATIONS_LEAD,
      ROLES.TEAM_LEAD,
      ROLES.SALES,
      ROLES.MARKETING,
      ROLES.INVESTOR,
      ROLES.STAFF,
    ]
    for (const role of rolesToCheck) {
      const profile = {
        role,
        branch_slug: 'bacoor',
        branch_slugs: ['bacoor', 'batangas'],
      }
      const nav = getOperationsNav(profile)
      const groups = groupOperationsNav(nav)
      const ids = groups.map((g) => g.id)
      assert.equal(new Set(ids).size, ids.length, `duplicate group id for role=${role}: ${ids.join(', ')}`)
      assert.equal(groups.reduce((n, g) => n + g.items.length, 0), nav.length)
    }
  })

  it('allows Marketing and Investor onto the read-only Queue Board view', () => {
    assert.equal(canViewQueueBoard({ role: ROLES.MARKETING }), true)
    assert.equal(canViewQueueBoard({ role: ROLES.INVESTOR }), true)
  })
})
