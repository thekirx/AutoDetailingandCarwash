import { branchOnHand, filterOperationalBranches } from './inventoryBranchStock.js'
import { productSizeKey, productStockSizeKeys } from './productSizes.js'

export const PICKUP_MASK = 'HK-••••'
export const pickupPath = (id) => `/account/pickup/${encodeURIComponent(id)}`
/** Staff may type the code with or without "HK-", spaces or a dash: HK-1A2B3C4D, hk 1a2b3c4d, 1A2B3C4D. */
export function normalizePickupCode(code) {
  const raw = String(code || '').toUpperCase().replace(/[\s-]/g, '')
  const body = raw.startsWith('HK') ? raw.slice(2) : raw
  return /^[A-F0-9]{8}$/.test(body) ? `HK-${body}` : String(code || '').trim().toUpperCase()
}
export function shopItems(items = []) {
  return items.filter((p) => p.show_in_app && p.is_active !== false && !p.is_archived && p.usage_kind !== 'internal' && Number(p.points_price) > 0)
}
export function claimState(item, branch, size, points, busy = false) {
  const key = productSizeKey(size)
  const cost = Number(item?.points_price) || 0
  const validSize = productStockSizeKeys(item).includes(key)
  const stock = branchOnHand(item?.product_branch_stock, branch, key) || 0
  const left = Number(points || 0) - cost
  return { stock, left, canClaim: Boolean(item && branch && validSize && stock > 0 && cost > 0 && left >= 0 && !busy) }
}

/** Total claimable stock of an item at a specific branch (summing valid sizes or unsized row). */
export function branchProductStockCount(item, branchSlug) {
  if (!item || !branchSlug) return 0
  const keys = productStockSizeKeys(item)
  let total = 0
  for (const key of keys) {
    total += branchOnHand(item.product_branch_stock, branchSlug, key) || 0
  }
  return total
}

/** Open operational branches (excluding `excludeBranchSlug`) that currently have >0 stock of `item`. */
export function otherBranchesInStock(item, excludeBranchSlug, branches = []) {
  return filterOperationalBranches(branches).filter(
    (b) => b.slug !== excludeBranchSlug && branchProductStockCount(item, b.slug) > 0,
  )
}
export function pickupDaysLeft(expiresAt, now = new Date()) {
  const delta = new Date(expiresAt).getTime() - new Date(now).getTime()
  return Number.isFinite(delta) ? Math.max(0, Math.ceil(delta / 86400000)) : 0
}
export function pickupCodeMatches(row, { id, branch, code }, now = new Date()) {
  return Boolean(row && row.id === id && row.branch_slug === branch && row.status === 'pending'
    && new Date(row.expires_at) > now && row.pickup_code && row.pickup_code === normalizePickupCode(code))
}
export function pickupDate(value) {
  return value ? new Date(value).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }) : '—'
}

/** Approved mock placeholders, visibly labelled; admins replace these with real Hakum uploads. */
export function merchPhoto(item) {
  if (item?.photo_url) return item.photo_url
  const name = String(item?.name || '').toLowerCase()
  const key = /shirt/.test(name) ? 'tee' : /key/.test(name) ? 'key' : /fresh|scent/.test(name) ? 'fresh' : null
  return key ? `/merch/placeholder-${key}.svg` : '/branding/hakum-mark-ow.png'
}
