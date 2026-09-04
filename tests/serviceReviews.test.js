import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { buildCompletedVisitReview, VISIT_REVIEW_AXES } from '../src/lib/serviceReviews.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('completed visit review payload', () => {
  it('requires overall, app, services, and detailing scores', () => {
    assert.equal(VISIT_REVIEW_AXES.length, 4)
    assert.deepEqual(
      buildCompletedVisitReview({ overall: 5, app: 4, service: 5, detailing: 3 }, '  great wash  '),
      {
        overall_rating: 5,
        app_rating: 4,
        service_rating: 5,
        detailing_rating: 3,
        comment: 'great wash',
      },
    )
    assert.equal(buildCompletedVisitReview({ overall: 5, app: 4, service: 5 }, ''), null)
    assert.equal(buildCompletedVisitReview({ overall: 0, app: 4, service: 5, detailing: 3 }, ''), null)
  })

  it('wires four axes on customer home and ops reviews', () => {
    const home = read('src/pages/CustomerAccountPage.jsx')
    const reviews = read('src/pages/ReviewsPage.jsx')
    const css = read('src/styles-customer-app.css')
    const portal = read('server/customerPortal.mjs')
    const garage = read('src/pages/CustomerMorePage.jsx')
    assert.match(home, /buildCompletedVisitReview/)
    assert.match(home, /VISIT_REVIEW_AXES/)
    assert.match(reviews, /VISIT_REVIEW_AXES/)
    assert.match(reviews, /app_rating/)
    assert.match(css, /\.capp-rate-stars/)
    assert.match(css, /min-width: 44px/)
    assert.match(portal, /isValidCustomerPlate/)
    assert.match(portal, /safeVehiclePhotoUrl/)
    assert.match(garage, /isValidCustomerPlate/)
    assert.match(garage, /safeVehiclePhotoUrl/)
  })
})
