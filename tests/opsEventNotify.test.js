/**
 * notify-ops-event copy: right words per event, amounts in pesos, stable tags, and a known event list.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { OPS_EVENTS, buildOpsEventCopy } from '../server/notifyOpsEvent.mjs'
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
})
