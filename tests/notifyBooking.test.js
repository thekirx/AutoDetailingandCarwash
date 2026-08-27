import assert from 'node:assert/strict'
import { buildBookingNotifyPayload, buildOpsNotifyCopy, buildOpsPushTargets } from '../server/notifyBooking.mjs'
import { normalizePhMobile } from '../server/busybee.mjs'

assert.equal(normalizePhMobile('09171234567'), '639171234567')
assert.equal(normalizePhMobile('+63 917 123 4567'), '639171234567')

const booking = {
  id: 'b1',
  customer_phone: '09171234567',
  customer_id: 'c1',
  customer_name: 'Ana',
  branch: 'bacoor',
  vehicle_plate: 'ABC1234',
  scheduled_start: '2026-07-23T10:00:00+08:00',
  status: 'pending',
}

const pending = buildBookingNotifyPayload(booking, 'pending')
assert.equal(pending.kind, 'booking_received')
assert.equal(pending.url, '/account')
assert.match(pending.sms, /Hakum Auto Care/)

const guest = buildBookingNotifyPayload({ ...booking, customer_id: null }, 'confirmed')
assert.equal(guest.url, '/book')
assert.equal(guest.kind, 'booking_confirm')

const checking = buildBookingNotifyPayload(booking, 'final_checking')
assert.equal(checking.kind, 'booking_status')
assert.match(checking.sms, /final checking/i)

const releasing = buildBookingNotifyPayload(booking, 'for_releasing')
assert.equal(releasing.kind, 'booking_status')
assert.match(releasing.sms, /releas|ready|pick/i)

assert.equal(buildBookingNotifyPayload(booking, 'nope'), null)

const redo = buildBookingNotifyPayload(booking, 'redo')
assert.equal(redo.kind, 'booking_status')
assert.match(redo.sms, /redoing/i)

const photos = buildBookingNotifyPayload(booking, 'photos_ready')
assert.equal(photos.kind, 'booking_photos')
assert.match(photos.sms, /photos ready|app/i)
assert.equal(photos.url, '/account')

const off = buildBookingNotifyPayload(booking, 'pending', {
  'booking.pending.customer': { enabled: false },
})
assert.equal(off, null)

const custom = buildBookingNotifyPayload(booking, 'pending', {
  'booking.pending.customer': { enabled: true, title: 'Got it {name}', body: 'At {branch}', sms_body: 'SMS {plate}' },
})
assert.equal(custom.title, 'Got it Ana')
assert.equal(custom.sms, 'SMS ABC1234')

const opsTargets = buildOpsPushTargets(booking)
assert.equal(opsTargets.length, 2)
assert.deepEqual(opsTargets[0].roles, ['admin', 'team_lead', 'staff'])
assert.equal(opsTargets[0].branchId, 'bacoor')
assert.deepEqual(opsTargets[1].roles, ['BossMich', 'assistant_super_admin'])

const opsCopy = buildOpsNotifyCopy(booking, 'waiting')
assert.equal(opsCopy.url, '/operations/queue')
assert.match(opsCopy.body, /ABC1234/)

console.log('notifyBooking + busybee normalize: ok')
