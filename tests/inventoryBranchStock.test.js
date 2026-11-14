/**
 * Owner Revisions P4 — inventory branch stock helpers + source seams.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  aggregateBranchStockMap,
  applyOwnerSetQty,
  applyReconLine,
  applyRestockQty,
  branchAssignmentRows,
  branchOnHand,
  buildReconApprovalMutations,
  countPendingRestocksForScope,
  filterOperationalBranches,
  filterOperationalStockRows,
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

  it('filters operational branches and strips ghost stock from archived/coming-soon/test branches', () => {
    const branches = [
      { slug: 'bacoor', name: 'Hakum Auto Care Bacoor', is_active: true, is_archived: false, coming_soon: false, is_public: true },
      { slug: 'batangas', name: 'Hakum Auto Care Batangas', is_active: true, is_archived: false, coming_soon: false, is_public: true },
      { slug: 'dasmarinas', name: 'Hakum Auto Care Dasmariñas', is_active: false, is_archived: false, coming_soon: true, is_public: true },
      { slug: 'imus', name: 'Hakum Auto Care Imus', is_active: true, is_archived: false, coming_soon: true, is_public: true },
      { slug: 'hq', name: 'Hakum HQ / Office', is_active: true, is_archived: false, coming_soon: false, is_public: false },
      { slug: 'crudtest-kbonkz', name: 'CRUD Test', is_active: false, is_archived: true, coming_soon: false, is_public: false },
    ]
    const opBranches = filterOperationalBranches(branches)
    assert.deepEqual(opBranches.map((b) => b.slug), ['bacoor', 'batangas'])

    const rawStock = [
      { product_id: 'p1', branch_slug: 'bacoor', size_key: '', qty: 100 },
      { product_id: 'p1', branch_slug: 'batangas', size_key: '', qty: 100 },
      { product_id: 'p1', branch_slug: 'dasmarinas', size_key: '', qty: 100 },
      { product_id: 'p1', branch_slug: 'hq', size_key: '', qty: 100 },
      { product_id: 'p1', branch_slug: 'crudtest-kbonkz', size_key: '', qty: 100 },
    ]
    const cleanStock = filterOperationalStockRows(rawStock, opBranches)
    assert.equal(cleanStock.length, 2)
    assert.deepEqual(cleanStock.map((r) => r.branch_slug), ['bacoor', 'batangas'])
  })

  it('aggregates multi-size branch stock accurately instead of overwriting by last row, and plans batched recon upserts', () => {
    const branchRows = [
      { product_id: 'tee', branch_slug: 'bacoor', size_key: 's', qty: 10 },
      { product_id: 'tee', branch_slug: 'bacoor', size_key: 'm', qty: 15 },
      { product_id: 'tee', branch_slug: 'bacoor', size_key: 'xl', qty: 0 },
      { product_id: 'kit', branch_slug: 'bacoor', size_key: '', qty: 40 },
    ]
    const agg = aggregateBranchStockMap(branchRows)
    assert.equal(agg.totalsByProductId.tee, 25)
    assert.equal(agg.totalsByProductId.kit, 40)
    assert.equal(agg.unsizedByProductId.kit, 40)
    assert.equal(agg.unsizedByProductId.tee, undefined)
    assert.equal(agg.sizedRowsByProductId.tee.length, 3)

    const plan = buildReconApprovalMutations(
      [
        { product_id: 'kit', previous_qty: 40, leftover_qty: 28 },
        { product_id: 'soap', previous_qty: 10, leftover_qty: 6 },
      ],
      agg.unsizedByProductId,
      { branchSlug: 'bacoor', userId: 'u-owner' },
    )
    assert.equal(plan.stockUpserts.length, 2)
    assert.deepEqual(plan.stockUpserts[0], {
      product_id: 'kit',
      branch_slug: 'bacoor',
      size_key: '',
      qty: 28,
    })
    assert.equal(plan.movements.length, 2)
    assert.equal(plan.movements[0].delta, -12)
    assert.equal(plan.movements[0].movement_type, 'recon_adjust')
  })

  it('counts pending restock requests scoped to branch filter and admin branch scope list', () => {
    const reqs = [
      { id: 'r1', branch_slug: 'bacoor', status: 'pending' },
      { id: 'r2', branch_slug: 'bacoor', status: 'pending' },
      { id: 'r3', branch_slug: 'batangas', status: 'pending' },
      { id: 'r4', branch_slug: 'batangas', status: 'approved' },
      { id: 'r5', branch_slug: 'crudtest-x', status: 'pending' },
    ]
    assert.equal(countPendingRestocksForScope(reqs, 'all', ['bacoor', 'batangas']), 3)
    assert.equal(countPendingRestocksForScope(reqs, 'bacoor', ['bacoor', 'batangas']), 2)
    assert.equal(countPendingRestocksForScope(reqs, 'batangas', ['bacoor', 'batangas']), 1)
    assert.equal(countPendingRestocksForScope(reqs, 'all', ['batangas']), 1)
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
