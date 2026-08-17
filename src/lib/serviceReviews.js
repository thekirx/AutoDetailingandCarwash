/** Completed-visit ratings: overall, app, services/packages, detailing. */

export const VISIT_REVIEW_AXES = [
  { id: 'overall', field: 'overall_rating', label: 'Overall' },
  { id: 'app', field: 'app_rating', label: 'App' },
  { id: 'service', field: 'service_rating', label: 'Services / packages' },
  { id: 'detailing', field: 'detailing_rating', label: 'Detailing' },
]

export function starScore(value) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1 || n > 5) return null
  return n
}

export function buildCompletedVisitReview(scores = {}, comment = '') {
  const overall = starScore(scores.overall)
  const app = starScore(scores.app)
  const service = starScore(scores.service)
  const detailing = starScore(scores.detailing)
  if (!overall || !app || !service || !detailing) return null
  return {
    overall_rating: overall,
    app_rating: app,
    service_rating: service,
    detailing_rating: detailing,
    comment: String(comment || '').trim() || null,
  }
}
