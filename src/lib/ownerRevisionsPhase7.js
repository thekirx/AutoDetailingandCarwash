/**
 * Owner Revisions Phase 7 pure helpers (vehicle icons, car-size rollup,
 * chemical usage from Sunday recons, SLA overage, day role overrides).
 */

import { getLocalCalendarDate } from './localCalendarDate.js'
import { reconUsageQty } from './inventoryBranchStock.js'

/** Preset icon keys for vehicles.icon */
export const VEHICLE_ICON_PRESETS = [
  { key: 'sedan', label: 'Sedan', glyph: '🚗' },
  { key: 'suv', label: 'SUV', glyph: '🚙' },
  { key: 'truck', label: 'Truck', glyph: '🛻' },
  { key: 'van', label: 'Van', glyph: '🚐' },
  { key: 'hatch', label: 'Hatch', glyph: '🚕' },
  { key: 'bike', label: 'Bike', glyph: '🏍' },
]

export function normalizeVehicleIcon(key) {
  const k = String(key || '').trim().toLowerCase()
  if (!k) return null
  return VEHICLE_ICON_PRESETS.some((p) => p.key === k) ? k : null
}

export function vehicleIconGlyph(key) {
  const hit = VEHICLE_ICON_PRESETS.find((p) => p.key === normalizeVehicleIcon(key))
  return hit?.glyph || '🚗'
}

/**
 * Car size per sale from sales/bookings vehicle_type (or vehicle_size).
 * Returns [{ size, count, total_minor }] sorted by count desc.
 */
export function aggregateCarSizePerSale(rows = []) {
  const map = {}
  for (const row of rows || []) {
    const size =
      String(
        row.vehicle_type ||
          row.vehicle_size ||
          row.bookings?.vehicle_type ||
          row.bookings?.vehicle_size ||
          'unknown',
      )
        .trim()
        .toLowerCase() || 'unknown'
    if (!map[size]) map[size] = { size, count: 0, total_minor: 0 }
    map[size].count += 1
    map[size].total_minor += Number(row.total_minor ?? row.final_price_minor ?? 0) || 0
  }
  return Object.values(map).sort((a, b) => b.count - a.count || b.total_minor - a.total_minor)
}

/**
 * Weekly chemical usage × unit cost from approved/submitted recon lines.
 * @param {Array<{ week_of, branch_slug, status, inventory_recon_lines?: Array }>} recons
 * @param {Record<string, { name?: string, price_minor?: number }>} productById
 */
export function aggregateChemicalUsageByWeek(recons = [], productById = {}) {
  const byWeek = {}
  for (const recon of recons || []) {
    if (!['submitted', 'approved'].includes(String(recon.status || ''))) continue
    const week = String(recon.week_of || '').slice(0, 10)
    if (!week) continue
    if (!byWeek[week]) byWeek[week] = { week_of: week, usage_qty: 0, cost_minor: 0, lines: 0 }
    for (const line of recon.inventory_recon_lines || recon.lines || []) {
      const usage = reconUsageQty(line.previous_qty, line.leftover_qty)
      if (usage <= 0) continue
      const product = productById[line.product_id] || {}
      const unit = Number(product.price_minor ?? line.unit_cost_minor ?? 0) || 0
      byWeek[week].usage_qty += usage
      byWeek[week].cost_minor += usage * unit
      byWeek[week].lines += 1
    }
  }
  return Object.values(byWeek).sort((a, b) => a.week_of.localeCompare(b.week_of))
}

/** True when floor board should show the Sunday-recon stub. */
export function chemicalUsageNeedsStub(recons = []) {
  return !(recons || []).some((r) => ['submitted', 'approved'].includes(String(r.status || '')))
}

/** Dwell over SLA → red in queue/KPI. Null SLA = never over. */
export function isOverSla(dwellMinutes, slaMinutes) {
  const dwell = Number(dwellMinutes)
  const sla = Number(slaMinutes)
  if (!Number.isFinite(dwell) || dwell < 0) return false
  if (!Number.isFinite(sla) || sla <= 0) return false
  return dwell > sla
}

/**
 * Day-only role override (temp TL). Checks overrides for staff_id + on_date (+ branch when set).
 */
export function resolveEffectiveRole(profile, overrides = [], onDate = null) {
  const base = profile?.role || null
  if (!profile?.id) return base
  const date = onDate || getLocalCalendarDate()
  const branch = profile.branch_slug || null
  const hits = (overrides || []).filter((o) => {
    if (String(o.staff_id) !== String(profile.id)) return false
    if (String(o.on_date || '').slice(0, 10) !== date) return false
    if (branch && o.branch_slug && o.branch_slug !== branch) return false
    return Boolean(o.role)
  })
  if (!hits.length) return base
  const tl = hits.find((o) => o.role === 'team_lead')
  return tl?.role || hits[0].role || base
}

export function canCreateStaffRoleOverride(actor) {
  if (!actor?.role) return false
  if (actor.role === 'BossMich' || actor.role === 'assistant_super_admin') return true
  return actor.role === 'admin'
}

export function canRevokeStaffRoleOverride(actor) {
  return actor?.role === 'BossMich'
}

/** Customer CRM prefs for notifyBooking — skip when disabled or channel muted. */
export function customerNotifyAllowed(customer, channel = 'sms') {
  if (!customer) return true
  if (customer.is_disabled === true) return false
  if (channel === 'sms' && customer.notify_sms === false) return false
  if (channel === 'push' && customer.notify_push === false) return false
  return true
}
