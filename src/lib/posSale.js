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
      service_id: line.item_type === 'service' ? line.id : null,
      product_id: line.item_type === 'product' ? line.id : null,
      name: line.name,
      quantity: line.quantity,
      unit_price_minor: line.unit_price_minor,
    })),
  }
}
