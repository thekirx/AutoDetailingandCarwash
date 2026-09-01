/**
 * Owner Revisions P2 — detailing completion, Experience cards, photo notify, calendar colors.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertDetailingCompletionOutcome,
  bookingCalendarEventPropGetter,
  bookingCalendarStyle,
  bookingUpdateObjectPath,
  buildExperiencePlanCardPayload,
  EXPERIENCE_LIST_TITLE,
  shouldCreateExperiencePlanCard,
} from '../src/lib/detailingCompletion.js'
import { EXPERIENCE_LIST_TITLE as PLANNER_EXPERIENCE } from '../src/lib/plannerBoard.js'
import { DETAILING_BOARD_STATUSES } from '../src/lib/detailingBoardStatuses.js'
import { getBookingPrimaryNextStatus } from '../src/queue/queueLogic.js'
import { buildBookingNotifyPayload } from '../server/notifyBooking.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const detailingBooking = {
  id: 'b-det',
  vehicle_plate: 'ABC1234',
  branch: 'bacoor',
  customer_name: 'Ana',
  customer_phone: '09171234567',
  services: { name: 'Ceramic Coating', slug: 'ceramic-coating', pay_category: 'detailing' },
}

describe('detailing completion outcome gate', () => {
  it('blocks completing detailing without outcome', () => {
    const blocked = assertDetailingCompletionOutcome(detailingBooking, null, { nextStatus: 'completed' })
    assert.equal(blocked.ok, false)
    assert.match(blocked.error, /outcome/i)

    const ok = assertDetailingCompletionOutcome(detailingBooking, 'no_issues', { nextStatus: 'completed' })
    assert.equal(ok.ok, true)
    assert.equal(ok.outcome, 'no_issues')

    const wash = assertDetailingCompletionOutcome(
      { services: { pay_category: 'wash', slug: 'premium-car-wash' } },
      null,
      { nextStatus: 'completed' },
    )
    assert.equal(wash.ok, true)
  })
})

describe('Experience plan card for outcomes 2–3', () => {
  it('builds payload for complaints_addressed / unhappy and skips no_issues', () => {
    assert.equal(shouldCreateExperiencePlanCard('no_issues'), false)
    assert.equal(shouldCreateExperiencePlanCard('complaints_addressed'), true)
    assert.equal(shouldCreateExperiencePlanCard('unhappy'), true)
    assert.equal(EXPERIENCE_LIST_TITLE, PLANNER_EXPERIENCE)
    assert.equal(EXPERIENCE_LIST_TITLE, 'Experience')

    const card = buildExperiencePlanCardPayload({
      booking: detailingBooking,
      outcome: 'unhappy',
      listId: 'list-exp',
      position: 2,
    })
    assert.equal(card.list_id, 'list-exp')
    assert.match(card.title, /Experience/)
    assert.match(card.title, /ABC1234/)
    assert.match(card.description, /not happy|unhappy|Investigation/i)
  })

  it('server bookingStatus inserts Experience card (source scan)', () => {
    const src = read('server/bookingStatus.mjs')
    assert.match(src, /shouldCreateExperiencePlanCard/)
    assert.match(src, /EXPERIENCE_LIST_TITLE|insertExperienceInvestigation/)
    assert.match(src, /plan_cards/)
    assert.match(src, /operations_lead/)
  })
})

describe('progress photo notify seam', () => {
  it('photos_ready STATUS_COPY builds customer SMS + push payload', () => {
    const payload = buildBookingNotifyPayload(
      {
        id: 'b1',
        customer_phone: '09171234567',
        customer_id: 'c1',
        customer_name: 'Ana',
        branch: 'bacoor',
        vehicle_plate: 'ABC1234',
      },
      'photos_ready',
    )
    assert.equal(payload.kind, 'booking_photos')
    assert.match(payload.sms, /photos ready|app/i)
    assert.equal(payload.url, '/account')
    assert.match(read('server/notifyBooking.mjs'), /notifyBookingPhotosReady/)
    assert.equal(bookingUpdateObjectPath('b1', 'Bay shot.jpg', 1700000000000), 'b1/1700000000000-Bay_shot.jpg')
  })
})

describe('calendar colors + for_releasing stays separate', () => {
  it('eventPropGetter colors by pay_category / slug', () => {
    const ceramic = bookingCalendarStyle({ services: { slug: 'ceramic-coating', pay_category: 'detailing' } })
    const tint = bookingCalendarStyle({ services: { slug: 'nano-ceramic-tint', pay_category: 'detailing' } })
    const ppf = bookingCalendarStyle({ services: { slug: 'paint-protection-film', pay_category: 'ppf' } })
    assert.notEqual(ceramic.backgroundColor, tint.backgroundColor)
    assert.notEqual(tint.backgroundColor, ppf.backgroundColor)
    const getter = bookingCalendarEventPropGetter({
      resource: { services: { slug: 'ceramic-coating', pay_category: 'detailing' }, branch: 'bacoor' },
    })
    assert.ok(getter.style?.backgroundColor)
  })

  it('does not collapse for_releasing into for_payment', () => {
    const ids = DETAILING_BOARD_STATUSES.map((s) => s.id)
    assert.ok(ids.includes('for_releasing'))
    assert.ok(ids.includes('for_payment'))
    assert.equal(ids.indexOf('for_releasing') < ids.indexOf('for_payment'), true)
    assert.equal(
      getBookingPrimaryNextStatus('final_checking', { detailingPipeline: true }),
      'for_releasing',
    )
    assert.equal(
      getBookingPrimaryNextStatus('for_releasing', { detailingPipeline: true }),
      'for_payment',
    )
  })
})

describe('P2 migration', () => {
  it('adds completion_outcome + booking-updates bucket + Experience list', () => {
    const sql = read('supabase/migrations/20260827130000_detailing_completion_outcome.sql')
    assert.match(sql, /completion_outcome/)
    assert.match(sql, /no_issues/)
    assert.match(sql, /complaints_addressed/)
    assert.match(sql, /unhappy/)
    assert.match(sql, /booking-updates/)
    assert.match(sql, /Experience/)
  })
})
