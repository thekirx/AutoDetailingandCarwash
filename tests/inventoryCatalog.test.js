import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import {
  MATERIAL_ROLES,
  materialRoleLabel,
  productShowsOnPos,
  stockCategoryHidesFromPos,
  stockCategoryLabel,
} from '../src/lib/inventoryCatalog.js'

describe('inventory categories', () => {
  it('sells merchandise and coffee menu on POS; hides coffee materials and chemicals', () => {
    assert.equal(stockCategoryLabel('merchandise'), 'Merchandise')
    assert.equal(stockCategoryLabel('coffee_menu'), 'Coffee Menu')
    assert.equal(stockCategoryLabel('coffee_material'), 'Coffee Materials')
    assert.equal(stockCategoryLabel('chemical'), 'Chemicals Inventory')

    assert.equal(stockCategoryHidesFromPos('merchandise'), false)
    assert.equal(stockCategoryHidesFromPos('coffee_menu'), false)
    assert.equal(stockCategoryHidesFromPos('coffee_material'), true)
    assert.equal(stockCategoryHidesFromPos('chemical'), true)

    assert.equal(productShowsOnPos({ stock_category: 'coffee_menu', usage_kind: 'resellable', show_in_pos: true }), true)
    assert.equal(productShowsOnPos({ stock_category: 'coffee_material', usage_kind: 'resellable', show_in_pos: true }), false)
    assert.equal(productShowsOnPos({ stock_category: 'chemical', usage_kind: 'internal', show_in_pos: false }), false)
    assert.equal(productShowsOnPos({ stock_category: 'merchandise', usage_kind: 'resellable', show_in_pos: true, points_price: 50, price_minor: 0 }), false)
    assert.equal(productShowsOnPos({ stock_category: 'merchandise', usage_kind: 'resellable', show_in_pos: true, points_price: 50, price_minor: 35000 }), true)
  })

  it('supports coffee material roles for cups and beans', () => {
    assert.ok(MATERIAL_ROLES.some((r) => r.id === 'cup'))
    assert.ok(MATERIAL_ROLES.some((r) => r.id === 'beans'))
    assert.match(materialRoleLabel('cup'), /Cup/i)
    assert.match(materialRoleLabel('beans'), /Beans/i)
  })

  it('restores coffee recipe deduction in 20261101180000 migration', () => {
    const migration = readFileSync(new URL('../supabase/migrations/20261101180000_inventory_categories_and_rbac.sql', import.meta.url), 'utf8')
    assert.match(migration, /create or replace function public\.apply_coffee_recipe/)
    assert.match(migration, /v_grams := v_qty \* 20/)
    assert.match(migration, /material_role = 'cup'/)
    assert.match(migration, /material_role = 'beans'/)
  })

  it('approves a restock as a count, with no expense, and allows Super Admin and ASA review', () => {
    const sql = readFileSync(new URL('../supabase/migrations/20261101180000_inventory_categories_and_rbac.sql', import.meta.url), 'utf8')
    assert.match(sql, /public\.is_super_admin\(\) or v_role = 'assistant_super_admin'/)
    assert.match(sql, /product_stock_movements/)
    assert.doesNotMatch(sql, /insert into public\.expenses/)
  })
})
