/**
 * Car-size pricing: Small / Medium / Large / Extra Large.
 * services.price_minor remains the Medium (compat) catalog price.
 */

export const PRICING_SIZE_SLUGS = ['small', 'medium', 'large', 'extra_large']

export const PRICING_SIZES = [
  { slug: 'small', label: 'Small' },
  { slug: 'medium', label: 'Medium' },
  { slug: 'large', label: 'Large' },
  { slug: 'extra_large', label: 'Extra Large' },
]

/** Map legacy body-style slugs → pricing tier for price lookup. */
const LEGACY_TO_PRICING = {
  sedan: 'medium',
  motorcycle: 'small',
  pickup: 'large',
  van: 'extra_large',
  suv: 'large',
  other: 'medium',
}

export function normalizePricingSize(sizeSlug) {
  const raw = String(sizeSlug || '').trim().toLowerCase().replace(/\s+/g, '_')
  if (PRICING_SIZE_SLUGS.includes(raw)) return raw
  if (LEGACY_TO_PRICING[raw]) return LEGACY_TO_PRICING[raw]
  return 'medium'
}

/** Attach nested service_size_prices rows as { small: n, … }. */
export function sizePricesMap(service) {
  if (!service) return {}
  if (service.size_prices && !Array.isArray(service.size_prices) && typeof service.size_prices === 'object') {
    return service.size_prices
  }
  const rows = service.service_size_prices || service.size_price_rows || []
  const out = {}
  for (const row of rows) {
    if (row?.size_slug != null && row.price_minor != null) {
      out[row.size_slug] = Number(row.price_minor) || 0
    }
  }
  return out
}

export function resolveServicePriceMinor(service, sizeSlug) {
  const map = sizePricesMap(service)
  const hasSized = Object.keys(map).length > 0
  if (!hasSized) return Number(service?.price_minor) || 0
  const slug = normalizePricingSize(sizeSlug)
  if (map[slug] != null && Number.isFinite(Number(map[slug]))) return Number(map[slug])
  if (map.medium != null && Number.isFinite(Number(map.medium))) return Number(map.medium)
  const first = PRICING_SIZE_SLUGS.map((s) => map[s]).find((n) => n != null && Number.isFinite(Number(n)))
  if (first != null) return Number(first)
  return Number(service?.price_minor) || 0
}

/** True when catalog row has optional per-size prices (not flat-only). */
export function serviceHasSizePricing(service) {
  const map = sizePricesMap(service)
  const vals = Object.values(map).map(Number).filter((n) => Number.isFinite(n))
  return vals.length > 0
}

/** Sizes that have an explicit price for this service (for multi-select / POS pickers). */
export function availablePricingSizes(service) {
  const map = sizePricesMap(service)
  return PRICING_SIZES.filter((sz) => map[sz.slug] != null && Number.isFinite(Number(map[sz.slug])))
}

/** Compact display e.g. "₱500–₱900" or single price if flat. */
export function formatSizePriceRange(service, formatMoney) {
  const map = sizePricesMap(service)
  const vals = PRICING_SIZE_SLUGS.map((s) => map[s]).filter((n) => n != null && Number.isFinite(Number(n))).map(Number)
  if (!vals.length) return formatMoney(service?.price_minor || 0)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  if (min === max) return formatMoney(min)
  return `${formatMoney(min)}–${formatMoney(max)}`
}

export function emptySizePriceForm(pesos = '') {
  return { small: pesos, medium: pesos, large: pesos, extra_large: pesos }
}

export function sizePricesFromService(service) {
  const map = sizePricesMap(service)
  const out = emptySizePriceForm('')
  if (!Object.keys(map).length) return out
  for (const slug of PRICING_SIZE_SLUGS) {
    out[slug] = map[slug] != null ? String(Number(map[slug]) / 100) : ''
  }
  return out
}
