/**
 * Inventory categories, POS visibility, and coffee material roles.
 *
 * Categories:
 * - Merchandise: Shows on POS to choose and sell. Branch admin restocks -> Super Admin approves.
 * - Coffee Menu: Shows on POS to sell. Tied to Coffee Materials (deducts 1 cup and 20g beans).
 * - Coffee Materials: Hidden from customer & POS. Deducts 1 cup and 20g beans per coffee sale.
 * - Chemicals Inventory: Hidden from customer & POS. Used for internal operations (Sunday recon).
 */

export const STOCK_CATEGORIES = Object.freeze([
  { id: 'merchandise', label: 'Merchandise', pos: true, customer: true, description: 'Shows up on POS to choose from to sell' },
  { id: 'coffee_menu', label: 'Coffee Menu', pos: true, customer: true, description: 'Shows up on POS to sell. Deducts 1 cup and 20g beans from Coffee Materials' },
  { id: 'coffee_material', label: 'Coffee Materials', pos: false, customer: false, description: 'Does not show to customer or POS. Material counts for cups and beans' },
  { id: 'chemical', label: 'Chemicals Inventory', pos: false, customer: false, description: 'Does not show to customer or POS. Internal chemicals tracked on Sunday recon' },
])

export const MATERIAL_ROLES = Object.freeze([
  { id: 'cup', label: 'Cup (1 cup per drink)' },
  { id: 'beans', label: 'Beans (20g per drink)' },
])

export function materialRoleLabel(role) {
  if (!role) return null
  return MATERIAL_ROLES.find((r) => r.id === role)?.label || role
}

export function stockCategoryLabel(id) {
  if (id === 'coffee_drinks') return 'Coffee Menu'
  const match = STOCK_CATEGORIES.find((row) => row.id === id)
  return match?.label || 'Merchandise'
}

export function stockCategoryHidesFromPos(id) {
  return id === 'coffee_material' || id === 'chemical'
}

/**
 * Policy notice: restocks update on-hand counts only.
 * Bulk chemical and product purchase costs are recorded manually in Finance.
 */
export const RESTOCK_POLICY_NOTICE =
  'Adding or approving restock updates physical on-hand inventory counts only and does not create an expense. All bulk chemical orders and inventory purchasing costs are handled manually in Finance under Operating Expenses → Chemical and Other Inventory.'

export const LOW_STOCK_THRESHOLD = 5

export function computeProductTotalOnHand(stockRows = []) {
  return (stockRows || []).reduce((acc, r) => acc + Math.max(0, Number(r?.qty) || 0), 0)
}

export function evaluateStockStatus(qty, threshold = LOW_STOCK_THRESHOLD) {
  const num = Math.max(0, Number(qty) || 0)
  if (num <= 0) return { status: 'out_of_stock', label: 'Out of Stock (Reorder Needed)', badgeVariant: 'destructive' }
  if (num <= threshold) return { status: 'low_stock', label: 'Low Stock (Order Soon)', badgeVariant: 'warning' }
  return { status: 'in_stock', label: 'In Stock', badgeVariant: 'success' }
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
