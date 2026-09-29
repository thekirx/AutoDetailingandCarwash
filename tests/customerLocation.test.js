import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { nearestBranchSlug } from '../src/lib/branchGeo.js'
import {
  formatDistanceKm,
  loadCustomerPin,
  resolveCustomerQueueBranch,
  saveCustomerPin,
  CUSTOMER_PIN_KEY,
} from '../src/lib/customerLocation.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const branches = [
  { slug: 'bacoor', name: 'Bacoor', latitude: 14.459, longitude: 120.929 },
  { slug: 'batangas', name: 'Batangas', latitude: 13.7563, longitude: 121.0583 },
  { slug: 'soon', name: 'Soon', coming_soon: true, latitude: 14.46, longitude: 120.93 },
]

describe('customer queue branch', () => {
  it('keeps an explicit branch even when the pin is closer to another shop', () => {
    const resolved = resolveCustomerQueueBranch({
      wanted: 'batangas',
      pin: { lat: 14.45, lng: 120.94 },
      branches,
    })
    assert.equal(resolved.slug, 'batangas')
    assert.equal(resolved.source, 'choice')
  })

  it('picks the nearest open branch from a pin when nothing was chosen', () => {
    const resolved = resolveCustomerQueueBranch({
      pin: { lat: 13.76, lng: 121.05 },
      branches,
    })
    assert.equal(resolved.slug, 'batangas')
    assert.equal(resolved.source, 'nearest')
    assert.ok(resolved.distanceKm < 5)
  })

  it('ignores a missing latitude instead of treating it as the equator', () => {
    const nearest = nearestBranchSlug(
      { lat: 14.45, lng: 120.94 },
      [{ slug: 'bacoor', name: 'Bacoor', latitude: null, longitude: null }],
    )
    assert.equal(nearest.slug, 'bacoor')
    assert.ok(nearest.distanceKm < 20)
  })
  it('ignores a coming-soon shop that sits on the pin', () => {
    const nearest = nearestBranchSlug({ lat: 14.46, lng: 120.93 }, branches)
    assert.equal(nearest.slug, 'bacoor')
  })

  it('falls back to the first open branch without a pin', () => {
    const resolved = resolveCustomerQueueBranch({ branches })
    assert.equal(resolved.slug, 'bacoor')
    assert.equal(resolved.source, 'default')
  })

  it('formats walking distance in metres and driving distance in kilometres', () => {
    assert.equal(formatDistanceKm(0.42), '420 m')
    assert.equal(formatDistanceKm(4.24), '4.2 km')
    assert.equal(formatDistanceKm(18.2), '18 km')
  })

  it('round-trips a saved pin and rejects a broken one', () => {
    const store = new Map()
    globalThis.localStorage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    }
    assert.equal(loadCustomerPin(), null)
    assert.deepEqual(saveCustomerPin({ lat: 14.45, lng: 120.98 }), { lat: 14.45, lng: 120.98 })
    assert.equal(store.has(CUSTOMER_PIN_KEY), true)
    assert.deepEqual(loadCustomerPin(), { lat: 14.45, lng: 120.98 })
    store.set(CUSTOMER_PIN_KEY, '{')
    assert.equal(loadCustomerPin(), null)
    assert.equal(saveCustomerPin({ lat: 99, lng: 0 }), null)
  })

  it('wires the pin into the live queue and the home preview', () => {
    const queue = read('src/pages/CustomerQueuePage.jsx')
    const home = read('src/pages/CustomerAccountPage.jsx')
    assert.match(queue, /resolveCustomerQueueBranch/)
    assert.match(queue, /CustomerPinControl/)
    assert.match(home, /CustomerPinControl/)
    assert.match(read('src/components/customer/CustomerPinControl.jsx'), /Pin my location/)
    assert.match(read('src/styles-customer-app.css'), /\.capp-pin/)
  })
})
