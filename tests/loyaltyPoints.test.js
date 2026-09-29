import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { LANDING_DETAILING_PACKAGES, bookedDetailingServiceId, packagesForService, splitBookedService } from '../src/lib/detailingPackages.js'
import { defaultPointsAward, pointsLabel } from '../src/lib/loyaltyPoints.js'
import { buildThumbReview } from '../src/lib/serviceReviews.js'

describe('visit points', () => {
  it('defaults match the shop card and stay overridable by a stored award', () => {
    assert.equal(defaultPointsAward({ slug: 'premium-car-wash', pay_category: 'wash' }), 1)
    assert.equal(defaultPointsAward({ slug: 'express-wash-package', pay_category: 'package' }), 2)
    assert.equal(defaultPointsAward({ slug: 'nano-ceramic-tint', pay_category: 'detailing' }), 3)
    assert.equal(defaultPointsAward({ slug: 'paint-maintenance', pay_category: 'detailing' }), 3)
    assert.equal(defaultPointsAward({ slug: 'ceramic-coating', pay_category: 'detailing' }), 5)
    assert.equal(defaultPointsAward({ slug: 'paint-protection-film', name: 'PPF' }), 10)
    assert.equal(pointsLabel(1), '1 point')
    assert.equal(pointsLabel(10), '10 points')
  })

  it('groups landing packages under their detailing service', () => {
    const ceramic = LANDING_DETAILING_PACKAGES.filter((p) => p.parentSlug === 'ceramic-coating').map((p) => p.name)
    const ppf = LANDING_DETAILING_PACKAGES.filter((p) => p.parentSlug === 'paint-protection-film').map((p) => p.name)
    assert.deepEqual(ceramic, ['Premium', 'Platinum'])
    assert.deepEqual(ppf, ['High Impact Partial', 'Basic PPF Protection', 'Ultimate PPF Protection', 'Platinum PPF Protection'])
    const rows = [
      { id: 'pkg', parent_service_id: 'ceramic', name: 'Platinum', display_order: 2, is_active: true },
      { id: 'other', parent_service_id: 'ppf', name: 'Basic', display_order: 1, is_active: true },
    ]
    assert.deepEqual(packagesForService(rows, 'ceramic').map((r) => r.id), ['pkg'])
    const catalog = [
      { id: 'ceramic', parent_service_id: null },
      { id: 'premium', parent_service_id: 'ceramic' },
      { id: 'platinum', parent_service_id: 'ceramic' },
    ]
    assert.equal(bookedDetailingServiceId('ceramic', 'platinum', packagesForService(catalog, 'ceramic')), 'platinum')
    assert.equal(bookedDetailingServiceId('ceramic', '', packagesForService(catalog, 'ceramic')), '')
    assert.equal(bookedDetailingServiceId('tint', '', []), 'tint')
    assert.deepEqual(splitBookedService(catalog, 'premium'), { serviceId: 'ceramic', packageId: 'premium' })
    const book = readFileSync(new URL('../src/pages/CustomerBookPage.jsx', import.meta.url), 'utf8')
    const publicBook = readFileSync(new URL('../src/pages/PublicUtilityPage.jsx', import.meta.url), 'utf8')
    const board = readFileSync(new URL('../src/pages/BookingBoardPage.jsx', import.meta.url), 'utf8')
    assert.match(book, /bookedDetailingServiceId/)
    assert.match(publicBook, /Select package/)
    assert.match(board, /aria-label="Package"/)
    const sql = readFileSync(new URL('../supabase/migrations/20260928160000_detailing_packages_points_reviews.sql', import.meta.url), 'utf8')
    for (const pkg of LANDING_DETAILING_PACKAGES) assert.match(sql, new RegExp(pkg.slug))
  })
})

describe('thumbs review', () => {
  it('up is a five and down is a one, with the note trimmed', () => {
    assert.equal(buildThumbReview('up', '  loved it  ').overall_rating, 5)
    assert.equal(buildThumbReview('down').overall_rating, 1)
    assert.equal(buildThumbReview('down', '  slow  ').comment, 'slow')
    assert.equal(buildThumbReview('maybe'), null)
  })
})
