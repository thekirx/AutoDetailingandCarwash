/**
 * Owner Revisions P4 — inventory branch stock helpers + source seams.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  applyOwnerSetQty,
  applyReconLine,
  applyRestockQty,
  productIsResellable,
  reconUsageQty,
} from '../src/lib/inventoryBranchStock.js'
import { productIsPosSellable } from '../src/lib/posSellables.js'
import {
  ROLES,
  BRANCH_ADMIN_ROUTE_KEYS,
  allowRoute,
  canAccessInventory,
  canManageServices,
  canRestockInventory,
  getOperationsNav,
} from '../src/auth/permissions.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('inventoryBranchStock helpers', () => {
  it('usage_kind filter prefers resellable/internal over tags', () => {
    assert.equal(productIsResellable({ usage_kind: 'resellable', tags: [] }), true)
    assert.equal(productIsResellable({ usage_kind: 'internal', tags: ['coffee'] }), false)
    assert.equal(productIsResellable({ tags: ['coffee'] }), null)

    assert.equal(productIsPosSellable({ usage_kind: 'resellable', tags: ['not-a-tag'] }), true)
    assert.equal(productIsPosSellable({ usage_kind: 'internal', tags: ['coffee'] }), false)
    assert.equal(productIsPosSellable({ tags: ['coffee'] }), true)
    assert.equal(productIsPosSellable({ tags: ['not-a-tag'] }), false)
  })

  it('recon apply math: leftover becomes stock; usage = previous − leftover', () => {
    assert.equal(reconUsageQty(40, 28), 12)
    assert.equal(reconUsageQty(10, 15), -5)
    const applied = applyReconLine({ previousQty: 40, leftoverQty: 28 })
    assert.deepEqual(applied, { nextQty: 28, delta: -12, usageQty: 12 })
    assert.equal(applyRestockQty(5, 3), 8)
    assert.equal(applyOwnerSetQty(-2), 0)
    assert.equal(applyOwnerSetQty(17), 17)
  })
})

describe('inventory permissions + routes', () => {
  it('BA can restock inventory route; SA keeps catalog manage', () => {
    const ba = { role: ROLES.ADMIN, branch_slug: 'bacoor' }
    const sa = { role: ROLES.SUPER_ADMIN }
    assert.equal(canRestockInventory(ba), true)
    assert.equal(canAccessInventory(ba), true)
    assert.equal(canManageServices(ba), false)
    assert.equal(allowRoute(ba, 'inventory'), true)
    assert.ok(BRANCH_ADMIN_ROUTE_KEYS.includes('inventory'))
    assert.ok(getOperationsNav(ba).some((i) => i.to === '/operations/inventory'))
    assert.equal(canManageServices(sa), true)
    assert.equal(canAccessInventory(sa), true)
  })
})

describe('inventory P4 migrations + pages (source scan)', () => {
  it('schema migration defines branch stock, usage_kind, recon tables, RLS', () => {
    const sql = read('supabase/migrations/20260827110000_inventory_branch_governance.sql')
    assert.match(sql, /product_branch_stock/)
    assert.match(sql, /usage_kind/)
    assert.match(sql, /inventory_recons/)
    assert.match(sql, /inventory_recon_lines/)
    assert.match(sql, /movement_type/)
    assert.match(sql, /user_has_branch_access/)
    assert.match(sql, /guard_branch_stock_ba_increase/)
    // Writes are invoker RLS — no SECURITY DEFINER RPCs named for restock/recon/set.
    assert.equal(/\bcreate or replace function[\s\S]*security definer/i.test(sql), false)
  })

  it('complete_pos_sale follow-up deducts product_branch_stock fail-closed', () => {
    const sql = read('supabase/migrations/20260827111000_complete_pos_sale_branch_stock.sql')
    assert.match(sql, /create or replace function public\.complete_pos_sale/)
    assert.match(sql, /product_branch_stock/)
    assert.match(sql, /Insufficient branch stock/)
    assert.match(sql, /hakum\.allow_stock_decrease/)
    assert.match(sql, /movement_type.*sale|sale.*movement_type/)
  })

  it('InventoryPage + BranchInventoryPage wire restock / recon', () => {
    const inv = read('src/pages/InventoryPage.jsx')
    const branch = read('src/pages/BranchInventoryPage.jsx')
    assert.match(inv, /BranchInventoryPage/)
    assert.match(inv, /canManageServices/)
    assert.match(inv, /canRestockInventory/)
    assert.match(branch, /Restock/)
    assert.match(branch, /Sunday Recon/)
    assert.match(branch, /product_branch_stock/)
    assert.match(branch, /inventory_recons/)
  })
})
