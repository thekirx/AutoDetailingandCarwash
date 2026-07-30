/**
 * Cart line for a queue→POS handoff.
 * Never use the handoff row id as service_id (complete_pos_sale would FK-fail or stamp wrong loyalty).
 */
export function buildHandoffCartLine({ handoff, services = [], amountMinor }) {
  const booking = handoff?.bookings || {}
  const serviceId = booking.service_id || null
  const svc = serviceId ? services.find((s) => s.id === serviceId) : null
  const amount = Number(
    amountMinor ?? handoff?.amount_minor ?? booking.final_price_minor ?? 0,
  ) || 0
  return {
    key: `handoff-${handoff.id}`,
    item_type: 'service',
    id: serviceId,
    name: svc?.name || `Queue · ${booking.vehicle_plate || 'ticket'}`,
    quantity: 1,
    unit_price_minor: amount,
    price_minor: amount,
    missing_service: !serviceId,
  }
}

/** Build complete_pos_sale payload — keep queue handoffs linked to booking completion. */
export function buildPosSalePayload({ branch, customerId, paymentMethod, cart, activeHandoff, notes }) {
  const note = typeof notes === 'string' ? notes.trim() : ''
  return {
    branch,
    customer_id: customerId || activeHandoff?.bookings?.customer_id || null,
    booking_id: activeHandoff?.booking_id || null,
    pos_handoff_id: activeHandoff?.id || null,
    payment_method: paymentMethod,
    status: 'paid',
    notes: note || null,
    lines: (cart || []).map((line) => ({
      item_type: line.item_type,
      // null when handoff has no booking.service_id — never pass a non-service uuid
      service_id: line.item_type === 'service' && line.id ? line.id : null,
      product_id: line.item_type === 'product' && line.id ? line.id : null,
      name: line.name,
      quantity: line.quantity,
      unit_price_minor: line.is_loyalty_award ? 0 : line.unit_price_minor,
      is_loyalty_award: Boolean(line.is_loyalty_award),
    })),
  }
}
