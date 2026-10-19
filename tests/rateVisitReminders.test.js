import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { REVIEW_DELAY_MS } from '../src/lib/visitReviewDelay.js'
import { rateVisitEligible } from '../server/rateVisitReminders.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const min = 60 * 1000

describe('rate visit SMS after 15 minutes (Michi C20)', () => {
  it('waits REVIEW_DELAY_MS then stops after the 6h window', () => {
    assert.equal(REVIEW_DELAY_MS, 15 * min)
    const now = Date.parse('2026-10-19T12:00:00.000Z')
    assert.equal(rateVisitEligible({ finishedAtMs: now - 14 * min, nowMs: now }), false)
    assert.equal(rateVisitEligible({ finishedAtMs: now - 15 * min, nowMs: now }), true)
    assert.equal(rateVisitEligible({ finishedAtMs: now - 7 * 60 * min, nowMs: now }), false)
  })

  it('hooks booking-reminders cron and lifecycle.rate_visit template', () => {
    const api = readFileSync(join(root, 'server/bookingRemindersApi.mjs'), 'utf8')
    const life = readFileSync(join(root, 'server/lifecycleSms.mjs'), 'utf8')
    const templates = readFileSync(join(root, 'src/lib/notificationTemplates.js'), 'utf8')
    assert.match(api, /runRateVisitReminders/)
    assert.match(life, /rate_visit/)
    assert.match(templates, /lifecycle\.rate_visit/)
  })
})
