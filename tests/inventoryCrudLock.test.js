/**
 * Michi C7/C8 — branch stock lives on merch product tables; inventory CRUD lock.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canMutateInventoryCrud,
  formatBranchOnHandSummary,
  inventoryCrudLockedFromSetting,
  stockRowsByProductId,
} from '../src/lib/inventoryLock.js'
import { ROLES } from '../src/auth/permissions.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('inventory CRUD lock helpers', () => {
  it('defaults unlocked; only Super Admin mutates when locked', () => {
    assert.equal(inventoryCrudLockedFromSetting(null), false)
    assert.equal(inventoryCrudLockedFromSetting({ locked: false }), false)
    assert.equal(inventoryCrudLockedFromSetting({ locked: true }), true)

    const sa = { role: ROLES.SUPER_ADMIN }
    const asa = { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: { services_merch: true } }
    const ba = { role: ROLES.ADMIN, branch_slug: 'bacoor' }
    assert.equal(canMutateInventoryCrud(sa, true), true)
    assert.equal(canMutateInventoryCrud(asa, true), false)
    assert.equal(canMutateInventoryCrud(ba, true), false)
    assert.equal(canMutateInventoryCrud(asa, false), true)
    assert.equal(canMutateInventoryCrud(ba, false), true)
  })

  it('formats per-branch on-hand for the merch product table', () => {
    const byProduct = stockRowsByProductId([
      { product_id: 'p1', branch_slug: 'bacoor', qty: 3 },
      { product_id: 'p1', branch_slug: 'imus', qty: 0 },
      { product_id: 'p2', branch_slug: 'silang', qty: 12 },
    ])
    assert.equal(byProduct.p1.length, 2)
    assert.equal(
      formatBranchOnHandSummary(byProduct.p1, { bacoor: 'Bacoor', imus: 'Imus' }),
      'Bacoor 3 · Imus 0',
    )
    assert.equal(formatBranchOnHandSummary([], {}), 'Not at a branch')
  })
})

describe('inventory C7/C8 source seams', () => {
  it('Inventory shell drops Branch stock tab; merch owns branch on-hand; recon stays', () => {
    const inv = read('src/pages/InventoryPage.jsx')
    assert.match(inv, /const INVENTORY_SHELL_TABS = \[/)
    assert.doesNotMatch(inv, /id: 'stock'/)
    assert.match(inv, /id: 'merch'/)
    assert.match(inv, /id: 'recon'/)
    assert.match(inv, /inventory_crud_lock|InventoryCrudLock|useInventoryCrudLock|getInventoryCrudLocked/)
    assert.match(inv, /ProductsManagePage/)
    assert.match(inv, /BranchInventoryPage/)
  })

  it('ProductsManagePage shows branch on-hand and respects CRUD lock', () => {
    const page = read('src/pages/ProductsManagePage.jsx')
    assert.match(page, /product_branch_stock/)
    assert.match(page, /formatBranchOnHandSummary|Branch on-hand/)
    assert.match(page, /canMutate|crudLocked|Inventory is locked/)
  })

  it('BranchInventoryPage blocks restock when locked for non-SA', () => {
    const page = read('src/pages/BranchInventoryPage.jsx')
    assert.match(page, /canMutate|Inventory is locked|crudLocked/)
  })

  it('adminApi lock toggle audits and notifies Super Admins', () => {
    const api = read('src/lib/adminApi.js')
    assert.match(api, /INVENTORY_CRUD_LOCK_KEY/)
    assert.match(api, /setInventoryCrudLocked/)
    assert.match(api, /getInventoryCrudLocked/)
    assert.match(api, /user_notifications/)
    assert.match(api, /writeAudit/)
    const lock = read('src/lib/inventoryLock.js')
    assert.match(lock, /inventory_crud_lock/)
  })

  it('migration guards catalog and branch stock while POS decrease still runs', () => {
    const sql = read('supabase/migrations/20261019150000_inventory_crud_lock.sql')
    assert.match(sql, /inventory_crud_lock/)
    assert.match(sql, /guard_inventory_crud_lock/)
    assert.match(sql, /hakum\.allow_stock_decrease/)
    assert.match(sql, /is_super_admin/)
    assert.match(sql, /product_branch_stock/)
    assert.match(sql, /products/)
    assert.match(sql, /services/)
  })
})
