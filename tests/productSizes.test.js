import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { buildPosSalePayload, resolveCatalogListMinor } from '../src/lib/posSale.js'
import {
  findBranchSizeStock,
  normalizeProductSizeOptions,
  productSizeKey,
  productSizePriceMinor,
  productStockSizeKeys,
} from '../src/lib/productSizes.js'
import { formatBranchOnHandSummary } from '../src/lib/inventoryLock.js'

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

  it('keys branch stock by size and summarizes on-hand cells', () => {
    assert.equal(productSizeKey(' XL '), 'xl')
    assert.deepEqual(productStockSizeKeys({ size_options: [] }), [''])
    assert.deepEqual(productStockSizeKeys({ size_options: [{ label: 'M', price_minor: 1 }, { label: 'XL', price_minor: 2 }] }), [
      'm',
      'xl',
    ])
    const rows = [
      { branch_slug: 'bacoor', size_key: 'm', qty: 3 },
      { branch_slug: 'bacoor', size_key: 'xl', qty: 1 },
    ]
    assert.equal(findBranchSizeStock(rows, 'bacoor', 'M')?.qty, 3)
    assert.equal(findBranchSizeStock(rows, 'bacoor', 'xl')?.qty, 1)
    assert.match(formatBranchOnHandSummary(rows, { bacoor: 'Bacoor' }), /Bacoor m 3/)
    const mig = readFileSync(new URL('../supabase/migrations/20261019220000_product_branch_stock_size_key.sql', import.meta.url), 'utf8')
    assert.match(mig, /size_key/)
    assert.match(mig, /pbs\.size_key/)
  })
})

