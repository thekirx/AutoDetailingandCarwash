/**
 * Visit rewards, member tier, and the points table from the 25 Oct notes.
 * Showing this does not change a service row's saved points_award.
 */

export const VISIT_REWARDS = Object.freeze([
  { visit: 6, label: 'Free car freshener' },
  { visit: 12, label: 'Free coffee' },
  { visit: 18, label: 'Free premium car wash' },
  { visit: 24, label: 'Free back-to-zero add-on' },
  { visit: 30, label: '15% off tint, ceramic coating, or PPF (choose one)' },
])

export const SERVICE_POINTS = Object.freeze([
  { name: 'Premium car wash', points: 1 },
  { name: 'Express', points: 2 },
  { name: 'Basic', points: 3 },
  { name: 'Deluxe', points: 4 },
  { name: 'Paint Maintenance', points: 5 },
  { name: 'Paint Refresh', points: 5 },
  { name: 'Glass cleaning', points: 3 },
  { name: 'Headlight Restore', points: 3 },
  { name: 'Black trims restore', points: 3 },
  { name: 'Glass detailing', points: 5 },
  { name: 'Glass coating', points: 5 },
  { name: 'Classic ceramic coating', points: 15 },
  { name: 'Premium ceramic', points: 20 },
  { name: 'Platinum ceramic', points: 25 },
  { name: 'Nano Ceramic Tint', points: 10 },
  { name: 'Nano Ceramic Pro Tint', points: 15 },
  { name: 'Nano Ceramic Pro Black Series Tint', points: 20 },
  { name: 'Interior Detailing', points: 10 },
  { name: 'Interior Deep Cleaning', points: 5 },
  { name: 'High Impact Partial PPF', points: 30 },
  { name: 'Basic PPF', points: 40 },
  { name: 'Ultimate PPF', points: 50 },
  { name: 'Platinum PPF', points: 60 },
])

export const MERCH_POINTS = Object.freeze([
  { name: 'Hakum Shirt', points: 50 },
  { name: 'Clear Pro mug', points: 30 },
  { name: 'Clear Pro Yellow Bag', points: 30 },
  { name: 'Clear Pro Coffee Kit', points: 60 },
  { name: 'Hakum Key Chain', points: 20 },
  { name: 'Hakum Car Care Kit', points: 50 },
  { name: 'Fusso coat spray', points: 50 },
  { name: 'Luxury gloss spray', points: 50 },
  { name: 'Hakum car scent', points: 30 },
  { name: 'Air Spencer', points: 30 },
])

export const MEMBER_TIERS = Object.freeze([
  {
    slug: 'basic',
    name: 'Hakum Basic Member',
    visits: '1–29 visits',
    badge: 'Basic',
    min_visits: 1,
    max_visits: 29,
    discount_percent: 0,
    loyalty_multiplier: 1.0,
    description: 'Welcome tier for all Hakum drivers. Accumulate visit stamps and points on every service.',
  },
  {
    slug: 'deluxe',
    name: 'Hakum Deluxe Member',
    visits: '30–69 visits',
    badge: 'Deluxe',
    min_visits: 30,
    max_visits: 69,
    discount_percent: 5,
    loyalty_multiplier: 1.2,
    description: 'Dedicated regular care status with milestone visit rewards and priority seasonal offers.',
  },
  {
    slug: 'premium',
    name: 'Hakum Premium Member',
    visits: '70–99 visits',
    badge: 'Premium',
    min_visits: 70,
    max_visits: 99,
    discount_percent: 10,
    loyalty_multiplier: 1.5,
    description: 'Enthusiast tier with elevated loyalty rewards, priority bay queueing, and anniversary perks.',
  },
  {
    slug: 'platinum',
    name: 'Hakum Platinum Member',
    visits: '100+ visits',
    badge: 'Platinum',
    min_visits: 100,
    max_visits: null,
    discount_percent: 15,
    loyalty_multiplier: 2.0,
    description: 'Elite network tier with VIP privileges, exclusive merchandise access, and maximum rewards.',
  },
])

export function memberTier(visits, customTiers = null) {
  const n = Math.max(0, Math.floor(Number(visits) || 0))
  if (Array.isArray(customTiers) && customTiers.length > 0) {
    const active = customTiers
      .filter((t) => t && t.is_active !== false)
      .sort((a, b) => (Number(b.min_visits) || 0) - (Number(a.min_visits) || 0))
    for (const t of active) {
      const min = Number(t.min_visits) || 0
      const max = t.max_visits != null && t.max_visits !== '' ? Number(t.max_visits) : Infinity
      if (n >= min && n <= max) {
        return {
          id: t.id,
          name: t.name,
          badge: t.name.replace(/Hakum\s*|\s*Member/gi, '').trim() || t.name,
          visits: n,
          min_visits: min,
          max_visits: t.max_visits,
          discount_percent: Number(t.discount_percent) || 0,
          loyalty_multiplier: Number(t.loyalty_multiplier) || 1,
          benefits: t.benefits || [],
          included_services: t.included_services || [],
        }
      }
    }
    if (active.length > 0) {
      const lowest = active[active.length - 1]
      return {
        id: lowest.id,
        name: lowest.name,
        badge: lowest.name.replace(/Hakum\s*|\s*Member/gi, '').trim() || lowest.name,
        visits: n,
        min_visits: Number(lowest.min_visits) || 0,
        max_visits: lowest.max_visits,
        discount_percent: Number(lowest.discount_percent) || 0,
        loyalty_multiplier: Number(lowest.loyalty_multiplier) || 1,
        benefits: lowest.benefits || [],
        included_services: lowest.included_services || [],
      }
    }
  }

  if (n >= 100) return { name: 'Hakum Platinum Member', badge: 'Platinum', visits: n, min_visits: 100, max_visits: null, discount_percent: 15, loyalty_multiplier: 2.0 }
  if (n >= 70) return { name: 'Hakum Premium Member', badge: 'Premium', visits: n, min_visits: 70, max_visits: 99, discount_percent: 10, loyalty_multiplier: 1.5 }
  if (n >= 30) return { name: 'Hakum Deluxe Member', badge: 'Deluxe', visits: n, min_visits: 30, max_visits: 69, discount_percent: 5, loyalty_multiplier: 1.2 }
  return { name: 'Hakum Basic Member', badge: 'Basic', visits: n, min_visits: 1, max_visits: 29, discount_percent: 0, loyalty_multiplier: 1.0 }
}

/** Next unpaid visit reward, counting every completed visit on any car. */
export function nextVisitReward(visits) {
  const n = Math.max(0, Math.floor(Number(visits) || 0))
  const next = VISIT_REWARDS.find((row) => row.visit > n)
  if (!next) return null
  return { ...next, visitsAway: next.visit - n }
}

export function earnedVisitRewards(visits) {
  const n = Math.max(0, Math.floor(Number(visits) || 0))
  return VISIT_REWARDS.filter((row) => n >= row.visit)
}

export function latestEarnedVisitReward(visits) {
  const rows = earnedVisitRewards(visits)
  return rows.length ? rows[rows.length - 1] : null
}
