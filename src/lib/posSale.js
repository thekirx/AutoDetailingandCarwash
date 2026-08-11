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
    list_price_minor: amount,
    price_minor: amount,
    missing_service: !serviceId,
    from_handoff: true,
  }
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/** Case-insensitive name match against membership included_services list. */
export function serviceMatchesIncluded(serviceName, includedServices = []) {
  const target = normalizeName(serviceName)
  if (!target) return false
  return (includedServices || []).some((entry) => normalizeName(entry) === target)
}

/**
 * Apply membership discount / included services to one cart line.
 * Handoff + loyalty-award lines keep their prices (floor already priced / free gift).
 */
export function resolveMembershipUnitPrice({
  itemType,
  serviceName,
  listPriceMinor,
  isLoyaltyAward = false,
  fromHandoff = false,
  membershipsEnabled = true,
  discountPercent = 0,
  includedServices = [],
} = {}) {
  const list = Math.max(Math.floor(Number(listPriceMinor) || 0), 0)
  if (itemType !== 'service' || isLoyaltyAward) {
    return {
      unit_price_minor: isLoyaltyAward ? 0 : list,
      is_membership_included: false,
      membership_discount_applied: false,
    }
  }
  if (fromHandoff || !membershipsEnabled) {
    return {
      unit_price_minor: list,
      is_membership_included: false,
      membership_discount_applied: false,
    }
  }

  if (serviceMatchesIncluded(serviceName, includedServices)) {
    return {
      unit_price_minor: 0,
      is_membership_included: true,
      membership_discount_applied: false,
    }
  }

  const pct = Number(discountPercent)
  if (!Number.isFinite(pct) || pct <= 0) {
    return {
      unit_price_minor: list,
      is_membership_included: false,
      membership_discount_applied: false,
    }
  }
  const clamped = Math.min(Math.max(pct, 0), 100)
  const unit = Math.max(Math.floor(list * (1 - clamped / 100)), 0)
  return {
    unit_price_minor: unit,
    is_membership_included: false,
    membership_discount_applied: unit !== list,
  }
}

/** Reprice catalog cart lines for the active membership (pure). */
export function priceCartForMembership(cart = [], membershipContext = {}) {
  const {
    membershipsEnabled = true,
    discountPercent = 0,
    includedServices = [],
  } = membershipContext

  return (cart || []).map((line) => {
    const list = Math.max(
      Math.floor(Number(line.list_price_minor ?? line.price_minor ?? line.unit_price_minor) || 0),
      0,
    )
    const priced = resolveMembershipUnitPrice({
      itemType: line.item_type,
      serviceName: line.name,
      listPriceMinor: list,
      isLoyaltyAward: Boolean(line.is_loyalty_award),
      fromHandoff: Boolean(line.from_handoff),
      membershipsEnabled,
      discountPercent,
      includedServices,
    })
    return {
      ...line,
      list_price_minor: list,
      unit_price_minor: priced.unit_price_minor,
      price_minor: priced.unit_price_minor,
      is_membership_included: priced.is_membership_included,
      membership_discount_applied: priced.membership_discount_applied,
    }
  })
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
      unit_price_minor:
        line.is_loyalty_award || line.is_birthday_award || line.is_membership_included ? 0 : line.unit_price_minor,
      is_loyalty_award: Boolean(line.is_loyalty_award || line.is_birthday_award),
      is_birthday_award: Boolean(line.is_birthday_award),
      is_membership_included: Boolean(line.is_membership_included),
    })),
  }
}
