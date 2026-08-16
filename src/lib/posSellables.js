/** Branch Admin POS may only add tagged sellables onto an open job / walk-in cart. */

export const POS_SELLABLE_TAGS = [
  'coffee',
  'free_coffee',
  'free_service',
  'accessories',
  'scents',
  'merch',
  'sellable',
  'clothing',
  'apparel',
]

const PRODUCT_BUCKETS = new Set(['coffee', 'accessories', 'clothing', 'merch'])

export function productIsPosSellable(product) {
  const tags = Array.isArray(product?.tags) ? product.tags : []
  if (!tags.length) {
    // Legacy rows without tags: treat merch/general category as sellable
    const cat = String(product?.category || '').toLowerCase()
    return !cat || cat === 'merch' || cat === 'general' || cat === 'coffee' || cat === 'accessories' || cat === 'clothing'
  }
  return tags.some((t) => POS_SELLABLE_TAGS.includes(String(t).toLowerCase()))
}

export const MERCH_FAMILIES = [
  { id: 'all', label: 'All merch' },
  { id: 'coffee', label: 'Coffee / refreshments' },
  { id: 'accessories', label: 'Accessories' },
  { id: 'clothing', label: 'Hakum clothing' },
  { id: 'merch', label: 'Other sellables' },
]

export function merchFamily(product) {
  const tags = (Array.isArray(product?.tags) ? product.tags : []).map((t) => String(t).toLowerCase())
  const cat = String(product?.category || '').toLowerCase()
  const name = String(product?.name || '').toLowerCase()
  const hay = `${tags.join(' ')} ${cat} ${name}`
  if (/\b(coffee|refresh|drink|beverage)/.test(hay)) return 'coffee'
  if (/\b(clothing|apparel|shirt|wear)/.test(hay)) return 'clothing'
  if (/\b(accessor|scent|freshener)/.test(hay)) return 'accessories'
  return 'merch'
}

export function productMatchesMerchFamily(product, familyId) {
  if (!familyId || familyId === 'all') return true
  return merchFamily(product) === familyId
}

/** Bucket paid sale lines for POS dashboard boxes. */
export function classifySaleBucket({
  serviceSlug,
  payCategory,
  itemType,
  serviceName,
  productTags,
  productCategory,
  productName,
} = {}) {
  const slug = String(serviceSlug || '').toLowerCase()
  const name = String(serviceName || '').toLowerCase()
  const cat = String(payCategory || '').toLowerCase()
  if (slug.includes('ceramic-coating') || name.includes('ceramic coating')) return 'ceramic_coating'
  if (slug.includes('nano-ceramic') || name.includes('nano ceramic') || name.includes('tint')) return 'nano_tint'
  if (slug.includes('paint-protection') || slug.includes('ppf') || name.includes('ppf')) return 'ppf'
  if (cat === 'detailing') return 'ceramic_coating'
  if (itemType === 'product') {
    return merchFamily({
      tags: productTags,
      category: productCategory,
      name: productName || serviceName,
    })
  }
  return 'car_wash'
}

export function emptyPosCategoryTotals() {
  return {
    car_wash: 0,
    ceramic_coating: 0,
    nano_tint: 0,
    ppf: 0,
    coffee: 0,
    accessories: 0,
    clothing: 0,
    merch: 0,
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
    if (PRODUCT_BUCKETS.has(bucket)) out.sellables += amount
  }
  return out
}

export function posBucketToBacoor(bucket) {
  if (bucket === 'car_wash') return 'carwash'
  if (bucket === 'ceramic_coating') return 'coating'
  if (bucket === 'nano_tint') return 'tint'
  if (bucket === 'ppf') return 'ppf'
  if (bucket === 'coffee') return 'refreshment'
  if (bucket === 'clothing') return 'clothing'
  return 'accessories'
}

export function paidSalesToBacoorRows(sales = []) {
  const rows = []
  for (const sale of sales) {
    const lines = sale.sale_line_items || []
    if (!lines.length) {
      rows.push({
        status: sale.status || 'paid',
        total_minor: sale.total_minor,
        payment_method: sale.payment_method,
        booking_id: sale.booking_id,
        bucket: posBucketToBacoor(
          classifySaleBucket({ itemType: sale.booking_id ? 'service' : 'product' }),
        ),
      })
      continue
    }
    for (const line of lines) {
      rows.push({
        status: sale.status || 'paid',
        total_minor: line.line_total_minor,
        payment_method: sale.payment_method,
        booking_id: sale.booking_id,
        bucket: posBucketToBacoor(
          classifySaleBucket({
            itemType: line.item_type,
            serviceSlug: line.services?.slug,
            serviceName: line.services?.name,
            payCategory: line.services?.pay_category,
            productTags: line.products?.tags,
            productCategory: line.products?.category,
            productName: line.products?.name || line.name,
          }),
        ),
      })
    }
  }
  return rows
}
