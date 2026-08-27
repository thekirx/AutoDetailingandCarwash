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
