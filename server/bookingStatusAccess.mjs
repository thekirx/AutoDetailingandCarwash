/**
 * Pure gate for /api/booking-status — service role bypasses bookings RLS,
 * so callers must enforce branch scope here.
 */
import { isCrmSafeBookingStatus } from './crmBookingStatus.mjs'

/**
 * @param {{ role?: string, branch_slug?: string | null, branch_slugs?: string[] | null }} staff
 * @param {{ branch?: string | null, status?: string | null }} booking
 * @param {{ nextStatus?: string } | undefined} opts
 */
export function canStaffUpdateBookingStatus(staff, booking, opts = {}) {
  if (!staff?.role || !booking) return false
  const branch = booking.branch
  if (!branch) return false

  if (staff.role === 'BossMich' || staff.role === 'assistant_super_admin') return true

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
