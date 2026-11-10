import test from 'node:test'
import assert from 'node:assert/strict'
import { MEMBER_TIERS, memberTier } from '../src/lib/rewardsCatalog.js'
import { validateMembershipTierInput } from '../src/lib/opsValidation.js'
import { MEMBERSHIPS_WORKFLOW_STEPS } from '../src/components/ops/opsGuideCopy.js'
import fs from 'node:fs'
import path from 'node:path'

test('Loyalty Tiers - Standard tiers and thresholds match business rules', () => {
  const platinum = MEMBER_TIERS.find((t) => t.slug === 'platinum')
  const premium = MEMBER_TIERS.find((t) => t.slug === 'premium')
  const deluxe = MEMBER_TIERS.find((t) => t.slug === 'deluxe')
  const basic = MEMBER_TIERS.find((t) => t.slug === 'basic')

  assert.ok(platinum, 'Hakum Platinum Member must exist')
  assert.equal(platinum.name, 'Hakum Platinum Member')
  assert.equal(platinum.min_visits, 100)
  assert.equal(platinum.max_visits, null)
  assert.equal(platinum.discount_percent, 15)
  assert.equal(platinum.loyalty_multiplier, 2.0)

  assert.ok(premium, 'Hakum Premium Member must exist')
  assert.equal(premium.name, 'Hakum Premium Member')
  assert.equal(premium.min_visits, 70)
  assert.equal(premium.max_visits, 99)
  assert.equal(premium.discount_percent, 10)
  assert.equal(premium.loyalty_multiplier, 1.5)

  assert.ok(deluxe, 'Hakum Deluxe Member must exist')
  assert.equal(deluxe.name, 'Hakum Deluxe Member')
  assert.equal(deluxe.min_visits, 30)
  assert.equal(deluxe.max_visits, 69)
  assert.equal(deluxe.discount_percent, 5)
  assert.equal(deluxe.loyalty_multiplier, 1.2)

  assert.ok(basic, 'Hakum Basic Member must exist')
  assert.equal(basic.name, 'Hakum Basic Member')
  assert.equal(basic.min_visits, 1)
  assert.equal(basic.max_visits, 29)
  assert.equal(basic.discount_percent, 0)
  assert.equal(basic.loyalty_multiplier, 1.0)
})

test('Loyalty Tiers - memberTier resolves based on accumulated visit counts', () => {
  assert.equal(memberTier(0).name, 'Hakum Basic Member')
  assert.equal(memberTier(1).name, 'Hakum Basic Member')
  assert.equal(memberTier(15).name, 'Hakum Basic Member')
  assert.equal(memberTier(29).name, 'Hakum Basic Member')

  assert.equal(memberTier(30).name, 'Hakum Deluxe Member')
  assert.equal(memberTier(50).name, 'Hakum Deluxe Member')
  assert.equal(memberTier(69).name, 'Hakum Deluxe Member')

  assert.equal(memberTier(70).name, 'Hakum Premium Member')
  assert.equal(memberTier(85).name, 'Hakum Premium Member')
  assert.equal(memberTier(99).name, 'Hakum Premium Member')

  assert.equal(memberTier(100).name, 'Hakum Platinum Member')
  assert.equal(memberTier(150).name, 'Hakum Platinum Member')
})

test('Loyalty Tiers - memberTier supports modifiable custom tiers from database', () => {
  const customTiers = [
    {
      id: 'tier-1',
      name: 'Custom VIP',
      min_visits: 50,
      max_visits: null,
      discount_percent: 25,
      loyalty_multiplier: 3.0,
      is_active: true,
    },
    {
      id: 'tier-2',
      name: 'Custom Regular',
      min_visits: 1,
      max_visits: 49,
      discount_percent: 5,
      loyalty_multiplier: 1.1,
      is_active: true,
    },
  ]

  const regular = memberTier(10, customTiers)
  assert.equal(regular.name, 'Custom Regular')
  assert.equal(regular.discount_percent, 5)

  const vip = memberTier(75, customTiers)
  assert.equal(vip.name, 'Custom VIP')
  assert.equal(vip.discount_percent, 25)
  assert.equal(vip.loyalty_multiplier, 3.0)
})

test('Loyalty Tiers - validateMembershipTierInput validates visit thresholds and discounts', () => {
  const valid = validateMembershipTierInput({
    name: 'Hakum Platinum Member',
    min_visits: 100,
    max_visits: '',
    starting_price: 0,
    discount_percent: 15,
    loyalty_multiplier: 2.0,
    benefits: 'Priority booking\nMember discount',
    included_services: 'Standard Wash',
  })

  assert.equal(valid.name, 'Hakum Platinum Member')
  assert.equal(valid.min_visits, 100)
  assert.equal(valid.max_visits, null)
  assert.equal(valid.discount_percent, 15)
  assert.equal(valid.loyalty_multiplier, 2.0)
  assert.deepEqual(valid.benefits, ['Priority booking', 'Member discount'])
  assert.deepEqual(valid.included_services, ['Standard Wash'])

  // Rejects invalid max visits
  assert.throws(() => {
    validateMembershipTierInput({
      name: 'Invalid Tier',
      min_visits: 50,
      max_visits: 20,
    })
  }, /Max visits must be equal to or greater than min visits/)

  // Rejects missing name
  assert.throws(() => {
    validateMembershipTierInput({
      name: '',
      min_visits: 10,
    })
  }, /Tier name is required/)

  // Rejects invalid discount
  assert.throws(() => {
    validateMembershipTierInput({
      name: 'Tier',
      discount_percent: 150,
    })
  }, /Discount must be between 0 and 100/)
})

test('Loyalty Tiers - MembershipsPage and ops guide label tab as Loyalty tiers', () => {
  const step = MEMBERSHIPS_WORKFLOW_STEPS.find((s) => s.id === 'tiers')
  assert.ok(step)
  assert.equal(step.title, 'Loyalty tiers')

  const membershipsPageCode = fs.readFileSync(
    path.join(process.cwd(), 'src/pages/MembershipsPage.jsx'),
    'utf-8',
  )
  assert.match(membershipsPageCode, /id:\s*'tiers',\s*label:\s*'Loyalty tiers'/)
  assert.match(membershipsPageCode, /Add loyalty tier/)
  assert.match(membershipsPageCode, /min_visits/)
  assert.match(membershipsPageCode, /max_visits/)
})

