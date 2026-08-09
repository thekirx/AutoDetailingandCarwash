/** Branch Admin POS may only add tagged sellables onto an open job / walk-in cart. */

export const POS_SELLABLE_TAGS = [
  'coffee',
  'free_coffee',
  'free_service',
  'accessories',
  'scents',
  'merch',
  'sellable',
]

export function productIsPosSellable(product) {
  const tags = Array.isArray(product?.tags) ? product.tags : []
  if (!tags.length) {
    // Legacy rows without tags: treat merch/general category as sellable
    const cat = String(product?.category || '').toLowerCase()
    return !cat || cat === 'merch' || cat === 'general' || cat === 'coffee' || cat === 'accessories'
  }
  return tags.some((t) => POS_SELLABLE_TAGS.includes(String(t).toLowerCase()))
}

/** Bucket paid sale lines for POS dashboard boxes. */
export function classifySaleBucket({ serviceSlug, payCategory, itemType, serviceName } = {}) {
  const slug = String(serviceSlug || '').toLowerCase()
  const name = String(serviceName || '').toLowerCase()
  const cat = String(payCategory || '').toLowerCase()
  if (slug.includes('ceramic-coating') || name.includes('ceramic coating')) return 'ceramic_coating'
  if (slug.includes('nano-ceramic') || name.includes('nano ceramic') || name.includes('tint')) return 'nano_tint'
  if (slug.includes('paint-protection') || slug.includes('ppf') || name.includes('ppf')) return 'ppf'
  if (cat === 'detailing') return 'ceramic_coating'
  if (itemType === 'product') return 'sellables'
  return 'car_wash'
}

export function emptyPosCategoryTotals() {
  return {
    car_wash: 0,
    ceramic_coating: 0,
    nano_tint: 0,
    ppf: 0,
    sellables: 0,
  }
}

export function accumulatePosCategoryTotals(rows = []) {
  const out = emptyPosCategoryTotals()
  for (const row of rows) {
    const bucket = classifySaleBucket(row)
    const amount = Number(row.total_minor || row.line_total_minor || 0)
    if (!Number.isFinite(amount)) continue
    if (out[bucket] == null) out[bucket] = 0
    out[bucket] += amount
  }
  return out
}
