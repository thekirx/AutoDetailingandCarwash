import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { earnedVisitRewards, latestEarnedVisitReward, MEMBER_TIERS, memberTier, MERCH_POINTS, nextVisitReward, SERVICE_POINTS } from '../src/lib/rewardsCatalog.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('visit rewards and member tier', () => {
  it('uses the visit counts from the 25 Oct notes', () => {
    assert.deepEqual(
      earnedVisitRewards(18).map((row) => row.visit),
      [6, 12, 18],
    )
    assert.equal(nextVisitReward(18).visit, 24)
    assert.equal(nextVisitReward(18).label, 'Free back-to-zero add-on')
    assert.equal(nextVisitReward(30), null)
    assert.equal(latestEarnedVisitReward(18).label, 'Free premium car wash')
    assert.equal(latestEarnedVisitReward(5), null)
    assert.match(nextVisitReward(24).label, /15% off/)
  })

  it('sets the tier from total visits on any car', () => {
    assert.equal(memberTier(0).name, 'Hakum Basic Member')
    assert.equal(memberTier(29).name, 'Hakum Basic Member')
    assert.equal(memberTier(30).name, 'Hakum Deluxe Member')
    assert.equal(memberTier(70).name, 'Hakum Premium Member')
    assert.equal(memberTier(100).name, 'Hakum Platinum Member')
  })

  it('exposes 4 membership tiers and keeps rewards off the public landing page', () => {
    assert.equal(MEMBER_TIERS.length, 4)
    assert.deepEqual(
      MEMBER_TIERS.map((t) => t.name),
      ['Hakum Basic Member', 'Hakum Deluxe Member', 'Hakum Premium Member', 'Hakum Platinum Member'],
    )
    const landing = read('src/pages/PublicLandingPage.jsx')
    // Client, 10 Nov 2026: Rewards & Loyalty removed from the homepage.
    assert.doesNotMatch(landing, /BdRewards/)
  })

  it('keeps the published points table', () => {
    assert.equal(SERVICE_POINTS.find((row) => row.name === 'Premium car wash').points, 1)
    assert.equal(SERVICE_POINTS.find((row) => row.name === 'Platinum PPF').points, 60)
    assert.equal(MERCH_POINTS.find((row) => row.name === 'Hakum Shirt').points, 50)
    assert.equal(MERCH_POINTS.find((row) => row.name === 'Clear Pro Coffee Kit').points, 60)
  })
})
