/**
 * Customer / vehicle visit ledger helpers — plate + phone smart search.
 * Pure functions so History UI and API stay in sync.
 */

export const HISTORY_ROLES = Object.freeze([
  'BossMich',
  'assistant_super_admin',
  'sales',
  'team_lead',
  'marketing',
  'admin',
])

export function normalizeHistoryPlate(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

export function normalizeHistoryPhone(value) {
  return String(value || '').replace(/\D/g, '')
}

/** PH mobiles often stored as 09… or 639… — compare last 10 digits. */
export function phoneMatchKey(value) {
  const digits = normalizeHistoryPhone(value)
  if (!digits) return ''
  return digits.length > 10 ? digits.slice(-10) : digits
}

/**
 * Classify ops search input.
 * @returns {{ kind: 'plate'|'phone'|'mixed', plate: string, phone: string, raw: string }}
 */
export function classifyHistoryQuery(rawInput) {
  const raw = String(rawInput || '').trim()
  const plate = normalizeHistoryPlate(raw)
  const phone = normalizeHistoryPhone(raw)
  const digitRatio = raw.length ? phone.length / raw.replace(/\s/g, '').length : 0

  if (phone.length >= 7 && digitRatio >= 0.7) {
    return { kind: 'phone', plate: '', phone, raw }
  }
  if (plate.length >= 3 && phone.length < 7) {
    return { kind: 'plate', plate, phone: '', raw }
  }
  return { kind: 'mixed', plate, phone, raw }
}

export function platesMatch(a, b) {
  const na = normalizeHistoryPlate(a)
  const nb = normalizeHistoryPlate(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

export function phonesMatch(a, b) {
  const ka = phoneMatchKey(a)
  const kb = phoneMatchKey(b)
  if (!ka || !kb) return false
  return ka === kb || ka.endsWith(kb) || kb.endsWith(ka)
}

export function formatPhpMinor(minor) {
  const n = Number(minor)
  if (!Number.isFinite(n)) return null
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(n / 100)
}

/**
 * Merge bookings + maintenance + sales into one timeline, newest first.
 */
export function buildHistoryTimeline({ bookings = [], maintenance = [], sales = [] } = {}) {
  const events = []

  for (const b of bookings) {
    const when = b.completed_at || b.scheduled_start || b.created_at
    events.push({
      id: `booking:${b.id}`,
      kind: 'booking',
      at: when,
      sortAt: when || b.created_at,
      title: b.services?.name || 'Service / package',
      subtitle: [b.vehicle_plate, b.customer_name].filter(Boolean).join(' · '),
      status: b.status,
      branch: b.branch,
      plate: b.vehicle_plate,
      phone: b.customer_phone,
      amountMinor: b.final_price_minor ?? b.price_minor ?? null,
      payCategory: b.services?.pay_category || null,
      serviceSlug: b.services?.slug || null,
      notes: b.notes || null,
      bookingId: b.id,
      customerId: b.customer_id || null,
    })
  }

  for (const m of maintenance) {
    const when = m.last_notified_at || m.next_due_at || m.last_maintenance_at || m.coated_at || m.created_at
    events.push({
      id: `maint:${m.id}`,
      kind: 'maintenance',
      at: when,
      sortAt: m.updated_at || m.created_at || when,
      title: 'Paint maintenance schedule',
      subtitle: [m.plate_number, m.service_slug, m.status].filter(Boolean).join(' · '),
      status: m.status,
      branch: m.branch_slug,
      plate: m.plate_number,
      phone: m.customer_phone,
      amountMinor: null,
      nextDueAt: m.next_due_at,
      coatedAt: m.coated_at,
      lastMaintenanceAt: m.last_maintenance_at,
      lastNotifiedAt: m.last_notified_at,
      programKey: m.program_key,
      bookingId: m.booking_id,
      customerId: m.customer_id || null,
    })
  }

  for (const s of sales) {
    const when = s.occurred_at || s.created_at
    events.push({
      id: `sale:${s.id}`,
      kind: 'sale',
      at: when,
      sortAt: when,
      title: `POS sale · ${(s.payment_method || 'paid').replace(/_/g, ' ')}`,
      subtitle: s.notes || null,
      status: s.status,
      branch: s.branch,
      plate: null,
      phone: null,
      amountMinor: s.total_minor ?? s.subtotal_minor ?? null,
      bookingId: s.booking_id,
      customerId: s.customer_id || null,
      saleId: s.id,
    })
  }

  return events.sort((a, b) => {
    const ta = new Date(a.sortAt || 0).getTime()
    const tb = new Date(b.sortAt || 0).getTime()
    return tb - ta
  })
}

/**
 * Client-side filters for the timeline.
 */
export function filterHistoryTimeline(events, { kinds, status, branch, serviceKind, from, to } = {}) {
  const kindSet = kinds?.length ? new Set(kinds) : null
  const fromMs = from ? new Date(from).getTime() : null
  const toMs = to ? new Date(`${to}T23:59:59`).getTime() : null

  return (events || []).filter((ev) => {
    if (kindSet && !kindSet.has(ev.kind)) return false
    if (status && status !== 'all' && String(ev.status || '') !== status) return false
    if (branch && branch !== 'all' && String(ev.branch || '') !== branch) return false
    if (serviceKind && serviceKind !== 'all') {
      if (ev.kind !== 'booking') return false
      const cat = String(ev.payCategory || '')
      if (serviceKind === 'detailing' && cat !== 'detailing') return false
      if (serviceKind === 'package' && !['package', 'ppf'].includes(cat)) return false
      if (serviceKind === 'wash' && !['wash', 'general', 'addon'].includes(cat)) return false
    }
    if (fromMs != null || toMs != null) {
      const t = new Date(ev.at || ev.sortAt || 0).getTime()
      if (!Number.isFinite(t)) return false
      if (fromMs != null && t < fromMs) return false
      if (toMs != null && t > toMs) return false
    }
    return true
  })
}

export function summarizeHistoryIdentity(bookings = [], maintenance = []) {
  const names = new Set()
  const phones = new Set()
  const plates = new Set()
  const branches = new Set()
  for (const b of bookings) {
    if (b.customer_name) names.add(b.customer_name)
    if (b.customer_phone) phones.add(b.customer_phone)
    if (b.vehicle_plate) plates.add(b.vehicle_plate)
    if (b.branch) branches.add(b.branch)
  }
  for (const m of maintenance) {
    if (m.customer_name) names.add(m.customer_name)
    if (m.customer_phone) phones.add(m.customer_phone)
    if (m.plate_number) plates.add(m.plate_number)
    if (m.branch_slug) branches.add(m.branch_slug)
  }
  return {
    names: [...names],
    phones: [...phones],
    plates: [...plates],
    branches: [...branches],
  }
}
