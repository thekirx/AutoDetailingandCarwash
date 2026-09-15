/**
 * PH bay/pricing size for cars sold here.
 * Run: node --test tests/phVehicleSizes.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { inferPhPricingSize, PRICING_SIZE_SLUGS } from '../src/lib/phVehicleSizes.js'
import { flattenVehicleCatalog } from '../src/lib/phVehicles.js'

describe('inferPhPricingSize — PH wash/detail bay chart', () => {
  it('classifies by body footprint (sedan/hatch · crossover · SUV · XL)', () => {
    // Small — sedans / hatchbacks
    assert.equal(inferPhPricingSize('Toyota', 'Vios'), 'small')
    assert.equal(inferPhPricingSize('Toyota', 'Wigo'), 'small')
    assert.equal(inferPhPricingSize('Honda', 'City'), 'small')
    assert.equal(inferPhPricingSize('Honda', 'Civic'), 'small')
    assert.equal(inferPhPricingSize('Toyota', 'Corolla'), 'small')
    assert.equal(inferPhPricingSize('Mazda', 'Mazda3'), 'small')
    // Medium — crossovers / compact CUVs / small MPVs
    assert.equal(inferPhPricingSize('Toyota', 'Raize'), 'medium')
    assert.equal(inferPhPricingSize('Honda', 'WR-V'), 'medium')
    assert.equal(inferPhPricingSize('Audi', 'Q2'), 'medium')
    assert.equal(inferPhPricingSize('Mitsubishi', 'Xpander'), 'medium')
    assert.equal(inferPhPricingSize('Honda', 'HR-V'), 'medium')
    // Large — SUVs / pickups / larger MPVs
    assert.equal(inferPhPricingSize('Toyota', 'Fortuner'), 'large')
    assert.equal(inferPhPricingSize('Toyota', 'Hilux'), 'large')
    assert.equal(inferPhPricingSize('Hyundai', 'Tucson'), 'large')
    assert.equal(inferPhPricingSize('Kia', 'Sportage'), 'large')
    assert.equal(inferPhPricingSize('Honda', 'CR-V'), 'large')
    // Extra Large — full-size vans / people movers
    assert.equal(inferPhPricingSize('Toyota', 'Alphard'), 'extra_large')
    assert.equal(inferPhPricingSize('Toyota', 'Hiace'), 'extra_large')
    assert.equal(inferPhPricingSize('Audi', 'Q7'), 'extra_large')
    assert.equal(inferPhPricingSize('Yamaha', 'NMAX'), 'small')
  })

  it('is case-insensitive and keeps bikes small', () => {
    assert.equal(inferPhPricingSize('TOYOTA', 'vios'), 'small')
    assert.equal(inferPhPricingSize('Kawasaki', 'Barako'), 'small')
  })

  it('covers every seeded PH catalog row with a valid slug', () => {
    const rows = flattenVehicleCatalog()
    assert.ok(rows.length >= 400)
    for (const row of rows) {
      assert.ok(PRICING_SIZE_SLUGS.includes(row.size_slug), `${row.make} ${row.model} → ${row.size_slug}`)
    }
  })
})
