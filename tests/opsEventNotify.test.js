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

  it('shift_submitted tells finance who submitted which day', () => {
    const c = buildOpsEventCopy('shift_submitted', { closeId: 'c1', branchName: 'Bacoor', businessDate: '2026-09-27', submitter: 'Ana' })
    assert.equal(c.title, 'End of shift to review · Bacoor')
    assert.match(c.body, /Ana submitted 2026-09-27/)
    assert.equal(c.tag, 'shift-submitted-c1')
  })

  it('shift_accepted tells the submitter finance accepted', () => {
    const c = buildOpsEventCopy('shift_accepted', { closeId: 'c1', branchName: 'Bacoor', businessDate: '2026-09-27' })
    assert.equal(c.title, 'End of shift accepted · Bacoor')
    assert.equal(c.tag, 'shift-accepted-c1')
  })

  it('shift_rejected sends the review note back to the submitter', () => {
    const c = buildOpsEventCopy('shift_rejected', { closeId: 'c1', branchName: 'Bacoor', businessDate: '2026-09-27', note: 'GCash off by 200' })
    assert.equal(c.title, 'End of shift sent back · Bacoor')
    assert.match(c.body, /GCash off by 200/)
    assert.equal(c.tag, 'shift-rejected-c1')
    assert.ok(NOTIFY_EVENTS.shift_rejected.urls.includes('/operations/pos'))
  })

  it('payroll_confirmed says which pay and period', () => {
    const floor = buildOpsEventCopy('payroll_confirmed', { runId: 'r1', runKind: 'floor', periodStart: '2026-09-16', periodEnd: '2026-09-30' })
    assert.equal(floor.title, 'Pay posted')
    assert.match(floor.body, /Floor pay · 2026-09-16 to 2026-09-30/)
    assert.match(buildOpsEventCopy('payroll_confirmed', { runKind: 'fixed' }).body, /^Salary/)
  })

  it('cash advance request and decision show pesos', () => {
    const req = buildOpsEventCopy('cash_advance_submitted', { submissionId: 's1', employee: 'Ben', amountMinor: 150000, branchName: 'Bacoor' })
    assert.equal(req.body, 'Ben · ₱1,500 @ Bacoor')
    const yes = buildOpsEventCopy('cash_advance_resolved', { submissionId: 's1', approved: true, amountMinor: 150000 })
    const no = buildOpsEventCopy('cash_advance_resolved', { submissionId: 's1', approved: false, amountMinor: 150000 })
    assert.equal(yes.title, 'Cash advance approved')
    assert.equal(no.title, 'Cash advance declined')
    assert.match(yes.body, /₱1,500/)
    assert.notEqual(req.tag, yes.tag, 'request and decision are separate inbox rows / toasts')
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
