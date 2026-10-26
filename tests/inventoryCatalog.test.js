import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { coffeeRecipeDeduction, productShowsOnPos, stockCategoryHidesFromPos } from '../src/lib/inventoryCatalog.js'

describe('inventory categories', () => {
  it('hides coffee materials and chemicals from POS', () => {
    assert.equal(stockCategoryHidesFromPos('coffee_material'), true)
    assert.equal(stockCategoryHidesFromPos('chemical'), true)
    assert.equal(productShowsOnPos({ stock_category: 'coffee_menu', usage_kind: 'resellable', show_in_pos: true }), true)
    assert.equal(productShowsOnPos({ stock_category: 'merchandise', usage_kind: 'resellable', show_in_pos: false }), false)
    assert.equal(productShowsOnPos({ stock_category: 'chemical', usage_kind: 'resellable', show_in_pos: true }), false)
  })

  it('uses one cup and 20 grams of beans per coffee', () => {
    assert.deepEqual(coffeeRecipeDeduction(2), { cups: 2, beanGrams: 40 })
    assert.deepEqual(coffeeRecipeDeduction(1), { cups: 1, beanGrams: 20 })
  })

  it('approves a restock as a count, with no expense', () => {
    const sql = readFileSync(new URL('../supabase/migrations/20261026210000_inventory_categories.sql', import.meta.url), 'utf8')
    assert.match(sql, /v_qty \* 20/)
    assert.match(sql, /material_role = 'beans'/)
    assert.match(sql, /does not create an expense/)
    assert.doesNotMatch(sql, /insert into public\.expenses/)
    assert.match(sql, /You cannot type over the current count/)
  })
})
