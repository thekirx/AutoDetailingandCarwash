/** Optional sellable sizes. Empty means one catalog price. Labels are free text (12 oz, M, XL).
 * Stock is relational: product_branch_stock.size_key (lowercased label, or '' when unsized).
 */

const MAX_SIZES = 12

/** Stable stock key for a size label. Unsized products use ''. */
export function productSizeKey(label) {
  return String(label || '').trim().toLowerCase()
}

export function productSizeRows(product) {
  const raw = product?.size_options
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => ({
      label: String(row?.label || '').trim(),
      price_minor: Math.floor(Number(row?.price_minor) || 0),
      size_key: productSizeKey(row?.label),
    }))
    .filter((row) => row.label)
}

/** Stock keys to manage for a product at a branch: [''] or ['m','xl',…]. */
export function productStockSizeKeys(product) {
  const rows = productSizeRows(product)
  if (!rows.length) return ['']
  return rows.map((row) => row.size_key)
}

export function findBranchSizeStock(stockRows, branchSlug, sizeKey = '') {
  const key = productSizeKey(sizeKey)
  return (stockRows || []).find(
    (row) => row?.branch_slug === branchSlug && productSizeKey(row?.size_key) === key,
  ) || null
}

export function branchAssignedForProduct(stockRows, branchSlug) {
  return (stockRows || []).some((row) => row?.branch_slug === branchSlug)
}

/** Form rows { label, price } in pesos. Blank rows are dropped. Half-filled rows throw. */
export function normalizeProductSizeOptions(rows) {
  const list = Array.isArray(rows) ? rows : []
  const out = []
  const seen = new Set()
  for (const row of list) {
    const label = String(row?.label || '').trim()
    const priceText = String(row?.price ?? '').trim()
    if (!label && !priceText) continue
    if (!label || !priceText) throw new Error('Each size needs a name and a price, or leave the row blank.')
    if (label.length > 24) throw new Error('Size names stay under 24 characters.')
    const pesos = Number(priceText)
    if (!Number.isFinite(pesos) || pesos < 0) throw new Error(`Price for ${label} must be a number.`)
    const key = label.toLowerCase()
    if (seen.has(key)) throw new Error(`Size “${label}” is listed twice.`)
    seen.add(key)
    out.push({ label, price_minor: Math.round(pesos * 100) })
  }
  if (out.length > MAX_SIZES) throw new Error(`Use at most ${MAX_SIZES} sizes.`)
  return out
}

export function sizeDraftFromOptions(options) {
  return productSizeRows({ size_options: options }).map((row) => ({
    label: row.label,
    price: String(row.price_minor / 100),
  }))
}

export function productSizePriceMinor(product, label) {
  const name = String(label || '').trim().toLowerCase()
  if (!name) return null
  const hit = productSizeRows(product).find((row) => row.label.toLowerCase() === name)
  return hit ? hit.price_minor : null
}
