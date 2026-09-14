/** Completed-visit ratings: overall, app, services/packages, detailing. */

export const VISIT_REVIEW_AXES = [
  { id: 'overall', field: 'overall_rating', label: 'Overall', customerLabel: 'Customer experience' },
  { id: 'app', field: 'app_rating', label: 'App', customerLabel: 'App experience' },
  { id: 'service', field: 'service_rating', label: 'Services / packages' },
  { id: 'detailing', field: 'detailing_rating', label: 'Detailing' },
]

export function visitReviewAxesForKind(kind) {
  const floor = String(kind || '') === 'detailing' ? 'detailing' : 'service'
  return VISIT_REVIEW_AXES.filter((axis) => axis.id === 'overall' || axis.id === 'app' || axis.id === floor)
}

export function starScore(value) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1 || n > 5) return null
  return n
}

export function buildCompletedVisitReview(scores = {}, comment = '', { kind } = {}) {
  const overall = starScore(scores.overall)
  const app = starScore(scores.app)
  const service = starScore(scores.service)
  const detailing = starScore(scores.detailing)
  const note = String(comment || '').trim() || null
  if (!overall || !app) return null
  if (kind === 'detailing') {
    if (!detailing) return null
    return { overall_rating: overall, app_rating: app, service_rating: null, detailing_rating: detailing, comment: note }
  }
  if (kind === 'service' || kind === 'package') {
    if (!service) return null
    return { overall_rating: overall, app_rating: app, service_rating: service, detailing_rating: null, comment: note }
  }
  if (!service || !detailing) return null
  return {
    overall_rating: overall,
    app_rating: app,
    service_rating: service,
    detailing_rating: detailing,
    comment: note,
  }
}
