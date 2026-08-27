/**
 * QA seam: NewRevisions FIFO/dwell need lane timestamps on the board contract.
 * Red → green: select + migration must expose waiting_at / for_payment_at.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { averageDwellByStatus, fifoNextTicketId } from '../src/queue/queueLogic.js'
import { bookingCalendarEventPropGetter } from '../src/lib/detailingCompletion.js'
import { resolveEffectiveRole } from '../src/lib/ownerRevisionsPhase7.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

describe('QA: queue board lane timestamps (FIFO + dwell)', () => {
  it('QUEUE_BOARD_SELECT requests waiting_at and for_payment_at', () => {
    const src = read('src/queue/queueApi.js')
    const m = src.match(/export const QUEUE_BOARD_SELECT = `([\s\S]*?)`/)
    assert.ok(m, 'QUEUE_BOARD_SELECT export')
    assert.match(m[1], /\bwaiting_at\b/)
    assert.match(m[1], /\bfor_payment_at\b/)
  })

  it('TeamLead history select also requests waiting_at', () => {
    const src = read('src/pages/TeamLeadQueuePage.jsx')
    assert.match(src, /QUEUE_BOARD_SELECT_MIN[\s\S]*waiting_at/)
  })

  it('latest queue board migration exposes waiting_at and for_payment_at', () => {
    const sql = read('supabase/migrations/20260827160000_queue_board_lane_timestamps.sql')
    assert.match(sql, /b\.waiting_at/)
    assert.match(sql, /b\.for_payment_at/)
    assert.match(sql, /operations_queue_board/)
  })

  it('FIFO prefers waiting_at over created_at when both present', () => {
    assert.equal(
      fifoNextTicketId([
        {
          booking_id: 'old-created',
          status: 'waiting',
          created_at: '2026-08-27T08:00:00+08:00',
          waiting_at: '2026-08-27T11:00:00+08:00',
        },
        {
          booking_id: 'redo-waiting',
          status: 'waiting',
          created_at: '2026-08-27T10:00:00+08:00',
          waiting_at: '2026-08-27T09:00:00+08:00',
        },
      ]),
      'redo-waiting',
    )
  })

  it('for_payment dwell uses for_payment_at (not created_at)', () => {
    const now = new Date('2026-08-27T12:00:00+08:00').getTime()
    const avg = averageDwellByStatus(
      [
        {
          status: 'for_payment',
          created_at: '2026-08-27T08:00:00+08:00',
          for_payment_at: '2026-08-27T11:50:00+08:00',
        },
      ],
      now,
    )
    assert.equal(avg.for_payment, 10)
  })
})

describe('QA: detailing calendar colors visible', () => {
  it('eventPropGetter returns distinct background by pay_category', () => {
    const tint = bookingCalendarEventPropGetter({
      resource: { pay_category: 'tint', branch: 'bacoor' },
    })
    const wash = bookingCalendarEventPropGetter({
      resource: { pay_category: 'wash', branch: 'batangas' },
    })
    assert.ok(tint?.style?.backgroundColor)
    assert.ok(wash?.style?.backgroundColor)
    assert.notEqual(tint.style.backgroundColor, wash.style.backgroundColor)
  })

  it('planning-calendar CSS does not force event background with !important', () => {
    const css = read('src/styles.css')
    const blocks = [...css.matchAll(/\.planning-calendar \.rbc-event\s*\{[^}]+\}/g)].map((m) => m[0])
    assert.ok(blocks.length >= 1, 'expected .planning-calendar .rbc-event rules')
    for (const block of blocks) {
      assert.doesNotMatch(block, /background:\s*[^;]+!\s*important/)
      assert.doesNotMatch(block, /color:\s*[^;]+!\s*important/)
    }
  })

  it('BookingBoard calendar wrapper does not force Tailwind bg-primary on events', () => {
    const src = read('src/pages/BookingBoardPage.jsx')
    assert.doesNotMatch(src, /\[&_\.rbc-event\]:bg-primary/)
    assert.doesNotMatch(src, /\[&_\.rbc-event\]:text-primary-foreground/)
    assert.match(src, /eventPropGetter=\{bookingCalendarEventPropGetter\}/)
  })
})

describe('QA: temp TL multi-branch branch stamp', () => {
  it('resolveEffectiveRole returns team_lead for override on matching day', () => {
    const role = resolveEffectiveRole(
      { id: 's1', role: 'staff', branch_slug: 'bacoor' },
      [{ staff_id: 's1', role: 'team_lead', branch_slug: 'bacoor', on_date: '2026-08-27' }],
      '2026-08-27',
    )
    assert.equal(role, 'team_lead')
  })
})
