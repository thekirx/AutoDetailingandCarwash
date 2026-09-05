import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildPublicServiceOverview,
  enrichPublicCatalogService,
  marketingCopyForServiceSlug,
  publicPackageOverview,
} from '../src/lib/publicCatalog.js'
import { classifySaleBucket as classifyBacoorBucket } from '../src/lib/bacoorDailyReport.js'
import { classifySaleBucket as classifyPosBucket } from '../src/lib/posSellables.js'

describe('public catalog uses inventory names', () => {
  it('maps DB slug to homepage marketing copy when aliases match', () => {
    assert.match(marketingCopyForServiceSlug('premium-car-wash'), /exterior clean/i)
    assert.match(marketingCopyForServiceSlug('nano-ceramic-tint'), /heat-rejecting/i)
    assert.equal(marketingCopyForServiceSlug('paint-maintenance'), '')
  })

  it('keeps the inventory name on the card while overlaying marketing copy', () => {
    const card = enrichPublicCatalogService({
      id: 'svc-1',
      slug: 'premium-car-wash',
      name: 'Premium Car Wash',
      description: 'Mock service for queue ticket testing.',
    })
    assert.equal(card.title, 'Premium Car Wash')
    assert.match(card.copy, /exterior clean/i)
  })

  it('falls back to inventory description when no marketing overlay exists', () => {
    const card = enrichPublicCatalogService({
      id: 'svc-2',
      slug: 'paint-maintenance',
      name: 'Paint Maintenance',
      description: 'Follow-up paint maintenance for Ceramic Coating and PPF.',
    })
    assert.equal(card.title, 'Paint Maintenance')
    assert.match(card.copy, /Follow-up paint maintenance/)
  })

  it('lists PPF package titles from ppfPackages.js', () => {
    const overview = publicPackageOverview()
    assert.deepEqual(overview.ppf, ['Basic Protection', 'Premium Protection', 'Platinum Protection'])
    assert.deepEqual(overview.ceramic, ['PREMIUM', 'PLATINUM'])
  })

  it('buildPublicServiceOverview preserves display order from rows', () => {
    const rows = buildPublicServiceOverview([
      { id: 'a', slug: 'ceramic-coating', name: 'Ceramic Coating', description: 'A' },
      { id: 'b', slug: 'premium-car-wash', name: 'Premium Car Wash', description: 'B' },
    ])
    assert.equal(rows[0].title, 'Ceramic Coating')
    assert.equal(rows[1].title, 'Premium Car Wash')
  })

  it('keeps the public service catalog usable when the live catalog is unavailable', () => {
    const rows = buildPublicServiceOverview([])

    assert.deepEqual(rows.map((item) => item.title), [
      'Carwash',
      'Interior Detailing',
      'Ceramic Tint',
      'Ceramic Coating',
      'Glass Detailing',
      'Engine Wash',
      'Paint Protection Film',
    ])
  })

  it('maps Glass / Engine / Mobile homepage SKUs to marketing copy', () => {
    assert.match(marketingCopyForServiceSlug('glass-detailing'), /glass/i)
    assert.match(marketingCopyForServiceSlug('engine-wash'), /engine/i)
    assert.match(marketingCopyForServiceSlug('mobile-detailing'), /convenient/i)
  })
})

describe('sale bucket classifiers share POS logic', () => {
  it('maps POS buckets to Bacoor close buckets through one adapter', () => {
    assert.equal(classifyPosBucket({ payCategory: 'ppf' }), 'ppf')
    assert.equal(classifyBacoorBucket({ pay_category: 'ppf' }), 'ppf')
    assert.equal(classifyBacoorBucket({ booking_id: 'b1', pay_category: 'detailing' }), 'detailing')
    assert.equal(classifyBacoorBucket({ pos_handoff_id: 'h1', pay_category: 'wash' }), 'carwash')
    assert.equal(
      classifyBacoorBucket({ name: 'Iced coffee', item_type: 'product', total_minor: 1 }),
      'refreshment',
    )
  })
})
