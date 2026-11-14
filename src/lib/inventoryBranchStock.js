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

/** On-hand at one branch (+ optional size_key). Null means no stock row for that key. */
export function branchOnHand(stockRows, branchSlug, sizeKey = '') {
  const key = String(sizeKey || '').trim().toLowerCase()
  const row = (stockRows || []).find(
    (item) => item?.branch_slug === branchSlug && String(item?.size_key || '').trim().toLowerCase() === key,
  )
  if (!row) return null
  return Math.max(0, Number(row.qty) || 0)
}

/** True when any size (or unsized) row exists for the branch. */
export function branchHasStockRow(stockRows, branchSlug) {
  return (stockRows || []).some((item) => item?.branch_slug === branchSlug)
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

const TEST_RESIDUE_BRANCH_RE = /^(crudtest|aud-|probe-)/i

/**
 * Filter branch rows down to open, operational store branches (e.g. bacoor, batangas).
 * Excludes archived, inactive, coming_soon, test residue, and (unless includeBackOffice=true) non-public/HQ rows.
 */
export function filterOperationalBranches(branches = [], { includeBackOffice = false } = {}) {
  return (branches || []).filter((b) => {
    if (!b || !b.slug) return false
    const slug = String(b.slug).trim().toLowerCase()
    if (!slug || TEST_RESIDUE_BRANCH_RE.test(slug)) return false
    if (b.is_archived === true) return false
    if (b.is_active === false) return false
    if (b.coming_soon === true) return false
    if (!includeBackOffice && (b.is_public === false || slug === 'hq')) return false
    return true
  })
}

/**
 * Filter raw product_branch_stock rows so ghost stock on archived/coming-soon/test/HQ branches
 * never inflates "All Branches" totals or branch breakdowns.
 */
export function filterOperationalStockRows(stockRows = [], operationalBranchesOrSlugs = null) {
  let allowedSet = null
  if (Array.isArray(operationalBranchesOrSlugs)) {
    const slugs = operationalBranchesOrSlugs
      .map((item) => (typeof item === 'string' ? item : item?.slug))
      .map((s) => String(s || '').trim().toLowerCase())
      .filter(Boolean)
    allowedSet = new Set(slugs)
  } else if (operationalBranchesOrSlugs instanceof Set) {
    allowedSet = new Set([...operationalBranchesOrSlugs].map((s) => String(s || '').trim().toLowerCase()))
  }

  return (stockRows || []).filter((row) => {
    const slug = String(row?.branch_slug || '').trim().toLowerCase()
    if (!slug || TEST_RESIDUE_BRANCH_RE.test(slug) || slug === 'hq') return false
    if (allowedSet) return allowedSet.has(slug)
    return true
  })
}

/**
 * Aggregate stock rows at a single branch across size_key values so multi-size products
 * sum accurately rather than being overwritten by the last row.
 */
export function aggregateBranchStockMap(stockRows = []) {
  const totalsByProductId = {}
  const unsizedByProductId = {}
  const sizedRowsByProductId = {}

  for (const row of stockRows || []) {
    const pid = row?.product_id
    if (!pid) continue
    const qty = Math.max(0, Number(row?.qty) || 0)
    const sizeKey = String(row?.size_key || '').trim().toLowerCase()
    totalsByProductId[pid] = (totalsByProductId[pid] ?? 0) + qty
    if (!sizeKey) {
      unsizedByProductId[pid] = qty
    } else {
      if (!sizedRowsByProductId[pid]) sizedRowsByProductId[pid] = []
      sizedRowsByProductId[pid].push({ ...row, size_key: sizeKey, qty })
    }
  }

  return {
    totalsByProductId,
    unsizedByProductId,
    sizedRowsByProductId,
  }
}

/**
 * Count pending restock requests scoped to the active branch filter ('all' or a branch slug)
 * and the user's allowed operational branch slugs.
 */
export function countPendingRestocksForScope(requests = [], branchScope = 'all', allowedSlugs = null) {
  const scopeSlug = String(branchScope || 'all').trim().toLowerCase()
  const allowedSet = Array.isArray(allowedSlugs)
    ? new Set(allowedSlugs.map((s) => String(s || '').trim().toLowerCase()).filter(Boolean))
    : null

  let count = 0
  for (const req of requests || []) {
    if (!req || (req.status && req.status !== 'pending')) continue
    const bSlug = String(req.branch_slug || '').trim().toLowerCase()
    if (!bSlug || TEST_RESIDUE_BRANCH_RE.test(bSlug) || bSlug === 'hq') continue
    if (allowedSet && !allowedSet.has(bSlug)) continue
    if (scopeSlug !== 'all' && bSlug !== scopeSlug) continue
    count += 1
  }
  return count
}

/**
 * Build batched stock upserts and stock movements for a Sunday Recon approval.
 * Eliminates the 3*N sequential query loop by computing a single upsert batch and movement batch.
 */
export function buildReconApprovalMutations(lines = [], currentUnsizedStockMap = {}, { branchSlug, userId } = {}) {
  const bSlug = String(branchSlug || '').trim()
  const stockUpserts = []
  const movements = []

  for (const line of lines || []) {
    if (!line?.product_id || !bSlug) continue
    const cur = isAssignedToBranch(currentUnsizedStockMap, line.product_id)
      ? Number(currentUnsizedStockMap[line.product_id]) || 0
      : Number(line.previous_qty) || 0
    const { nextQty, delta } = applyReconLine({
      previousQty: cur,
      leftoverQty: line.leftover_qty,
    })
    stockUpserts.push({
      product_id: line.product_id,
      branch_slug: bSlug,
      size_key: '',
      qty: nextQty,
    })
    movements.push({
      product_id: line.product_id,
      branch_slug: bSlug,
      size_key: '',
      delta,
      reason: 'recon_adjust',
      movement_type: 'recon_adjust',
      created_by: userId || null,
    })
  }

  return { stockUpserts, movements }
}

