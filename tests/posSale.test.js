import assert from 'node:assert/strict'
import {
  applyAdHocDiscount,
  buildHandoffCartLine,
  buildPosSalePayload,
  canRemovePosCartLine,
  priceCartForMembership,
  removePosCartLine,
  resolveMembershipUnitPrice,
  serviceMatchesIncluded,
} from '../src/lib/posSale.js'

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

const birthday = buildPosSalePayload({
  branch: 'bacoor',
  customerId: 'cust-3',
  paymentMethod: 'cash',
  cart: [
    {
      item_type: 'service',
      id: 'svc-2',
      name: 'Wash (birthday)',
      quantity: 1,
      unit_price_minor: 99900,
      is_birthday_award: true,
    },
  ],
})
assert.equal(birthday.lines[0].unit_price_minor, 0)
assert.equal(birthday.lines[0].is_loyalty_award, true)
assert.equal(birthday.lines[0].is_birthday_award, true)

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
assert.equal(orphan.from_handoff, true)

const linked = buildHandoffCartLine({
  handoff: {
    id: 'hand-9',
    bookings: { service_id: 'svc-1', vehicle_plate: 'ABC', final_price_minor: 10000 },
  },
  services: [{ id: 'svc-1', name: 'Premium Wash', pay_category: 'wash' }],
  amountMinor: 12000,
})
assert.equal(linked.id, 'svc-1')
assert.equal(linked.name, 'Premium Wash')
assert.equal(linked.missing_service, false)
assert.equal(linked.unit_price_minor, 12000)
assert.equal(linked.pay_category, 'wash')

const nullServicePayload = buildPosSalePayload({
  branch: 'bacoor',
  customerId: '',
  paymentMethod: 'cash',
  cart: [orphan],
  activeHandoff: { id: 'hand-1', booking_id: 'book-1' },
})
assert.equal(nullServicePayload.lines[0].service_id, null)

assert.equal(serviceMatchesIncluded('Premium Car Wash', ['premium car wash']), true)
assert.equal(serviceMatchesIncluded('Detail', ['Wash']), false)

const discounted = resolveMembershipUnitPrice({
  itemType: 'service',
  serviceName: 'Wash',
  listPriceMinor: 10000,
  membershipsEnabled: true,
  discountPercent: 10,
})
assert.equal(discounted.unit_price_minor, 9000)
assert.equal(discounted.membership_discount_applied, true)

const included = resolveMembershipUnitPrice({
  itemType: 'service',
  serviceName: 'Premium Car Wash',
  listPriceMinor: 15000,
  membershipsEnabled: true,
  includedServices: ['Premium Car Wash'],
})
assert.equal(included.unit_price_minor, 0)
assert.equal(included.is_membership_included, true)

const handoffKept = resolveMembershipUnitPrice({
  itemType: 'service',
  serviceName: 'Wash',
  listPriceMinor: 10000,
  fromHandoff: true,
  membershipsEnabled: true,
  discountPercent: 50,
})
assert.equal(handoffKept.unit_price_minor, 10000)

const pricedCart = priceCartForMembership(
  [
    { key: '1', item_type: 'service', name: 'Wash', quantity: 1, unit_price_minor: 10000, list_price_minor: 10000 },
    { key: '2', item_type: 'product', name: 'Wax', quantity: 1, unit_price_minor: 5000, list_price_minor: 5000 },
  ],
  { membershipsEnabled: true, discountPercent: 20, includedServices: [] },
)
assert.equal(pricedCart[0].unit_price_minor, 8000)
assert.equal(pricedCart[1].unit_price_minor, 5000)

const memberPayload = buildPosSalePayload({
  branch: 'bacoor',
  customerId: 'cust-9',
  paymentMethod: 'cash',
  cart: [
    {
      item_type: 'service',
      id: 'svc-1',
      name: 'Premium Car Wash',
      quantity: 1,
      unit_price_minor: 0,
      is_membership_included: true,
    },
  ],
  activeHandoff: null,
})
assert.equal(memberPayload.lines[0].is_membership_included, true)
assert.equal(memberPayload.lines[0].unit_price_minor, 0)

const locked = { key: 'h1', from_handoff: true, name: 'Wash' }
const freeLine = { key: 'm1', from_handoff: false, name: 'Merch' }
assert.equal(canRemovePosCartLine(locked), false)
assert.equal(canRemovePosCartLine(freeLine), true)
assert.equal(removePosCartLine([locked, freeLine], 'h1').length, 2)
assert.equal(removePosCartLine([locked, freeLine], 'm1').length, 1)

const noReason = applyAdHocDiscount(
  [{ key: 'a', unit_price_minor: 10000, list_price_minor: 10000, quantity: 1 }],
  { percent: 10, reason: 'x' },
)
assert.equal(noReason.ok, false)

const disc = applyAdHocDiscount(
  [
    { key: 'a', unit_price_minor: 10000, list_price_minor: 10000, quantity: 1, from_handoff: false },
    { key: 'b', unit_price_minor: 20000, list_price_minor: 20000, quantity: 1, from_handoff: true },
  ],
  { percent: 10, reason: 'promo walk-in' },
)
assert.equal(disc.ok, true)
assert.equal(disc.cart[0].unit_price_minor, 9000)
assert.equal(disc.cart[1].unit_price_minor, 20000)
assert.ok(disc.audit.reason)

console.log('posSale.buildPosSalePayload + handoff cart: ok')
