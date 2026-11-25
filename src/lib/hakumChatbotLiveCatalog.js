import { supabase } from './supabase.js'
import { fetchPublicBranches } from './branches.js'
import { fetchPortal } from './customerPortalClient.js'

const CACHE_TTL_MS = 60 * 1000

let cachedCatalog = null
let cachedAt = 0
let inFlightPromise = null

function normalizeLiveBranch(row) {
  return {
    slug: row.slug,
    name: row.name,
    address: row.address || '',
    comingSoon: Boolean(row.coming_soon),
    isActive: row.is_active !== false,
    hours: Array.isArray(row.hours) ? row.hours : [],
  }
}

export function clearChatbotCatalogCache() {
  cachedCatalog = null
  cachedAt = 0
  inFlightPromise = null
}

/**
 * Loads live public Hakum catalog data cleanly with soft failure handling so
 * deterministic answers stay fast even if one RPC/view is unreachable.
 */
export async function fetchChatbotLiveCatalog({ force = false } = {}) {
  const now = Date.now()
  if (!force && cachedCatalog && now - cachedAt < CACHE_TTL_MS) {
    return cachedCatalog
  }
  if (!force && inFlightPromise) return inFlightPromise

  inFlightPromise = (async () => {
    const [branchesRes, servicesRes, shopRes, queueRes, loyaltySettingsRes, milestonesRes, tiersRes] =
      await Promise.allSettled([
        fetchPublicBranches({ mode: 'visible' }),
        supabase
          .from('services')
          .select(
            'id, name, slug, description, pay_category, price_minor, points_award, duration_minutes, display_order, service_size_prices(size_slug, price_minor)',
          )
          .eq('is_active', true)
          .eq('is_archived', false)
          .order('display_order'),
        supabase.rpc('get_public_shop_catalog'),
        supabase.rpc('get_public_queue_counts'),
        supabase
          .from('loyalty_program_settings')
          .select('stamps_enabled, points_enabled, card_slots, completion_reward_label')
          .eq('id', 1)
          .maybeSingle(),
        supabase
          .from('loyalty_milestones')
          .select('threshold_points, reward_label, is_active')
          .eq('is_active', true)
          .order('threshold_points'),
        supabase
          .from('membership_tiers')
          .select('slug, name, min_visits, discount_percent, loyalty_multiplier, description, is_active')
          .eq('is_active', true)
          .order('min_visits'),
      ])

    const branches =
      branchesRes.status === 'fulfilled' && Array.isArray(branchesRes.value)
        ? branchesRes.value.map(normalizeLiveBranch)
        : []

    const services =
      servicesRes.status === 'fulfilled' && !servicesRes.value.error && Array.isArray(servicesRes.value.data)
        ? servicesRes.value.data
        : []

    const shopItems =
      shopRes.status === 'fulfilled' && !shopRes.value.error && Array.isArray(shopRes.value.data)
        ? shopRes.value.data
        : []

    const queueCounts =
      queueRes.status === 'fulfilled' && !queueRes.value.error && Array.isArray(queueRes.value.data)
        ? queueRes.value.data
        : []

    const loyaltySettings =
      loyaltySettingsRes.status === 'fulfilled' && !loyaltySettingsRes.value.error
        ? loyaltySettingsRes.value.data || null
        : null

    const milestones =
      milestonesRes.status === 'fulfilled' && !milestonesRes.value.error && Array.isArray(milestonesRes.value.data)
        ? milestonesRes.value.data
        : []

    const membershipTiers =
      tiersRes.status === 'fulfilled' && !tiersRes.value.error && Array.isArray(tiersRes.value.data)
        ? tiersRes.value.data
        : []

    const result = {
      fetchedAt: Date.now(),
      branches,
      services,
      shopItems,
      queueCounts,
      loyaltySettings,
      milestones,
      membershipTiers,
    }
    cachedCatalog = result
    cachedAt = Date.now()
    inFlightPromise = null
    return result
  })()

  return inFlightPromise
}

/**
 * Fetches live signed-in customer portal summary ONLY when the active session is
 * verified as `profile.role === 'customer'`. Never exposes data across sessions.
 */
export async function fetchChatbotCustomerSummary({ isCustomer = false } = {}) {
  if (!isCustomer) return null
  try {
    const portal = await fetchPortal()
    return portal || null
  } catch {
    return null
  }
}
