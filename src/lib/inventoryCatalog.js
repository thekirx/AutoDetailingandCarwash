/** Stock categories from the 25 Oct notes. Restock adds a count. It does not post a cost. */

export const STOCK_CATEGORIES = Object.freeze([
  { id: 'merchandise', label: 'Merchandise', pos: true },
  { id: 'coffee_menu', label: 'Coffee menu', pos: true },
  { id: 'coffee_material', label: 'Coffee materials', pos: false },
  { id: 'chemical', label: 'Chemicals', pos: false },
])

export const COFFEE_BEAN_GRAMS = 20

export function stockCategoryLabel(id) {
  return STOCK_CATEGORIES.find((row) => row.id === id)?.label || 'Merchandise'
}

export function stockCategoryHidesFromPos(id) {
  return id === 'coffee_material' || id === 'chemical'
}

/** One coffee sale uses one cup and 20 grams of beans. */
export function coffeeRecipeDeduction(qty) {
  const n = Math.max(0, Math.floor(Number(qty) || 0))
  return { cups: n, beanGrams: n * COFFEE_BEAN_GRAMS }
}

export function productShowsOnPos(product) {
  if (stockCategoryHidesFromPos(product?.stock_category)) return false
  if (product?.show_in_pos === false) return false
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
