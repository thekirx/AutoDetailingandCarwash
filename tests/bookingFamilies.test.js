import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assessmentServiceFor,
  bookingFamilyOf,
  bookingFamilySteps,
  familyPickItems,
  groupBookingFamilies,
} from '../src/lib/bookingFamilies.js'

const svc = (slug, name, prices) => ({ id: slug, slug, name, size_prices: prices })
const CATALOG = [
  svc('ultimate-ceramic-coating', 'Ultimate Ceramic Coating', { small: 1500000, medium: 1950000 }),
  svc('platinum-ceramic-coating', 'Platinum Ceramic Coating', { medium: 2350000 }),
  svc('ceramic-paint-maintenance', 'Ceramic Paint Maintenance', { small: 250000, medium: 260000 }),
  svc('ppf-high-impact', 'Front PPF + Coating Package', { small: 4800000 }),
  svc('ppf-basic', 'Basic PPF Package', { medium: 7500000 }),
  svc('colored-ppf-package', 'Colored PPF Package', { medium: 10500000 }),
  svc('nano-ceramic-tint', 'Nano Ceramic Tint', { small: 600000 }),
  svc('nano-ceramic-pro-tint', 'Nano Ceramic Pro Tint', { medium: 1200000 }),
]

describe('customer Book families', () => {
  it('sorts the real catalog into PPF, Ceramic, Tint (ceramic tint stays tint)', () => {
    assert.equal(bookingFamilyOf(CATALOG[6]), 'tint')
    assert.equal(bookingFamilyOf(CATALOG[3]), 'ppf')
    assert.equal(bookingFamilyOf(CATALOG[2]), 'ceramic')
    const fams = groupBookingFamilies(CATALOG)
    assert.deepEqual(fams.map((f) => [f.key, f.items.length]), [['ppf', 3], ['ceramic', 3], ['tint', 2]])
    assert.equal(fams[1].fromMinor, 250000)
  })

  it('ceramic pick list follows the coated answer', () => {
    const ceramic = groupBookingFamilies(CATALOG).find((f) => f.key === 'ceramic')
    assert.deepEqual(familyPickItems(ceramic, 'hakum').map((s) => s.slug), ['ceramic-paint-maintenance'])
    assert.deepEqual(familyPickItems(ceramic, 'no').map((s) => s.slug), ['ultimate-ceramic-coating', 'platinum-ceramic-coating'])
    assert.deepEqual(familyPickItems(ceramic, 'elsewhere'), [])
    assert.equal(assessmentServiceFor(ceramic).slug, 'ceramic-paint-maintenance')
  })

  it('only ceramic asks a question', () => {
    assert.deepEqual(bookingFamilySteps('ppf'), ['car', 'pick', 'when', 'details', 'review'])
    assert.deepEqual(bookingFamilySteps('ceramic'), ['car', 'coated', 'pick', 'when', 'details', 'review'])
    assert.deepEqual(bookingFamilySteps('tint', { hasPackages: true }), ['car', 'pick', 'package', 'when', 'details', 'review'])
  })
})
