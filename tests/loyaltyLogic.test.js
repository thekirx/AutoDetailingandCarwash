import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildLoyaltyProgress } from '../src/lib/loyaltyLogic.js'

describe('loyalty progress', () => {
  const milestones = [
    { id: '1', threshold_points: 10, reward_label: 'Free wash', is_active: true },
    { id: '2', threshold_points: 15, reward_label: 'Premium detail', is_active: true },
  ]

  it('caps progress at card slots and finds next milestone', () => {
    const p = buildLoyaltyProgress(7, milestones, 15)
    assert.equal(p.completed, 7)
    assert.equal(p.nextMilestone?.reward_label, 'Free wash')
    assert.match(p.encouragement, /3 points away/)
  })

  it('marks earned milestones when threshold reached', () => {
    const p = buildLoyaltyProgress(12, milestones, 15)
    assert.equal(p.earnedMilestones.length, 1)
    assert.equal(p.nextMilestone?.threshold_points, 15)
  })
})
