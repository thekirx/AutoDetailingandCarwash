import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { earliestBookableDay, isCustomerBookable, manilaTodayISO } from '../src/lib/bookingLead.js'
import { renderDetailingBookingSms, renderDetailingReminderSms } from '../src/lib/detailingBookingSms.js'
import { maintenanceReminderDue } from '../src/lib/maintenanceReminderDue.js'
import { reminderOffset } from '../server/bookingReminders.mjs'
import { buildBookingNotifyPayload } from '../server/notifyBooking.mjs'
import { canConfirmBookingSchedule, canCreateBookings } from '../src/auth/permissions.js'

const detailing = {
  id: 'b1',
  customer_name: 'Ana Cruz',
  customer_phone: '09171234567',
  customer_id: 'c1',
  vehicle_make: 'Toyota',
  vehicle_model: 'Vios',
  vehicle_plate: 'ABC1234',
  scheduled_start: '2026-11-02T02:00:00.000Z',
  service_name: 'Ceramic Coating',
  services: { name: 'Ceramic Coating', slug: 'ceramic-coating', pay_category: 'detailing' },
  specialist_name: 'Rhea',
}

describe('customer booking lead', () => {
  it('closes today and tomorrow in Manila', () => {
    const now = new Date('2026-10-17T02:00:00.000Z')
    assert.equal(manilaTodayISO(now), '2026-10-17')
    assert.equal(earliestBookableDay(now), '2026-10-19')
    assert.equal(isCustomerBookable('2026-10-18T02:00:00.000Z', now), false)
    assert.equal(isCustomerBookable('2026-10-19T02:00:00.000Z', now), true)
  })
})

describe('detailing SMS sheets', () => {
  it('uses the customer sheet for a landing-page request', () => {
    const line = renderDetailingBookingSms('customer', detailing, () => 0)
    assert.match(line, /Hi Ana!/)
    assert.match(line, /tentatively/)
    assert.match(line, /Ceramic Coating/)
    assert.doesNotMatch(line, /confirmed on/)
  })

  it('uses the crew sheet and names the specialist when staff confirm', () => {
    const line = renderDetailingBookingSms('crew', detailing, () => 0)
    assert.match(line, /confirmed on/)
    assert.match(line, /Your specialist is Rhea/)
  })

  it('sends the customer sheet on pending and the crew sheet on confirmed', () => {
    const pending = buildBookingNotifyPayload(detailing, 'pending', null, { random: () => 0 })
    const confirmed = buildBookingNotifyPayload(detailing, 'confirmed', null, { random: () => 0 })
    assert.match(pending.sms, /tentatively/)
    assert.equal(pending.body, pending.sms)
    assert.match(confirmed.sms, /confirmed/)
    assert.match(confirmed.sms, /Rhea/)
    assert.equal(confirmed.body, confirmed.sms)
  })

  it('reminds 7, 3, and 1 days before the scheduled day', () => {
    assert.equal(reminderOffset(detailing.scheduled_start, '2026-10-26'), 7)
    assert.equal(reminderOffset(detailing.scheduled_start, '2026-10-30'), 3)
    assert.equal(reminderOffset(detailing.scheduled_start, '2026-11-01'), 1)
    assert.equal(reminderOffset(detailing.scheduled_start, '2026-10-20'), null)
    assert.match(renderDetailingReminderSms(detailing, 1), /tomorrow/)
  })
})

describe('maintenance monthly reminders', () => {
  it('starts a month before the due date and repeats every month until the visit', () => {
    const row = { status: 'scheduled', next_due_at: '2026-11-17', last_notified_at: null }
    assert.equal(maintenanceReminderDue(row, '2026-10-01'), false)
    assert.equal(maintenanceReminderDue(row, '2026-10-18'), true)
    assert.equal(
      maintenanceReminderDue({ ...row, last_notified_at: '2026-10-18T02:00:00.000Z' }, '2026-11-01'),
      false,
    )
    assert.equal(
      maintenanceReminderDue({ ...row, status: 'notified', last_notified_at: '2026-10-18T02:00:00.000Z' }, '2026-11-18'),
      true,
    )
  })
})

describe('maintenance reminders run on the same cron seam as booking reminders', () => {
  it('is a notifications operation with a daily schedule', () => {
    const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
    const notes = readFileSync(new URL('../api/notifications.js', import.meta.url), 'utf8')
    assert.ok(vercel.crons.some((row) => row.path === '/api/notifications?operation=maintenance-reminders'))
    assert.match(notes, /'maintenance-reminders':/)
  })
})

describe('who can book for a customer', () => {
  it('lets Branch Admin, Team Lead, and Sales set the final schedule', () => {
    assert.equal(canCreateBookings({ role: 'admin', branch_slug: 'bacoor' }), false)
    assert.equal(canConfirmBookingSchedule({ role: 'admin', branch_slug: 'bacoor' }), false)
    assert.equal(canConfirmBookingSchedule({ role: 'team_lead', branch_slug: 'bacoor' }), true)
    assert.equal(canConfirmBookingSchedule({ role: 'sales' }), false)
    assert.equal(canConfirmBookingSchedule({ role: 'detailer', branch_slug: 'bacoor' }), false)
  })
})
