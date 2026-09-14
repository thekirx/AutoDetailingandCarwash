/** Shared vehicle_catalog helpers (Super Admin CRUD + book/floor pickers). */

import { inferPhPricingSize } from './phVehicleSizes.js'

export function normalizeCatalogPair(make, model) {
  return { make: String(make || '').trim(), model: String(model || '').trim() }
}

/** Build make → models[] map from active vehicle_catalog rows (Stable Super Admin source). */
export function catalogRowsToMap(rows) {
  const map = {}
  for (const row of rows || []) {
    const make = String(row.make || '').trim()
    const model = String(row.model || '').trim()
    if (!make || !model) continue
    if (!map[make]) map[make] = []
    if (!map[make].includes(model)) map[make].push(model)
  }
  return map
}

/** make|model → size_slug for auto-select on the floor / book forms. */
export function catalogRowsToSizeIndex(rows) {
  const index = new Map()
  for (const row of rows || []) {
    const make = String(row.make || '').trim()
    const model = String(row.model || '').trim()
    if (!make || !model) continue
    const size = String(row.size_slug || '').trim() || inferPhPricingSize(make, model)
    index.set(`${make.toLowerCase()}|${model.toLowerCase()}`, size)
  }
  return index
}

export function catalogSizeFor(index, make, model) {
  if (!index) return inferPhPricingSize(make, model)
  const key = `${String(make || '').trim().toLowerCase()}|${String(model || '').trim().toLowerCase()}`
  return index.get(key) || inferPhPricingSize(make, model)
}

export function catalogMakes(map) {
  return Object.keys(map || {}).sort((a, b) => a.localeCompare(b))
}

/** Case-insensitive resolve to the catalog’s canonical make spelling. */
export function resolveCatalogMake(map, make) {
  const q = String(make || '').trim().toLowerCase()
  if (!q || !map) return null
  return catalogMakes(map).find((m) => m.toLowerCase() === q) || null
}

export function modelsForCatalogMake(map, make) {
  const key = resolveCatalogMake(map, make)
  return key ? map[key] || [] : []
}

export function filterCatalogMakes(map, query, limit = 40) {
  const makes = catalogMakes(map)
  const q = String(query || '').trim().toLowerCase()
  const list = q ? makes.filter((m) => m.toLowerCase().includes(q)) : makes
  return list.slice(0, limit)
}

export function filterCatalogModels(map, make, query, limit = 40) {
  const models = modelsForCatalogMake(map, make)
  const q = String(query || '').trim().toLowerCase()
  const list = q ? models.filter((m) => m.toLowerCase().includes(q)) : models
  return list.slice(0, limit)
}
