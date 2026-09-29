import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  REVIEW_DELAY_MS,
  latestFinishedVisit,
  latestReviewableVisit,
  reviewDelayRemainingMs,
} from '../src/lib/visitReviewDelay.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const hour = 60 * 60 * 1000

describe('rate last visit after one hour', () => {
  const now = new Date('2026-09-28T10:00:00.000Z').getTime()

  it('hides the card until an hour after the last line in the visit finishes', () => {
    const history = [
      {
        id: 'wash',
        visit_group_id: 'v1',
        status: 'completed',
        for_payment_at: new Date(now - hour + 60_000).toISOString(),
        completed_at: new Date(now - 30 * 60_000).toISOString(),
      },
      {
        id: 'older',
        status: 'completed',
        completed_at: new Date(now - 3 * hour).toISOString(),
      },
    ]
    assert.equal(latestReviewableVisit(history, now), null)
    assert.equal(latestFinishedVisit(history).id, 'wash')
    assert.ok(reviewDelayRemainingMs(history, now) > 0)
    assert.equal(reviewDelayRemainingMs(history, now) <= 60_000, true)
  })

  it('shows the visit once the hour has passed, and waits while a sibling is still open', () => {
    const ready = [
      {
        id: 'done',
        visit_group_id: 'v2',
        status: 'completed',
        for_payment_at: new Date(now - REVIEW_DELAY_MS - 1000).toISOString(),
      },
    ]
    assert.equal(latestReviewableVisit(ready, now).id, 'done')
    assert.equal(reviewDelayRemainingMs(ready, now), null)

    const openSibling = [
      ...ready,
      { id: 'still', visit_group_id: 'v2', status: 'in_progress' },
    ]
    assert.equal(latestReviewableVisit(openSibling, now), null)
    assert.equal(latestFinishedVisit(openSibling), null)
  })
})

describe('failed QA and visit stamps are wired', () => {
  it('detailing can be marked failed QA and stamps are once per visit', () => {
    const editor = readFileSync(join(root, 'src/components/QueueTicketEditor.jsx'), 'utf8')
    assert.match(editor, /const showFailedQa = canMarkFailedQa\(profile\)/)
    assert.doesNotMatch(editor, /ticketKind !== 'detailing'/)
    const kpi = readFileSync(join(root, 'src/pages/KpiPage.jsx'), 'utf8')
    assert.match(kpi, /failedQaInRange/)
    assert.match(kpi, /finishedForAverage/)
    const migration = readFileSync(join(root, 'supabase/migrations/20260929090000_visit_stamp.sql'), 'utf8')
    assert.match(migration, /award_visit_stamp/)
    assert.match(migration, /loyalty_stamps = c\.loyalty_stamps \+ 1/)
  })
})
