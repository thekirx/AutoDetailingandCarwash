import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyStampWrap,
  buildLoyaltyProgress,
  computePointsDelta,
  computeStampDelta,
} from '../src/lib/loyaltyLogic.js'

describe('loyalty progress', () => {
  const milestones = [
    { id: '1', threshold_points: 10, reward_label: 'Free wash', is_active: true },
    { id: '2', threshold_points: 15, reward_label: 'Premium detail', is_active: true },
  ]

  it('caps progress at card slots and finds next milestone', () => {
    const p = buildLoyaltyProgress(7, milestones, 15)
    assert.equal(p.completed, 7)
    assert.equal(p.nextMilestone?.reward_label, 'Free wash')
    assert.match(p.encouragement, /3 stamps away/)
  })

  it('marks earned milestones when threshold reached', () => {
    const p = buildLoyaltyProgress(12, milestones, 15)
    assert.equal(p.earnedMilestones.length, 1)
    assert.equal(p.nextMilestone?.threshold_points, 15)
  })
})

describe('loyalty earn rules', () => {
  it('awards weighted stamps for all_weighted mode', () => {
    assert.equal(
      computeStampDelta({
        stampsEnabled: true,
        stampEarnMode: 'all_weighted',
        serviceWeight: 2,
        quantity: 3,
      }),
      6,
    )
  })

  it('skips stamps when program disabled or loyalty award line', () => {
    assert.equal(computeStampDelta({ stampsEnabled: false, serviceWeight: 2 }), 0)
    assert.equal(computeStampDelta({ isLoyaltyAward: true, serviceWeight: 2 }), 0)
  })

  it('limits stamps to selected pay categories (carwash)', () => {
    assert.equal(
      computeStampDelta({
        stampEarnMode: 'pay_categories',
        stampPayCategories: ['wash'],
        servicePayCategory: 'detailing',
        serviceWeight: 5,
      }),
      0,
    )
    assert.equal(
      computeStampDelta({
        stampEarnMode: 'pay_categories',
        stampPayCategories: ['wash'],
        servicePayCategory: 'wash',
        serviceWeight: 2,
        quantity: 2,
      }),
      4,
    )
  })

  it('applies membership multiplier to stamps when enabled', () => {
    assert.equal(
      computeStampDelta({
        serviceWeight: 2,
        quantity: 2,
        applyMembershipMultiplierToStamps: true,
        membershipsEnabled: true,
        membershipMultiplier: 1.5,
      }),
      6,
    )
    assert.equal(
      computeStampDelta({
        serviceWeight: 2,
        applyMembershipMultiplierToStamps: true,
        membershipsEnabled: false,
        membershipMultiplier: 2,
      }),
      2,
    )
  })

  it('computes spend points and respects kill-switch', () => {
    assert.equal(computePointsDelta({ serviceTotalMinor: 15000, membershipMultiplier: 2 }), 300)
    assert.equal(computePointsDelta({ pointsEnabled: false, serviceTotalMinor: 15000 }), 0)
    assert.equal(
      computePointsDelta({
        serviceTotalMinor: 10000,
        membershipsEnabled: false,
        membershipMultiplier: 5,
      }),
      100,
    )
  })

  it('wraps stamp balance at card capacity', () => {
    assert.equal(applyStampWrap(15, 15, true), 0)
    assert.equal(applyStampWrap(17, 15, true), 2)
    assert.equal(applyStampWrap(17, 15, false), 17)
  })
})
