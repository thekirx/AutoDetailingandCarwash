/** Shared vehicle_catalog helpers (Super Admin CRUD + TL picker). */

export function normalizeCatalogPair(make, model) {
  return { make: String(make || '').trim(), model: String(model || '').trim() }
}
