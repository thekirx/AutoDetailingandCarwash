/** Client-side loyalty progress — mirrors customer stamp card logic. */

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
    encouragement = `You are ${remaining} ${remaining === 1 ? 'point' : 'points'} away from ${nextMilestone.reward_label}!`
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
