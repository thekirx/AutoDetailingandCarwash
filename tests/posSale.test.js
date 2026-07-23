import assert from 'node:assert/strict'
import { buildPosSalePayload } from '../src/lib/posSale.js'

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

const handoff = buildPosSalePayload({
  branch: 'bacoor',
  customerId: '',
  paymentMethod: 'gcash',
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

console.log('posSale.buildPosSalePayload: ok')
