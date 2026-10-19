/** Optional sellable sizes. Empty means one catalog price. Labels are free text (12 oz, M, XL). */

const MAX_SIZES = 12

export function productSizeRows(product) {
  const raw = product?.size_options
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => ({
      label: String(row?.label || '').trim(),
      price_minor: Math.floor(Number(row?.price_minor) || 0),
    }))
    .filter((row) => row.label)
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
