import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildPosSalePayload, resolveCatalogListMinor } from '../src/lib/posSale.js'
import { normalizeProductSizeOptions, productSizePriceMinor } from '../src/lib/productSizes.js'

describe('sellable sizes', () => {
  it('keeps sizes optional and rejects a half-filled or duplicate row', () => {
    assert.deepEqual(normalizeProductSizeOptions([{ label: '', price: '' }, { label: '12 oz', price: '80' }]), [
      { label: '12 oz', price_minor: 8000 },
    ])
    assert.deepEqual(normalizeProductSizeOptions([]), [])
    assert.throws(() => normalizeProductSizeOptions([{ label: 'M', price: '' }]), /name and a price/)
    assert.throws(() => normalizeProductSizeOptions([{ label: 'M', price: '1' }, { label: 'm', price: '2' }]), /twice/)
  })

  it('charges the picked size and still allows a product with no sizes', () => {
    const shirt = { id: 'p1', price_minor: 10000, size_options: [{ label: 'M', price_minor: 35000 }, { label: 'XL', price_minor: 40000 }] }
    const towel = { id: 'p2', price_minor: 15000, size_options: [] }
    assert.equal(productSizePriceMinor(shirt, 'xl'), 40000)
    assert.equal(resolveCatalogListMinor({ item_type: 'product', id: 'p1', size_label: 'M' }, { products: [shirt] }), 35000)
    assert.equal(resolveCatalogListMinor({ item_type: 'product', id: 'p2' }, { products: [towel] }), 15000)
    const payload = buildPosSalePayload({
      branch: 'bacoor',
      paymentMethod: 'cash',
      cart: [{ item_type: 'product', id: 'p1', name: 'Shirt (M)', size_label: 'M', quantity: 1, unit_price_minor: 35000 }],
    })
    assert.equal(payload.lines[0].size_label, 'M')
    assert.equal(payload.lines[0].vehicle_size, null)
  })
})
