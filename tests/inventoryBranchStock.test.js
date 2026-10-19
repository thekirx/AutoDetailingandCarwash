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
  branchAssignmentRows,
  branchOnHand,
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

  it('assigns a sellable to a branch only when a stock row exists', () => {
    const catalog = [
      { id: 'a', name: 'Freshener', category: 'accessories', usage_kind: 'resellable' },
      { id: 'c', name: 'Shirt', category: 'clothing', usage_kind: 'resellable' },
      { id: 'chem', name: 'Soap', category: 'merch', usage_kind: 'internal' },
    ]
    const stock = { c: 0 }
    assert.deepEqual(branchAssignmentRows(catalog, stock, 'assigned').map((row) => row.id), ['c'])
    assert.equal(branchAssignmentRows(catalog, stock, 'assigned')[0].on_hand, 0)
    assert.deepEqual(branchAssignmentRows(catalog, stock, 'unassigned').map((row) => row.id), ['a'])
    assert.deepEqual(branchAssignmentRows(catalog, stock, 'accessories').map((row) => row.id), ['a'])
    assert.deepEqual(branchAssignmentRows(catalog, stock, 'sellables').map((row) => row.id), ['c'])
    assert.equal(branchOnHand([{ branch_slug: 'bacoor', qty: 2 }], 'bacoor'), 2)
    assert.equal(branchOnHand([{ branch_slug: 'bacoor', qty: 0 }], 'bacoor'), 0)
    assert.equal(branchOnHand([{ branch_slug: 'bacoor', qty: 2 }], 'imus'), null)
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
    assert.match(inv, /id: 'recon'/)
    assert.doesNotMatch(inv, /id: 'stock'/)
    assert.match(branch, /Restock/)
    assert.match(branch, /Sunday Recon/)
    assert.match(branch, /product_branch_stock/)
    assert.match(branch, /Assign to branch/)
    assert.match(branch, /branch-stock-filter/)
    assert.match(branch, /Not at this branch/)
    const pos = read('src/pages/PosPage.jsx')
    assert.match(pos, /stockMap\[p\.id\] != null/)
    assert.doesNotMatch(pos, /stockMap\[p\.id\] != null \? stockMap\[p\.id\] : p\.stock_qty/)
    assert.match(branch, /inventory_recons/)
  })

  it('activating a product does not turn an internal item into a sellable', () => {
    const api = read('src/lib/adminApi.js')
    const start = api.indexOf('export async function updateProduct')
    const body = api.slice(start, api.indexOf('\nexport async function', start + 20))
    assert.match(body, /if \(payload\.usage_kind !== undefined\)/)
    assert.doesNotMatch(body, /usage_kind: payload\.usage_kind === 'internal' \? 'internal' : 'resellable'/)
  })
})
