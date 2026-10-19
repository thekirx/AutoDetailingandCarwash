/** Shop-wide inventory catalog + branch-stock CRUD lock (Michi C8). */
import { isSuperAdmin } from '../auth/permissions.js'

export const INVENTORY_CRUD_LOCK_KEY = 'inventory_crud_lock'

export function inventoryCrudLockedFromSetting(value) {
  if (!value || typeof value !== 'object') return false
  return value.locked === true
}

/** When locked, only Super Admin may change catalog / restock / recon submit. */
export function canMutateInventoryCrud(profile, locked) {
  if (!locked) return true
  return isSuperAdmin(profile)
}

export function stockRowsByProductId(rows = []) {
  const map = {}
  for (const row of rows || []) {
    const id = row?.product_id
    if (!id) continue
    if (!map[id]) map[id] = []
    map[id].push(row)
  }
  return map
}

/** Compact on-hand cell for the merch product table. */
export function formatBranchOnHandSummary(rows = [], branchNames = {}) {
  if (!rows?.length) return 'Not at a branch'
  return rows
    .map((r) => {
      const label = branchNames[r.branch_slug] || r.branch_slug
      return `${label} ${Math.max(0, Number(r.qty) || 0)}`
    })
    .join(' · ')
}
