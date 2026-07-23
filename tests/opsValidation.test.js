import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  validateBranchInput,
  validateLoyaltyMilestoneInput,
  validateLoyaltyProgramSettings,
  validateMembershipTierInput,
  validateProvisionStaffInput,
  validateServiceInput,
  validateServiceLoyaltyWeight,
  validateStaffUpdate,
} from '../src/lib/opsValidation.js'

describe('ops CRUD validation', () => {
  it('rejects bad branch slug/code and accepts valid', () => {
    assert.throws(() => validateBranchInput({ name: 'X', slug: 'BAD!', code: 'AB' }), /URL-safe/)
    assert.throws(() => validateBranchInput({ name: 'X', slug: 'ok', code: '1' }), /2–5 uppercase/)
    const v = validateBranchInput({ name: ' Imus ', slug: 'imus', code: 'ims', address: ' Cavite ' })
    assert.equal(v.code, 'IMS')
    assert.equal(v.slug, 'imus')
    assert.equal(v.address, 'Cavite')
    assert.equal(v.is_active, true)
    assert.equal(v.coming_soon, false)
  })

  it('maps coming soon status and validates geo pairs', () => {
    const soon = validateBranchInput({
      name: 'Hakum Imus',
      slug: 'imus',
      code: 'IMS',
      status: 'coming_soon',
      latitude: 14.4,
      longitude: 120.9,
    })
    assert.equal(soon.coming_soon, true)
    assert.equal(soon.is_active, false)
    assert.equal(soon.latitude, 14.4)

    assert.throws(
      () => validateBranchInput({ name: 'X', slug: 'x', code: 'XX', latitude: 14 }),
      /both latitude and longitude/,
    )
    assert.throws(
      () => validateBranchInput({ name: 'X', slug: 'x', code: 'XX', latitude: 100, longitude: 120 }),
      /Latitude/,
    )
  })

  it('rejects blank service name and bad price/duration', () => {
    assert.throws(() => validateServiceInput({ name: '  ', price: '100', duration_minutes: '30' }), /name is required/)
    assert.throws(() => validateServiceInput({ name: 'Wash', price: '-1', duration_minutes: '30' }), /0 or greater/)
    assert.throws(() => validateServiceInput({ name: 'Wash', price: '100', duration_minutes: '0' }), /greater than 0/)
    const v = validateServiceInput({ name: 'Exterior Wash', price: '199.5', duration_minutes: '45' })
    assert.equal(v.price_minor, 19950)
    assert.equal(v.slug, 'exterior-wash')
  })

  it('rejects staff updates without name/branch and protects BossMich', () => {
    assert.throws(() => validateStaffUpdate({ id: '1', full_name: '', role: 'staff', branch_slug: 'bacoor' }), /Full name/)
    assert.throws(() => validateStaffUpdate({ id: '1', full_name: 'A', role: 'BossMich', branch_slug: null }), /Super Admin/)
    assert.throws(() => validateStaffUpdate({ id: '1', full_name: 'A', role: 'staff', branch_slug: '' }), /Branch is required/)
    const v = validateStaffUpdate({ id: '1', full_name: ' Staff ', role: 'staff', branch_slug: 'bacoor', phone: '09171234567' })
    assert.equal(v.full_name, 'Staff')
  })

  it('rejects bad provision emails', () => {
    assert.throws(() => validateProvisionStaffInput({ email: 'nope', full_name: 'A', role: 'staff', branch_slug: 'bacoor' }), /email/)
    const v = validateProvisionStaffInput({
      email: ' TL@Hakum.com ',
      full_name: 'Lead',
      role: 'team_lead',
      branch_slug: 'bacoor',
    })
    assert.equal(v.email, 'tl@hakum.com')
  })

  it('validates membership tiers and loyalty milestones', () => {
    assert.throws(() => validateMembershipTierInput({ name: '', starting_price: '100' }), /name/)
    const tier = validateMembershipTierInput({
      name: 'Gold',
      starting_price: '9999',
      discount_percent: '10',
      loyalty_multiplier: '1.5',
      benefits: 'Priority\nPromos',
      included_services: 'Premium Car Wash',
    })
    assert.equal(tier.starting_price_minor, 999900)
    assert.deepEqual(tier.benefits, ['Priority', 'Promos'])

    assert.throws(() => validateLoyaltyMilestoneInput({ threshold_points: '0', reward_label: 'X' }), /Threshold/)
    const milestone = validateLoyaltyMilestoneInput({
      threshold_points: '10',
      reward_label: 'Free wash',
      reward_description: 'Standard wash',
      sort_order: '1',
    })
    assert.equal(milestone.threshold_points, 10)

    assert.throws(() => validateLoyaltyProgramSettings({ card_slots: '3' }), /between 5 and 50/)
    assert.throws(() => validateServiceLoyaltyWeight('101'), /0 to 100/)
    assert.equal(validateServiceLoyaltyWeight('3'), 3)
  })
})
