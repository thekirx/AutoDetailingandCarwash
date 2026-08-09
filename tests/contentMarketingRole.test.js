import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  OPS_LOGIN_ROLES,
  ROLES,
  allowRoute,
  canAccessContent,
  canManageEvents,
  canManagePosts,
  getOperationsNav,
  redirectForRole,
} from '../src/auth/permissions.js'

const contentProfile = { role: 'content_marketing' }

describe('Marketing Content role', () => {
  it('is an operations login role that lands on Content', () => {
    assert.equal(ROLES.CONTENT_MARKETING, 'content_marketing')
    assert.equal(OPS_LOGIN_ROLES.includes('content_marketing'), true)
    assert.equal(redirectForRole('content_marketing'), '/operations/content')
  })

  it('can manage Posts and Events through the centralized Content capability', () => {
    assert.equal(canAccessContent(contentProfile), true)
    assert.equal(canManagePosts(contentProfile), true)
    assert.equal(canManageEvents(contentProfile), true)
    assert.equal(allowRoute(contentProfile, 'content'), true)
  })

  it('is denied every unrelated operations route', () => {
    const restrictedRoutes = [
      'console', 'planning', 'people', 'branches', 'cars', 'audit', 'data-center',
      'dashboard', 'queue', 'queue-new', 'crew', 'kpi', 'my-tasks', 'pos',
      'finance', 'crm', 'bookings', 'reports', 'memberships',
    ]

    for (const route of restrictedRoutes) {
      assert.equal(allowRoute(contentProfile, route), false, `${route} must be denied`)
    }
  })

  it('sees only the Content navigation item', () => {
    assert.deepEqual(getOperationsNav(contentProfile), [
      { label: 'Content', to: '/operations/content', icon: 'Newspaper' },
    ])
  })

  it('does not change the existing Marketing CRM destination', () => {
    const marketing = { role: 'marketing' }
    assert.equal(redirectForRole(marketing.role), '/operations/crm')
    assert.equal(allowRoute(marketing, 'crm'), true)
    assert.equal(allowRoute(marketing, 'content'), false)
  })
})
