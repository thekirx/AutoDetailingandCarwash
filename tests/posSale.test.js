import assert from 'node:assert/strict'
import { buildHandoffCartLine, buildPosSalePayload } from '../src/lib/posSale.js'

const walkIn = buildPosSalePayload({
  branch: 'bacoor',
  customerId: '',
  paymentMethod: 'cash',
  cart: [{ item_type: 'service', id: 'svc-1', name: 'Wash', quantity: 1, unit_price_minor: 35000 }],
  activeHandoff: null,
})
assert.equal(walkIn.booking_id, null)
assert.equal(walkIn.pos_handoff_id, null)
assert.equal(walkIn.customer_id, null)
assert.equal(walkIn.notes, null)

const handoff = buildPosSalePayload({
  branch: 'bacoor',
  customerId: '',
  paymentMethod: 'gcash',
  notes: 'Walk-in: Ana · Plate ABC123',
  cart: [{ item_type: 'service', id: 'svc-1', name: 'Wash', quantity: 1, unit_price_minor: 35000 }],
  activeHandoff: {
    id: 'hand-1',
    booking_id: 'book-1',
    bookings: { customer_id: 'cust-1' },
  },
})
assert.equal(handoff.booking_id, 'book-1')
assert.equal(handoff.pos_handoff_id, 'hand-1')
assert.equal(handoff.customer_id, 'cust-1')
assert.equal(handoff.payment_method, 'gcash')
assert.equal(handoff.notes, 'Walk-in: Ana · Plate ABC123')

const loyalty = buildPosSalePayload({
  branch: 'bacoor',
  customerId: 'cust-2',
  paymentMethod: 'cash',
  notes: 'Includes loyalty award line',
  cart: [
    { item_type: 'service', id: 'svc-1', name: 'Wash', quantity: 1, unit_price_minor: 35000 },
    {
      item_type: 'service',
      id: 'svc-2',
      name: 'Interior (loyalty award)',
      quantity: 1,
      unit_price_minor: 99900,
      is_loyalty_award: true,
    },
  ],
  activeHandoff: null,
})
assert.equal(loyalty.lines[1].unit_price_minor, 0)
assert.equal(loyalty.lines[1].is_loyalty_award, true)
assert.equal(loyalty.lines[0].unit_price_minor, 35000)

// Missing booking.service_id must NOT fall back to handoff UUID
const orphan = buildHandoffCartLine({
  handoff: {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    amount_minor: 25000,
    bookings: { vehicle_plate: 'XYZ 123', final_price_minor: 25000 },
  },
  services: [{ id: 'svc-1', name: 'Wash' }],
})
assert.equal(orphan.id, null)
assert.equal(orphan.missing_service, true)
assert.notEqual(orphan.id, orphan.key)
assert.equal(orphan.unit_price_minor, 25000)

const linked = buildHandoffCartLine({
  handoff: {
    id: 'hand-9',
    bookings: { service_id: 'svc-1', vehicle_plate: 'ABC', final_price_minor: 10000 },
  },
  services: [{ id: 'svc-1', name: 'Premium Wash' }],
  amountMinor: 12000,
})
assert.equal(linked.id, 'svc-1')
assert.equal(linked.name, 'Premium Wash')
assert.equal(linked.missing_service, false)
assert.equal(linked.unit_price_minor, 12000)

const nullServicePayload = buildPosSalePayload({
  branch: 'bacoor',
  customerId: '',
  paymentMethod: 'cash',
  cart: [orphan],
  activeHandoff: { id: 'hand-1', booking_id: 'book-1' },
})
assert.equal(nullServicePayload.lines[0].service_id, null)

console.log('posSale.buildPosSalePayload + handoff cart: ok')
