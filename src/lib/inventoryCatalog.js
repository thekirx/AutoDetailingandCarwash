/** Stock categories. A coffee drink is its own item. Coffee stock is a count, not a recipe. */

export const STOCK_CATEGORIES = Object.freeze([
  { id: 'merchandise', label: 'Merchandise', pos: true },
  { id: 'coffee_menu', label: 'Coffee drinks', pos: true },
  { id: 'coffee_material', label: 'Coffee stock', pos: false },
  { id: 'chemical', label: 'Chemicals', pos: false },
])

export function stockCategoryLabel(id) {
  return STOCK_CATEGORIES.find((row) => row.id === id)?.label || 'Merchandise'
}

export function stockCategoryHidesFromPos(id) {
  return id === 'coffee_material' || id === 'chemical'
}

export function productShowsOnPos(product) {
  if (stockCategoryHidesFromPos(product?.stock_category)) return false
  if (product?.show_in_pos === false) return false
  if (Number(product?.points_price) > 0 && !(Number(product?.price_minor) > 0)) return false
  const kind = String(product?.usage_kind || '').toLowerCase()
  if (kind === 'internal') return false
  if (kind === 'resellable') return true
  const tags = Array.isArray(product?.tags) ? product.tags : []
  if (!tags.length) {
    const cat = String(product?.category || '').toLowerCase()
    return !cat || cat === 'merch' || cat === 'general' || cat === 'coffee' || cat === 'accessories' || cat === 'clothing'
  }
  return tags.some((tag) =>
    ['coffee', 'free_coffee', 'free_service', 'accessories', 'scents', 'merch', 'sellable', 'clothing', 'apparel'].includes(
      String(tag).toLowerCase(),
    ),
  )
}
