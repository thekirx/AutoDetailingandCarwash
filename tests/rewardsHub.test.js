import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  ROLES,
  allowRoute,
  canAccessRewardsHub,
  getOperationsNav,
  groupOperationsNav,
} from '../src/auth/permissions.js'
import { buildSmartSearchDestinations } from '../src/lib/smartSearchCatalog.js'

const root = join(import.meta.dirname, '..')

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Unified Rewards hub consolidation', () => {
  it('routes Super Admin, Assistant Super Admin, and Investor through Rewards hub and keeps non-reward roles out', () => {
    assert.equal(canAccessRewardsHub({ role: ROLES.SUPER_ADMIN }), true)
    assert.equal(canAccessRewardsHub({ role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: {} }), true)
    assert.equal(canAccessRewardsHub({ role: ROLES.INVESTOR }), true)
    assert.equal(canAccessRewardsHub({ role: ROLES.ADMIN, branch_slug: 'bacoor' }), false)
    assert.equal(canAccessRewardsHub({ role: ROLES.TEAM_LEAD, branch_slug: 'bacoor' }), false)
    assert.equal(canAccessRewardsHub({ role: ROLES.STAFF, branch_slug: 'bacoor' }), false)
    assert.equal(allowRoute({ role: ROLES.SUPER_ADMIN }, 'rewards'), true)
    assert.equal(allowRoute({ role: ROLES.INVESTOR }, 'rewards'), true)
    assert.equal(allowRoute({ role: ROLES.ADMIN, branch_slug: 'bacoor' }, 'rewards'), false)
  })

  it('keeps sidebar clean under Customers group (Customers + Rewards only, no redundant standalone Vouchers/Memberships/Merch links)', () => {
    const saNav = getOperationsNav({ role: ROLES.SUPER_ADMIN })
    const saGroups = groupOperationsNav(saNav)
    const custGroup = saGroups.find((g) => g.id === 'customers')
    assert.deepEqual(
      custGroup.items.map((i) => ({ label: i.label, to: i.to })),
      [
        { label: 'Customers', to: '/operations/crm' },
        { label: 'Rewards', to: '/operations/rewards' },
      ],
    )
    assert.equal(saNav.some((i) => i.to === '/operations/vouchers'), false)
    assert.equal(saNav.some((i) => i.to === '/operations/memberships'), false)
    assert.equal(saNav.some((i) => i.to === '/operations/merch-shop'), false)

    const invNav = getOperationsNav({ role: ROLES.INVESTOR })
    assert.equal(invNav.some((i) => i.to === '/operations/rewards?tab=vouchers' && i.label === 'Rewards'), true)
    assert.equal(invNav.some((i) => i.to === '/operations/vouchers'), false)
  })

  it('separates CrmPage cleanly from RewardsPage and preserves all four Rewards tabs + legacy redirects', () => {
    const rewardsPage = read('src/pages/RewardsPage.jsx')
    for (const id of ['memberships', 'vouchers', 'points-shop', 'referrals']) {
      assert.match(rewardsPage, new RegExp(`id: '${id}'`))
    }
    assert.match(rewardsPage, /ReferralProgramCard/)
    assert.match(rewardsPage, /ReferralSettingsCard/)
    assert.match(rewardsPage, /<MembershipsPage embedded \/>/)
    assert.match(rewardsPage, /<VouchersPage embedded \/>/)
    assert.match(rewardsPage, /<MerchShopPage embedded \/>/)

    const crmPage = read('src/pages/CrmPage.jsx')
    assert.doesNotMatch(crmPage, /id: 'memberships'/)
    assert.doesNotMatch(crmPage, /id: 'merch'/)
    assert.match(crmPage, /id: 'directory'/)
    assert.match(crmPage, /id: 'transfer'/)

    const app = read('src/App.jsx')
    assert.match(app, /path="rewards"/)
    assert.match(app, /path="vouchers"[\s\S]*RewardsHubRedirect tab="vouchers"/)
    assert.match(app, /path="memberships"[\s\S]*RewardsHubRedirect tab="memberships"/)
    assert.match(app, /path="merch-shop"[\s\S]*RewardsHubRedirect tab="points-shop"/)
  })

  it('points Smart Search sub-destinations directly to /operations/rewards tabs', () => {
    const saDest = buildSmartSearchDestinations({ role: ROLES.SUPER_ADMIN }).map((d) => d.to)
    assert.ok(saDest.includes('/operations/rewards?tab=memberships'))
    assert.ok(saDest.includes('/operations/rewards?tab=vouchers'))
    assert.ok(saDest.includes('/operations/rewards?tab=points-shop'))
    assert.ok(saDest.includes('/operations/rewards?tab=referrals'))

    const invDest = buildSmartSearchDestinations({ role: ROLES.INVESTOR }).map((d) => d.to)
    assert.ok(invDest.includes('/operations/rewards?tab=vouchers'))
    assert.equal(invDest.includes('/operations/rewards?tab=memberships'), false)
    assert.equal(invDest.includes('/operations/rewards?tab=points-shop'), false)
    assert.equal(invDest.includes('/operations/rewards?tab=referrals'), false)
  })
})
