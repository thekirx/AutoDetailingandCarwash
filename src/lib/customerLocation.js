import { nearestBranchSlug } from './branchGeo.js'
import { filterOperationalBranches } from './inventoryBranchStock.js'

export const CUSTOMER_PIN_KEY = 'hakum-customer-pin'
export const CUSTOMER_BRANCH_KEY = 'hakum-customer-branch'

export function formatDistanceKm(km) {
  const n = Number(km)
  if (!Number.isFinite(n) || n < 0) return ''
  if (n < 1) return `${Math.max(1, Math.round(n * 1000))} m`
  return `${n.toFixed(n < 10 ? 1 : 0)} km`
}

export function loadCustomerPin() {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(CUSTOMER_PIN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const lat = Number(parsed?.lat)
    const lng = Number(parsed?.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
    return { lat, lng }
  } catch {
    return null
  }
}

export function saveCustomerPin(pin) {
  const lat = Number(pin?.lat)
  const lng = Number(pin?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  const next = { lat, lng }
  localStorage.setItem(CUSTOMER_PIN_KEY, JSON.stringify(next))
  return next
}

/**
 * A branch in the URL is an explicit choice. Otherwise the saved pin picks the
 * nearest open branch. With neither, the first bookable branch is the fallback.
 */
export function resolveCustomerQueueBranch({ wanted = '', pin = null, branches = [] } = {}) {
  const list = (branches || []).filter((row) => row?.slug && row.coming_soon !== true && row.is_active !== false)
  const explicit = String(wanted || '').trim()
  if (explicit && list.some((row) => row.slug === explicit)) {
    return { slug: explicit, source: 'choice' }
  }
  if (pin) {
    const nearest = nearestBranchSlug(pin, list)
    if (nearest?.slug) {
      return { slug: nearest.slug, source: 'nearest', distanceKm: nearest.distanceKm }
    }
  }
  return { slug: list[0]?.slug || '', source: 'default' }
}

export function loadCustomerBranch() {
  try {
    if (typeof localStorage === 'undefined') return ''
    return String(localStorage.getItem(CUSTOMER_BRANCH_KEY) || '').trim()
  } catch {
    return ''
  }
}

export function saveCustomerBranch(slug) {
  const next = String(slug || '').trim()
  try {
    if (typeof localStorage === 'undefined') return next
    if (next) localStorage.setItem(CUSTOMER_BRANCH_KEY, next)
    else localStorage.removeItem(CUSTOMER_BRANCH_KEY)
  } catch {
    /* ignore quota */
  }
  return next
}

/**
 * Unified customer branch resolver across Home, Queue, Book, and Points Shop.
 * Priority: explicit URL `wanted` > saved manual `savedSlug` > nearest open branch from `pin` > first open branch.
 */
export function resolveCustomerBranchChoice({ wanted = '', savedSlug = '', pin = null, branches = [] } = {}) {
  const list = filterOperationalBranches(branches)
  const nearest = pin ? nearestBranchSlug(pin, list) : null
  const explicit = String(wanted || '').trim()
  if (explicit && list.some((row) => row.slug === explicit)) {
    return {
      slug: explicit,
      source: 'url',
      nearestSlug: nearest?.slug || '',
      nearestDistanceKm: nearest?.distanceKm ?? null,
    }
  }
  const saved = String(savedSlug || '').trim()
  if (saved && list.some((row) => row.slug === saved)) {
    return {
      slug: saved,
      source: 'saved',
      nearestSlug: nearest?.slug || '',
      nearestDistanceKm: nearest?.distanceKm ?? null,
    }
  }
  if (nearest?.slug) {
    return {
      slug: nearest.slug,
      source: 'nearest',
      nearestSlug: nearest.slug,
      nearestDistanceKm: nearest.distanceKm,
    }
  }
  return {
    slug: list[0]?.slug || '',
    source: 'default',
    nearestSlug: '',
    nearestDistanceKm: null,
  }
}
