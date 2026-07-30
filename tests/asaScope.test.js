import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ROLES,
  getBranchScopeList,
  hasGrant,
  canEditAssistantGrants,
  canManagePeople,
  allowRoute,
} from '../src/auth/permissions.js'
import {
  NO_BRANCH_SCOPE,
  resolveBranchFilter,
  getBranchScope,
} from '../src/queue/queueLogic.js'
import { applyBranchScope } from '../src/lib/crmInsights.js'

describe('ASA fail-closed branch scope', () => {
  it('branches_all false with no assignments yields empty list (not all-branches)', () => {
    const p = {
      role: ROLES.ASSISTANT_SUPER_ADMIN,
      permission_grants: { branches_all: false },
      branch_slug: null,
      branch_slugs: [],
    }
    assert.deepEqual(getBranchScopeList(p), [])
    assert.equal(resolveBranchFilter(p, 'all'), NO_BRANCH_SCOPE)
    assert.equal(getBranchScope(p), NO_BRANCH_SCOPE)
  })

  it('branches_all false with assignments scopes to those branches', () => {
    const p = {
      role: ROLES.ASSISTANT_SUPER_ADMIN,
      permission_grants: { branches_all: false },
      branch_slugs: ['bacoor'],
    }
    assert.deepEqual(getBranchScopeList(p), ['bacoor'])
    assert.equal(resolveBranchFilter(p, 'all'), 'bacoor')
  })

  it('applyBranchScope treats empty list as no rows', () => {
    const calls = []
    const q = {
      eq(col, val) {
        calls.push(['eq', col, val])
        return this
      },
      in() {
        return this
      },
    }
    applyBranchScope(q, [])
    assert.deepEqual(calls[0], ['eq', 'branch', '__none__'])
  })
})

describe('ASA grant seams', () => {
  it('Cars always denied; rbac_edit default off', () => {
    const p = { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: {} }
    assert.equal(allowRoute(p, 'cars'), false)
    assert.equal(canEditAssistantGrants(p), false)
    assert.equal(canManagePeople(p), true)
    assert.equal(hasGrant(p, 'queue_all'), true)
    assert.equal(hasGrant({ ...p, permission_grants: { queue_all: false } }, 'queue_all'), false)
  })
})
