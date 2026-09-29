/**
 * Visit points. Defaults match the shop card; Super Admin can override points_award per service.
 * 1 carwash · 2 express package · 3 tint · 3 other detailing · 5 ceramic · 10 PPF
 */

export function defaultPointsAward({ slug = '', name = '', pay_category = '' } = {}) {
  const hay = `${slug} ${name}`.toLowerCase()
  const cat = String(pay_category || '').toLowerCase()
  if (/ppf|paint-protection|paint protection/.test(hay)) return 10
  if (/tint/.test(hay)) return 3
  if (/ceramic/.test(hay)) return 5
  if (/express/.test(hay)) return 2
  if (cat === 'wash' || /carwash|car-wash|car wash/.test(hay)) return 1
  if (cat === 'detailing') return 3
  return 0
}

export function pointsLabel(points) {
  const n = Math.max(0, Math.floor(Number(points) || 0))
  return n === 1 ? '1 point' : `${n} points`
}
