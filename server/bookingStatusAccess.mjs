/**
 * Pure gate for /api/booking-status — service role bypasses bookings RLS,
 * so callers must enforce branch scope here.
 */
import { isCrmSafeBookingStatus } from './crmBookingStatus.mjs'

function hasAsaGrant(staff, key) {
  const grants = staff?.permission_grants
  const defaults = {
    queue_all: true,
    pos: true,
    finance_view: true,
    finance_write: false,
    reports: true,
  }
  if (!grants || typeof grants !== 'object') return defaults[key] !== false
  if (Object.prototype.hasOwnProperty.call(grants, key)) return Boolean(grants[key])
  return defaults[key] !== false
}

/**
 * @param {{ role?: string, branch_slug?: string | null, branch_slugs?: string[] | null, permission_grants?: object | null }} staff
 * @param {{ branch?: string | null, status?: string | null }} booking
 * @param {{ nextStatus?: string } | undefined} opts
 */
export function canStaffUpdateBookingStatus(staff, booking, opts = {}) {
  if (!staff?.role || !booking) return false
  const branch = booking.branch
  if (!branch) return false

  if (staff.role === 'BossMich') return true

  if (staff.role === 'assistant_super_admin') {
    const next = opts.nextStatus
    if (next && isCrmSafeBookingStatus(next)) return true
    return hasAsaGrant(staff, 'queue_all')
  }

  if (staff.role === 'marketing') {
    const next = opts.nextStatus
    if (!next || !isCrmSafeBookingStatus(next)) return false
    return Boolean(staff.branch_slug) && staff.branch_slug === branch
  }

  if (staff.role === 'team_lead') {
    return Boolean(staff.branch_slug) && staff.branch_slug === branch
  }

  if (staff.role === 'admin') {
    const slugs = Array.isArray(staff.branch_slugs) && staff.branch_slugs.length
      ? staff.branch_slugs.filter(Boolean)
      : staff.branch_slug
        ? [staff.branch_slug]
        : []
    return slugs.includes(branch)
  }

  return false
}
