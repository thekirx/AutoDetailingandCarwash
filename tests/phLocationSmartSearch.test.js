import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  formatPhPlaceSummary,
  mergePhSearchResults,
  suggestPhilippinesPlaces,
} from '../src/lib/phPlaces.js'
import {
  CUSTOMER_PIN_KEY,
  formatCustomerLocationLabel,
  loadCustomerPin,
  saveCustomerPin,
} from '../src/lib/customerLocation.js'

describe('Philippines smart place search & summary', () => {
  it('condenses verbose Nominatim PH addresses into concise primary + secondary text', () => {
    const summary = formatPhPlaceSummary({
      display_name:
        'SM City Bacoor, Aguinaldo Highway, Habay I, Bacoor, Cavite, Calabarzon, 4102, Philippines',
      address: {
        amenity: 'SM City Bacoor',
        suburb: 'Habay I',
        city: 'Bacoor',
        province: 'Cavite',
        country: 'Philippines',
      },
    })
    assert.equal(summary.primary, 'SM City Bacoor, Bacoor')
    assert.match(summary.secondary, /Cavite/)
    assert.doesNotMatch(summary.primary, /Philippines|Calabarzon|4102/)
  })

  it('suggests instant Philippines corridors & major cities across Luzon, Visayas, Mindanao', () => {
    const bgc = suggestPhilippinesPlaces('BGC')
    assert.ok(bgc.some((p) => /Taguig|Bonifacio/i.test(p.label)))
    const cebu = suggestPhilippinesPlaces('Cebu')
    assert.ok(cebu.some((p) => /Cebu City/i.test(p.label)))
    const davao = suggestPhilippinesPlaces('Davao')
    assert.ok(davao.some((p) => /Davao/i.test(p.label)))
    const dasma = suggestPhilippinesPlaces('Dasma')
    assert.ok(dasma.some((p) => /Dasmariñas/i.test(p.label)))
  })

  it('merges live Nominatim results with instant PH suggestions without near-duplicate entries', () => {
    const instant = suggestPhilippinesPlaces('Bacoor')
    const remote = [
      {
        id: 'nom-1',
        label: 'Molino II, Bacoor, Cavite',
        address: 'Molino II, Bacoor, Cavite, Calabarzon, Philippines',
        lat: 14.397,
        lng: 120.975,
      },
    ]
    const merged = mergePhSearchResults(instant, remote)
    assert.ok(merged.some((r) => r.id === 'nom-1'))
    assert.ok(merged.length >= 2)
  })
})

describe('customer pin human-readable location text persistence', () => {
  it('preserves bare { lat, lng } contract and round-trips optional label + address', () => {
    const store = new Map()
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    }

    assert.deepEqual(saveCustomerPin({ lat: 14.45, lng: 120.98 }), { lat: 14.45, lng: 120.98 })
    assert.deepEqual(loadCustomerPin(), { lat: 14.45, lng: 120.98 })

    const rich = saveCustomerPin({
      lat: 14.5547,
      lng: 121.0244,
      label: 'Makati CBD, Makati',
      address: 'Ayala Avenue, Makati, Metro Manila',
      source: 'manual',
    })
    assert.deepEqual(rich, {
      lat: 14.5547,
      lng: 121.0244,
      label: 'Makati CBD, Makati',
      address: 'Ayala Avenue, Makati, Metro Manila',
      source: 'manual',
    })
    assert.equal(formatCustomerLocationLabel(loadCustomerPin()), 'Makati CBD, Makati')
    assert.equal(loadCustomerPin()?.source, 'manual')
    store.delete(CUSTOMER_PIN_KEY)
    assert.equal(formatCustomerLocationLabel(null), '')
  })
})
