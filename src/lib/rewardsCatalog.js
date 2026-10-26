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
  { name: 'Classic ceramic', points: 15 },
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

export function memberTier(visits) {
  const n = Math.max(0, Math.floor(Number(visits) || 0))
  if (n >= 100) return { name: 'Hakum Platinum Member', visits: n }
  if (n >= 70) return { name: 'Hakum Premium Member', visits: n }
  if (n >= 30) return { name: 'Hakum Deluxe Member', visits: n }
  return { name: 'Hakum Basic Member', visits: n }
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
