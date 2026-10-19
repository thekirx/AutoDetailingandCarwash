/** Branch stock + Sunday recon helpers (Owner Revisions P4). */

/** Prefer usage_kind; fall back to tag/category sellable heuristics. */
export function productIsResellable(product) {
  const kind = String(product?.usage_kind || '').toLowerCase()
  if (kind === 'internal') return false
  if (kind === 'resellable') return true
  return null
}

/** usage = previous − leftover (chemical burn for the week). */
export function reconUsageQty(previousQty, leftoverQty) {
  const prev = Math.max(0, Number(previousQty) || 0)
  const left = Math.max(0, Number(leftoverQty) || 0)
  return prev - left
}

/**
 * SA approve: stock becomes leftover; movement delta = leftover − previous.
 * Returns { nextQty, delta, usageQty }.
 */
export function applyReconLine({ previousQty, leftoverQty }) {
  const prev = Math.max(0, Number(previousQty) || 0)
  const left = Math.max(0, Number(leftoverQty) || 0)
  return {
    nextQty: left,
    delta: left - prev,
    usageQty: prev - left,
  }
}

/** Restock: add delta (>= 1) onto current branch qty. */
export function applyRestockQty(currentQty, addQty) {
  const cur = Math.max(0, Number(currentQty) || 0)
  const add = Math.max(0, Number(addQty) || 0)
  return cur + add
}

/** Owner/SA absolute set. */
export function applyOwnerSetQty(nextQty) {
  return Math.max(0, Number(nextQty) || 0)
}

/** On-hand at one branch. Null means the sellable is not assigned there. */
export function branchOnHand(stockRows, branchSlug) {
  const row = (stockRows || []).find((item) => item?.branch_slug === branchSlug)
  if (!row) return null
  return Math.max(0, Number(row.qty) || 0)
}

/** A sellable is at a branch only when product_branch_stock has a row, including qty 0. */
export function isAssignedToBranch(stockByProduct, productId) {
  return stockByProduct != null && Object.prototype.hasOwnProperty.call(stockByProduct, productId)
}

/**
 * Branch assignment list. Internal-use products stay on Sunday recon.
 * filter: assigned | unassigned | accessories | sellables
 */
export function branchAssignmentRows(products = [], stockByProduct = {}, filter = 'assigned') {
  const sellable = (products || []).filter((row) => productIsResellable(row) !== false)
  return sellable
    .filter((row) => {
      const assigned = isAssignedToBranch(stockByProduct, row.id)
      const accessory = String(row.category || '').toLowerCase() === 'accessories'
      if (filter === 'unassigned') return !assigned
      if (filter === 'accessories') return accessory
      if (filter === 'sellables') return assigned && !accessory
      return assigned
    })
    .map((row) => ({
      ...row,
      assigned: isAssignedToBranch(stockByProduct, row.id),
      on_hand: isAssignedToBranch(stockByProduct, row.id) ? Number(stockByProduct[row.id]) || 0 : null,
    }))
}
