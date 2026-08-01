/** Client-side loyalty progress + earn rules (mirrors award_loyalty_stamps / POS points). */

export const STAMP_EARN_MODES = ['all_weighted', 'pay_categories']

export const LOYALTY_PAY_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'detailing', label: 'Detailing' },
  { value: 'wash', label: 'Wash (carwash)' },
  { value: 'ppf', label: 'PPF / Film' },
  { value: 'addon', label: 'Add-on' },
]

export function buildLoyaltyProgress(stamps = 0, milestones = [], cardSlots = 15) {
  const slots = Math.max(Number(cardSlots) || 15, 1)
  const completed = Math.min(Math.max(Math.floor(Number(stamps) || 0), 0), slots)
  const progress = Math.round((completed / slots) * 100)

  const activeMilestones = [...(milestones || [])]
    .filter((m) => m.is_active !== false)
    .sort((a, b) => Number(a.threshold_points) - Number(b.threshold_points))

  const nextMilestone = activeMilestones.find((m) => completed < Number(m.threshold_points)) || null
  const earnedMilestones = activeMilestones.filter((m) => completed >= Number(m.threshold_points))

  let encouragement = 'Your next reward is ready!'
  if (nextMilestone) {
    const remaining = Number(nextMilestone.threshold_points) - completed
    encouragement = `You are ${remaining} ${remaining === 1 ? 'stamp' : 'stamps'} away from ${nextMilestone.reward_label}!`
  } else if (completed < slots) {
    encouragement = `${slots - completed} more to fill your stamp card.`
  }

  return {
    cardSlots: slots,
    completed,
    progress,
    milestones: activeMilestones,
    earnedMilestones,
    nextMilestone,
    encouragement,
  }
}

/** Pure stamp delta — same gates as public.award_loyalty_stamps. */
export function computeStampDelta({
  stampsEnabled = true,
  stampEarnMode = 'all_weighted',
  stampPayCategories = ['wash'],
  serviceWeight = 1,
  servicePayCategory = 'general',
  quantity = 1,
  applyMembershipMultiplierToStamps = false,
  membershipsEnabled = true,
  membershipMultiplier = 1,
  isLoyaltyAward = false,
} = {}) {
  if (!stampsEnabled || isLoyaltyAward) return 0
  const weight = Math.floor(Number(serviceWeight) || 0)
  if (weight <= 0) return 0

  if (stampEarnMode === 'pay_categories') {
    const allowed = Array.isArray(stampPayCategories) ? stampPayCategories : []
    if (!allowed.includes(String(servicePayCategory || ''))) return 0
  }

  let delta = weight * Math.max(Math.floor(Number(quantity) || 1), 1)
  if (applyMembershipMultiplierToStamps && membershipsEnabled) {
    const mult = Number(membershipMultiplier)
    delta = Math.max(Math.floor(delta * (Number.isFinite(mult) ? mult : 1)), 0)
  }
  return delta
}

/** Pure points delta — same formula as complete_pos_sale service_total branch. */
export function computePointsDelta({
  pointsEnabled = true,
  serviceTotalMinor = 0,
  membershipsEnabled = true,
  membershipMultiplier = 1,
} = {}) {
  if (!pointsEnabled) return 0
  const total = Math.floor(Number(serviceTotalMinor) || 0)
  if (total <= 0) return 0
  const mult =
    membershipsEnabled && Number.isFinite(Number(membershipMultiplier))
      ? Number(membershipMultiplier)
      : 1
  return Math.max(Math.floor((total / 100) * mult), 0)
}

/** After award, optional wrap at card capacity (mirrors SQL wrap_stamps_at_card). */
export function applyStampWrap(stamps, cardSlots, wrapEnabled) {
  const s = Math.max(Math.floor(Number(stamps) || 0), 0)
  const slots = Math.max(Math.floor(Number(cardSlots) || 0), 0)
  if (!wrapEnabled || slots <= 0 || s < slots) return s
  return s % slots
}
