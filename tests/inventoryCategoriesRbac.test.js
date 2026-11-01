import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROLES, canModifyStock, canRestockInventory, canManageServices, canAccessApprovals } from '../src/auth/permissions.js'
import {
  LOW_STOCK_THRESHOLD,
  RESTOCK_POLICY_NOTICE,
  STOCK_CATEGORIES,
  computeProductTotalOnHand,
  evaluateStockStatus,
  materialRoleLabel,
  stockCategoryHidesFromPos,
  stockCategoryLabel,
} from '../src/lib/inventoryCatalog.js'
import {
  applyOwnerSetQty,
  applyRestockQty,
  branchAssignmentRows,
  branchOnHand,
} from '../src/lib/inventoryBranchStock.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('Inventory RBAC — Owner, Lucy, Robert vs Branch Admin', () => {
  it('Owner (BossMich), Lucy, and Robert can modify stock directly', () => {
    const owner = { id: 'owner-1', role: ROLES.SUPER_ADMIN }
    const lucy = { id: 'lucy-asa', role: ROLES.ASSISTANT_SUPER_ADMIN }
    const robert = { id: 'robert-asa', role: ROLES.ASSISTANT_SUPER_ADMIN }
    const branchAdmin = { id: 'ba-1', role: ROLES.ADMIN, branch_slug: 'bacoor' }
    const teamLead = { id: 'tl-1', role: ROLES.TEAM_LEAD, branch_slug: 'bacoor' }

    assert.equal(canModifyStock(owner), true, 'Owner (BossMich) must be able to modify stock')
    assert.equal(canModifyStock(lucy), true, 'Lucy must be able to modify stock')
    assert.equal(canModifyStock(robert), true, 'Robert must be able to modify stock')

    assert.equal(canModifyStock(branchAdmin), false, 'Branch admin cannot modify existing stock numbers directly')
    assert.equal(canModifyStock(teamLead), false, 'Team lead cannot modify stock numbers directly')
  })

  it('Branch admin can restock inventory (submit restock request), but cannot manage catalog', () => {
    const branchAdmin = { id: 'ba-1', role: ROLES.ADMIN, branch_slug: 'bacoor' }
    assert.equal(canRestockInventory(branchAdmin), true)
    assert.equal(canManageServices(branchAdmin), false)
  })

  it('Owner and Assistant Super Admins can access approvals', () => {
    const owner = { role: ROLES.SUPER_ADMIN }
    const asa = { role: ROLES.ASSISTANT_SUPER_ADMIN }
    const ba = { role: ROLES.ADMIN }
    assert.equal(canAccessApprovals(owner), true)
    assert.equal(canAccessApprovals(asa), true)
    assert.equal(canAccessApprovals(ba), false)
  })
})

describe('Inventory Categories Contract', () => {
  it('defines the 4 required categories with exact POS and customer visibility', () => {
    const ids = STOCK_CATEGORIES.map((c) => c.id)
    assert.ok(ids.includes('merchandise'), 'Must have merchandise category')
    assert.ok(ids.includes('coffee_menu'), 'Must have coffee_menu category')
    assert.ok(ids.includes('coffee_material'), 'Must have coffee_material category')
    assert.ok(ids.includes('chemical'), 'Must have chemical category')

    assert.equal(stockCategoryLabel('merchandise'), 'Merchandise')
    assert.equal(stockCategoryLabel('coffee_menu'), 'Coffee Menu')
    assert.equal(stockCategoryLabel('coffee_material'), 'Coffee Materials')
    assert.equal(stockCategoryLabel('chemical'), 'Chemicals Inventory')

    // Visibility
    assert.equal(stockCategoryHidesFromPos('merchandise'), false, 'Merch shows on POS')
    assert.equal(stockCategoryHidesFromPos('coffee_menu'), false, 'Coffee Menu shows on POS')
    assert.equal(stockCategoryHidesFromPos('coffee_material'), true, 'Coffee Materials hidden from POS')
    assert.equal(stockCategoryHidesFromPos('chemical'), true, 'Chemicals hidden from POS')
  })

  it('coffee materials supports Cup and Beans material roles', () => {
    assert.equal(materialRoleLabel('cup'), 'Cup (1 cup per drink)')
    assert.equal(materialRoleLabel('beans'), 'Beans (20g per drink)')
    assert.equal(materialRoleLabel(null), null)
  })

  it('migration 20261101180000 ensures coffee recipe deducts 1 cup and 20g beans', () => {
    const sql = read('supabase/migrations/20261101180000_inventory_categories_and_rbac.sql')
    assert.match(sql, /apply_coffee_recipe/)
    assert.match(sql, /material_role = 'cup'/)
    assert.match(sql, /material_role = 'beans'/)
    assert.match(sql, /v_grams := v_qty \* 20/)
    assert.match(sql, /update public\.product_branch_stock[\s\S]*set qty = qty - v_qty/)
    assert.match(sql, /update public\.product_branch_stock[\s\S]*set qty = qty - v_grams/)
  })

  it('migration 20261101180000 allows Owner (BossMich) and Assistant Super Admin (Lucy, Robert) to review restock', () => {
    const sql = read('supabase/migrations/20261101180000_inventory_categories_and_rbac.sql')
    assert.match(sql, /create or replace function public\.review_restock/)
    assert.match(sql, /public\.is_super_admin\(\) or v_role = 'assistant_super_admin'/)
    assert.match(sql, /status = 'approved'/)
    assert.match(sql, /status = 'rejected'/)
  })
})

describe('Per-Branch Stock and Points to Merch Claim Deductions', () => {
  it('branchOnHand returns exact quantity for a chosen branch', () => {
    const stockRows = [
      { branch_slug: 'bacoor', qty: 15, size_key: '' },
      { branch_slug: 'imus', qty: 0, size_key: '' },
      { branch_slug: 'kawit', qty: 4, size_key: '' },
    ]
    assert.equal(branchOnHand(stockRows, 'bacoor'), 15)
    assert.equal(branchOnHand(stockRows, 'imus'), 0)
    assert.equal(branchOnHand(stockRows, 'kawit'), 4)
    assert.equal(branchOnHand(stockRows, 'dasmarinas'), null, 'Unassigned branch returns null')
  })

  it('branch assignment rows support filtering', () => {
    const products = [
      { id: 'p1', name: 'Microfiber Towel', category: 'accessories', usage_kind: 'resellable' },
      { id: 'p2', name: 'Hakum Shirt', category: 'clothing', usage_kind: 'resellable' },
    ]
    const stock = { p1: 10 }
    const assigned = branchAssignmentRows(products, stock, 'assigned')
    assert.equal(assigned.length, 1)
    assert.equal(assigned[0].id, 'p1')
    assert.equal(assigned[0].on_hand, 10)

    const unassigned = branchAssignmentRows(products, stock, 'unassigned')
    assert.equal(unassigned.length, 1)
    assert.equal(unassigned[0].id, 'p2')
  })

  it('points redemption deducts branch stock via redeem_accessory RPC', () => {
    const sql = read('supabase/migrations/20261017180000_redeem_branch_stock.sql')
    assert.match(sql, /update public\.product_branch_stock[\s\S]*set qty = qty - 1[\s\S]*where product_id = p_product[\s\S]*and branch_slug = p_branch/)
    assert.match(sql, /insert into public\.product_stock_movements[\s\S]*'accessory_redeem', 'sale'/)
  })

  it('Owner absolute set and restock add calculations work accurately', () => {
    assert.equal(applyOwnerSetQty(25), 25)
    assert.equal(applyOwnerSetQty('40'), 40)
    assert.equal(applyOwnerSetQty(-5), 0)

    assert.equal(applyRestockQty(10, 5), 15)
    assert.equal(applyRestockQty(0, 12), 12)
  })
})

describe('Restock Does Not Incur Cost — Finance Manual Purchasing Law', () => {
  it('RESTOCK_POLICY_NOTICE clarifies that restock updates counts only and purchasing costs belong in Finance', () => {
    assert.match(RESTOCK_POLICY_NOTICE, /updates physical on-hand inventory counts only/i)
    assert.match(RESTOCK_POLICY_NOTICE, /does not create an expense/i)
    assert.match(RESTOCK_POLICY_NOTICE, /handled manually in Finance/i)
    assert.match(RESTOCK_POLICY_NOTICE, /Chemical and Other Inventory/i)
  })

  it('restock functions in migrations strictly never insert into public.expenses', () => {
    const mig1 = read('supabase/migrations/20261026210000_inventory_categories.sql')
    const mig2 = read('supabase/migrations/20261101180000_inventory_categories_and_rbac.sql')
    assert.doesNotMatch(mig1, /insert into public\.expenses/i)
    assert.doesNotMatch(mig2, /insert into public\.expenses/i)
  })

  it('computeProductTotalOnHand sums stock across branches accurately', () => {
    const rows = [
      { branch_slug: 'bacoor', qty: 12 },
      { branch_slug: 'imus', qty: 5 },
      { branch_slug: 'kawit', qty: 0 },
    ]
    assert.equal(computeProductTotalOnHand(rows), 17)
    assert.equal(computeProductTotalOnHand([]), 0)
    assert.equal(computeProductTotalOnHand(null), 0)
  })

  it('evaluateStockStatus correctly tags out_of_stock, low_stock, and in_stock based on threshold', () => {
    assert.equal(LOW_STOCK_THRESHOLD, 5)

    const zero = evaluateStockStatus(0)
    assert.equal(zero.status, 'out_of_stock')
    assert.equal(zero.badgeVariant, 'destructive')

    const low1 = evaluateStockStatus(1)
    assert.equal(low1.status, 'low_stock')
    assert.equal(low1.badgeVariant, 'warning')

    const low5 = evaluateStockStatus(5)
    assert.equal(low5.status, 'low_stock')

    const healthy = evaluateStockStatus(6)
    assert.equal(healthy.status, 'in_stock')
    assert.equal(healthy.badgeVariant, 'success')
  })

  it('migration 20261101190000 syncs products.stock_qty trigger from product_branch_stock sum', () => {
    const sql = read('supabase/migrations/20261101190000_sync_products_total_stock_qty.sql')
    assert.match(sql, /create or replace function public\.sync_product_total_stock_qty/)
    assert.match(sql, /select sum\(qty\) from public\.product_branch_stock/)
    assert.match(sql, /create trigger product_branch_stock_sync_total/)
    assert.match(sql, /after insert or update of qty or delete on public\.product_branch_stock/)
  })
})
