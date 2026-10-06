/**
 * notify-ops-event copy: right words per event, amounts in pesos, stable tags, and a known event list.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { OPS_EVENTS, buildOpsEventCopy, notifyOpsEvent } from '../server/notifyOpsEvent.mjs'
import { NOTIFY_EVENTS, branchLabel } from '../src/lib/notifyRouting.js'

describe('buildOpsEventCopy', () => {
  it('every ops event has a routing rule', () => {
    for (const e of OPS_EVENTS) assert.ok(NOTIFY_EVENTS[e], e)
  })

  it('crew_assigned names the car, service and branch', () => {
    const c = buildOpsEventCopy('crew_assigned', { bookingId: 'b1', plate: 'ABC123', service: 'Wash', branchName: 'Bacoor', queueNumber: 7 })
    assert.equal(c.title, 'New car assigned')
    assert.equal(c.body, 'Q7 · ABC123 · Wash @ Bacoor')
    assert.equal(c.tag, 'crew-b1')
  })

  it('sheet_submitted tells approvers who, which day, net and drawer gap', () => {
    const c = buildOpsEventCopy('sheet_submitted', { sheetId: 's1', branchName: 'Bacoor', businessDate: '2026-10-01', submitter: 'Ana', netProfitMinor: 1250000, overShortMinor: -20000 })
    assert.equal(c.title, 'Daily sheet to approve · Bacoor')
    assert.equal(c.body, 'Ana submitted 2026-10-01 · net ₱12,500 · drawer short ₱200. Approve or return in Finance.')
    assert.equal(c.tag, 'sheet-submitted-s1')
    assert.doesNotMatch(buildOpsEventCopy('sheet_submitted', { overShortMinor: 0 }).body, /drawer/)
  })

  it('sheet_reviewed: approved says release pay, returned carries the note', () => {
    const yes = buildOpsEventCopy('sheet_reviewed', { sheetId: 's1', approved: true, branchName: 'Bacoor', businessDate: '2026-10-01' })
    const no = buildOpsEventCopy('sheet_reviewed', { sheetId: 's1', approved: false, note: 'Missing GCash receipt', branchName: 'Bacoor', businessDate: '2026-10-01' })
    assert.equal(yes.title, 'Daily sheet approved · Bacoor')
    assert.match(yes.body, /release pay/)
    assert.equal(no.title, 'Daily sheet returned · Bacoor')
    assert.match(no.body, /Missing GCash receipt/)
    assert.ok(NOTIFY_EVENTS.sheet_reviewed.roles.includes('admin'))
    assert.equal(NOTIFY_EVENTS.sheet_submitted.grant, 'finance_view')
  })

  it('payroll and end-of-shift events are retired with those pages', () => {
    for (const e of ['shift_submitted', 'shift_accepted', 'shift_rejected']) assert.equal(buildOpsEventCopy(e, {}), null, e)
    assert.equal(OPS_EVENTS.includes('payroll_confirmed'), false)
    assert.equal(OPS_EVENTS.includes('cash_advance_resolved'), false)
    assert.equal(NOTIFY_EVENTS.payroll_confirmed, undefined)
    assert.equal(NOTIFY_EVENTS.cash_advance_resolved, undefined)
  })

  it('cash advance request shows pesos and sends the BA to the Daily Sheet', () => {
    const req = buildOpsEventCopy('cash_advance_submitted', { submissionId: 's1', employee: 'Ben', amountMinor: 150000, branchName: 'Bacoor' })
    assert.equal(req.body, "Ben · ₱1,500 @ Bacoor. Release it on today's Daily Sheet.")
    assert.equal(req.tag, 'ca-req-s1')
  })

  it('public inquiry: complaint vs partnership wording', () => {
    const complaint = buildOpsEventCopy('inquiry', { id: 'i1', kind: 'complaint', name: 'Ana', category: 'Damage', branch: 'bacoor' })
    assert.equal(complaint.title, 'New customer complaint')
    assert.equal(complaint.body, 'Ana · Damage @ bacoor')
    assert.equal(complaint.tag, 'inquiry-i1')
    const collab = buildOpsEventCopy('inquiry', { id: 'i2', kind: 'partnership', name: 'Lot Co', city: 'Imus' })
    assert.equal(collab.title, 'New partnership inquiry')
    assert.equal(collab.body, 'Lot Co · Imus')
  })

  it('review shows stars, customer, branch and a short comment', () => {
    const r = buildOpsEventCopy('review', { id: 'r1', rating: 2, name: 'Ben', branchName: 'Bacoor', comment: 'x'.repeat(200) })
    assert.equal(r.title, 'New review · 2★')
    assert.match(r.body, /^Ben @ Bacoor — "x{80}…"$/)
    assert.equal(buildOpsEventCopy('review', { id: 'r2', rating: 5, name: 'C', branchName: 'Bacoor' }).body, 'C @ Bacoor')
  })

  it('branch label drops the brand prefix, falls back to the slug', () => {
    assert.equal(branchLabel('Hakum Auto Care Bacoor', 'bacoor'), 'Bacoor')
    assert.equal(branchLabel('Hakum HQ / Office', 'hq'), 'HQ / Office')
    assert.equal(branchLabel(null, 'bacoor'), 'bacoor')
    assert.equal(branchLabel('Hakum Auto Care', 'x'), 'x')
  })

  it('unknown event → null', () => {
    assert.equal(buildOpsEventCopy('nope', {}), null)
  })

  it('blocked geo time-in names the person and branch; SA / ASA / BA land on Attendance', () => {
    const c = buildOpsEventCopy('attendance_location_alert', { alertId: 'a1', staff: 'Ben', branchName: 'Bacoor' })
    assert.equal(c.title, 'Time-in blocked · Bacoor')
    assert.match(c.body, /^Ben tried to time in with a faked or tampered location/)
    assert.equal(c.tag, 'geo-alert-a1')
    assert.deepEqual(NOTIFY_EVENTS.attendance_location_alert.roles, ['BossMich', 'assistant_super_admin', 'admin'])
  })
})

/** Chainable stand-in for the service-role client: awaited updates resolve to claimRows, staff_profiles to one SA. */
function fakeDb({ alert, claimRows }) {
  const writes = []
  return {
    writes,
    from(table) {
      let op = 'select'
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        is: () => chain,
        update: (patch) => {
          op = 'update'
          writes.push({ table, patch })
          return chain
        },
        insert: async (rows) => {
          writes.push({ table, rows })
          return { error: null }
        },
        maybeSingle: async () => ({ data: table === 'attendance_location_alerts' ? alert : table === 'branches' ? { name: 'Hakum Auto Care Bacoor' } : null }),
        then: (ok, fail) => {
          const data = op === 'update' ? claimRows : table === 'staff_profiles' ? [{ id: 'sa1', role: 'BossMich', is_active: true }] : []
          return Promise.resolve({ data, error: null }).then(ok, fail)
        },
      }
      return chain
    },
  }
}

describe('notifyOpsEvent · attendance_location_alert', () => {
  const actor = { id: 'u1', role: 'staff', full_name: 'Ben' }
  const fresh = { id: 'a1', staff_id: 'u1', branch_slug: 'bacoor', created_at: new Date().toISOString() }

  it('only the person who was blocked can trigger the push, once, while fresh', async () => {
    const other = await notifyOpsEvent(fakeDb({ alert: fresh, claimRows: [{ id: 'a1' }] }), { event: 'attendance_location_alert', id: 'a1', actor: { ...actor, id: 'u2' } })
    assert.equal(other.status, 403)
    const stale = await notifyOpsEvent(fakeDb({ alert: { ...fresh, created_at: '2020-01-01T00:00:00Z' }, claimRows: [{ id: 'a1' }] }), { event: 'attendance_location_alert', id: 'a1', actor })
    assert.equal(stale.status, 403)
    const replay = await notifyOpsEvent(fakeDb({ alert: fresh, claimRows: [] }), { event: 'attendance_location_alert', id: 'a1', actor })
    assert.equal(replay.status, 403)
  })

  it('claims pushed_at and skips the inbox (geo_clock_in wrote it)', async () => {
    const db = fakeDb({ alert: fresh, claimRows: [{ id: 'a1' }] })
    const out = await notifyOpsEvent(db, { event: 'attendance_location_alert', id: 'a1', actor })
    assert.equal(out.copy.title, 'Time-in blocked · Bacoor')
    assert.equal(out.targets, 1)
    assert.ok(db.writes.some((w) => w.table === 'attendance_location_alerts' && w.patch?.pushed_at))
    assert.equal(db.writes.some((w) => w.table === 'user_notifications'), false)
  })
})
