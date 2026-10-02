/**
 * Recipient rule: branch-assigned roles hear only their branch; SA / ASA / Ops Lead / Marketing hear all.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { NOTIFY_EVENTS, bookingOpsEvent, planStaffRecipients } from '../src/lib/notifyRouting.js'

const staff = [
  { id: 'sa', role: 'BossMich', branch_slug: null },
  { id: 'asa-fw', role: 'assistant_super_admin', branch_slug: null, permission_grants: { finance_write: true } },
  { id: 'asa-ro', role: 'assistant_super_admin', branch_slug: null, permission_grants: {} },
  { id: 'ol', role: 'operations_lead', branch_slug: null },
  { id: 'mkt', role: 'marketing', branch_slug: 'bacoor' },
  { id: 'ba-bacoor', role: 'admin', branch_slug: 'bacoor' },
  { id: 'tl-bacoor', role: 'team_lead', branch_slug: 'bacoor' },
  { id: 'tl-batangas', role: 'team_lead', branch_slug: 'batangas' },
  { id: 'crew-bacoor', role: 'staff', branch_slug: 'bacoor' },
  { id: 'det-bacoor', role: 'detailer', branch_slug: 'bacoor' },
  { id: 'tl-off', role: 'team_lead', branch_slug: 'bacoor', is_active: false },
  { id: 'tl-gone', role: 'team_lead', branch_slug: 'bacoor', is_archived: true },
]
const ids = (list) => list.map((r) => r.id).sort()

describe('planStaffRecipients', () => {
  it('booking at Bacoor: branch staff of Bacoor + all global roles; not Batangas TL, not crew', () => {
    const got = planStaffRecipients(staff, { ...NOTIFY_EVENTS[bookingOpsEvent('waiting')], branch: 'bacoor' })
    assert.deepEqual(ids(got), ['asa-fw', 'asa-ro', 'ba-bacoor', 'det-bacoor', 'ol', 'sa', 'tl-bacoor'])
  })

  it('booking at Batangas: only the Batangas TL among branch roles', () => {
    const got = planStaffRecipients(staff, { ...NOTIFY_EVENTS[bookingOpsEvent('pending')], branch: 'batangas' })
    assert.deepEqual(ids(got), ['asa-fw', 'asa-ro', 'ol', 'sa', 'tl-batangas'])
  })

  it('each recipient gets their own landing url', () => {
    const got = Object.fromEntries(
      planStaffRecipients(staff, { ...NOTIFY_EVENTS[bookingOpsEvent('for_payment')], branch: 'bacoor' }).map((r) => [r.id, r.url]),
    )
    assert.equal(got['ba-bacoor'], '/operations/pos')
    assert.equal(got['tl-bacoor'], '/operations/queue')
    assert.equal(got['det-bacoor'], '/operations/bookings')
  })

  it('money alerts need finance_write for ASA', () => {
    const got = planStaffRecipients(staff, { ...NOTIFY_EVENTS.floor_pay_ready, branch: 'bacoor' })
    assert.deepEqual(ids(got), ['asa-fw', 'sa'])
  })

  it('cash advance requests go to that branch Branch Admin on the POS Daily sheet', () => {
    const got = planStaffRecipients(staff, { ...NOTIFY_EVENTS.cash_advance_submitted, branch: 'bacoor' })
    assert.deepEqual(got, [{ id: 'ba-bacoor', url: '/operations/pos?tab=sheet' }])
  })

  it('explicit people (assigned crew) skip the role/branch filter and still get an allowed url', () => {
    const got = planStaffRecipients(staff, { ...NOTIFY_EVENTS.crew_assigned, ids: ['crew-bacoor', 'det-bacoor', 'tl-batangas'] })
    assert.deepEqual(got.sort((a, b) => a.id.localeCompare(b.id)), [
      { id: 'crew-bacoor', url: '/operations/my-tasks' },
      { id: 'det-bacoor', url: '/operations/my-tasks' },
      { id: 'tl-batangas', url: '/operations/my-tasks' },
    ])
  })

  it('inactive, archived, and the actor are never notified', () => {
    const got = planStaffRecipients(staff, { ...NOTIFY_EVENTS.review, branch: 'bacoor', excludeId: 'sa' })
    assert.deepEqual(ids(got), ['asa-fw', 'asa-ro', 'ba-bacoor', 'ol'])
    assert.equal(planStaffRecipients(staff, { ...NOTIFY_EVENTS.crew_assigned, ids: ['tl-off', 'tl-gone'] }).length, 0)
  })

  it('extra assigned branches count (staff_branch_assignments)', () => {
    const multi = [...staff, { id: 'ba-both', role: 'admin', branch_slug: 'bacoor', branch_slugs: ['bacoor', 'batangas'] }]
    const got = planStaffRecipients(multi, { ...NOTIFY_EVENTS.complaint, branch: 'batangas' })
    assert.deepEqual(ids(got), ['asa-fw', 'asa-ro', 'ba-both', 'sa'])
  })

  it('marketing is global: sees a Batangas planner card', () => {
    const got = planStaffRecipients(staff, { ...NOTIFY_EVENTS.planner_task, ids: ['mkt'] })
    assert.deepEqual(got, [{ id: 'mkt', url: '/operations/planning' }])
  })
})
