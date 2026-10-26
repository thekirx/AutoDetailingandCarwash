import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { productShowsOnPos, stockCategoryHidesFromPos, stockCategoryLabel } from '../src/lib/inventoryCatalog.js'

describe('inventory categories', () => {
  it('sells coffee drinks and hides coffee stock and chemicals', () => {
    assert.equal(stockCategoryLabel('coffee_menu'), 'Coffee drinks')
    assert.equal(stockCategoryLabel('coffee_material'), 'Coffee stock')
    assert.equal(stockCategoryHidesFromPos('coffee_material'), true)
    assert.equal(stockCategoryHidesFromPos('chemical'), true)
    assert.equal(productShowsOnPos({ stock_category: 'coffee_menu', usage_kind: 'resellable', show_in_pos: true }), true)
    assert.equal(productShowsOnPos({ stock_category: 'coffee_material', usage_kind: 'resellable', show_in_pos: true }), false)
    assert.equal(productShowsOnPos({ stock_category: 'merchandise', usage_kind: 'resellable', show_in_pos: true, points_price: 50, price_minor: 0 }), false)
    assert.equal(productShowsOnPos({ stock_category: 'merchandise', usage_kind: 'resellable', show_in_pos: true, points_price: 50, price_minor: 35000 }), true)
  })

  it('does not turn a coffee sale into a cup or bean deduction', () => {
    const dropped = readFileSync(new URL('../supabase/migrations/20261026220000_coffee_inventory_only.sql', import.meta.url), 'utf8')
    assert.match(dropped, /drop function if exists public\.apply_coffee_recipe/)
    assert.doesNotMatch(dropped, /20 grams/)
    const catalog = readFileSync(new URL('../src/lib/inventoryCatalog.js', import.meta.url), 'utf8')
    assert.doesNotMatch(catalog, /coffeeRecipeDeduction|COFFEE_BEAN_GRAMS/)
  })

  it('approves a restock as a count, with no expense', () => {
    const sql = readFileSync(new URL('../supabase/migrations/20261026210000_inventory_categories.sql', import.meta.url), 'utf8')
    assert.match(sql, /does not create an expense/)
    assert.doesNotMatch(sql, /insert into public\.expenses/)
    assert.match(sql, /You cannot type over the current count/)
  })
})
